use webact::*;
use webact::api_client;
use webact::config;

use std::io::{self, BufRead, Write as IoWrite};
use serde_json::Value;

const TOOLS_JSON: &str = include_str!("../tools.json");
const MCP_INSTRUCTIONS: &str = include_str!("../MCP_INSTRUCTIONS.md");

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 && matches!(args[1].as_str(), "-v" | "-V" | "--version") {
        println!("{}", env!("CARGO_PKG_VERSION"));
        return;
    }

    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("failed to build tokio runtime");

    rt.block_on(async {
        if let Err(err) = run_mcp_server().await {
            eprintln!("MCP server error: {err:#}");
            std::process::exit(1);
        }
    });
}

async fn run_mcp_server() -> Result<()> {
    let stdin = io::stdin();
    let stdout = io::stdout();

    let mut ctx = AppContext::new()?;

    // Try to pick up an existing session
    if let Some(port) = env::var("CDP_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
    {
        ctx.cdp_port = port;
    }

    for line in stdin.lock().lines() {
        let line = line.context("failed reading stdin")?;
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let request: Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("Invalid JSON-RPC: {e}");
                continue;
            }
        };

        let id = request.get("id").cloned();
        let method = request
            .get("method")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();

        match method.as_str() {
            "initialize" => {
                let current_version = env!("CARGO_PKG_VERSION");
                let version_notice = match api_client::check_version(current_version).await {
                    Ok(info) => {
                        let is_latest = info
                            .get("current_is_latest")
                            .and_then(Value::as_bool)
                            .unwrap_or(true);
                        if !is_latest {
                            let latest = info
                                .get("latest")
                                .and_then(Value::as_str)
                                .unwrap_or("unknown");
                            format!("**[Update available: webact v{latest} — you have v{current_version}. Visit https://github.com/kilospark/webact/releases/latest to update.]**\n\n")
                        } else {
                            String::new()
                        }
                    }
                    Err(_) => String::new(),
                };
                let instructions = format!("{version_notice}{MCP_INSTRUCTIONS}");

                let response = json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": {
                        "protocolVersion": "2025-11-25",
                        "capabilities": {
                            "tools": {}
                        },
                        "serverInfo": {
                            "name": "webact-mcp",
                            "version": current_version
                        },
                        "instructions": instructions
                    }
                });
                write_response(&stdout, &response)?;
            }
            "notifications/initialized" => {
                // No response needed for notifications
            }
            "tools/list" => {
                let tools: Value = serde_json::from_str(TOOLS_JSON)
                    .context("failed parsing embedded tools.json")?;
                let response = json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": {
                        "tools": tools
                    }
                });
                write_response(&stdout, &response)?;
            }
            "tools/call" => {
                let params = request
                    .get("params")
                    .cloned()
                    .unwrap_or(Value::Null);
                let tool_name = params
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                let arguments = params
                    .get("arguments")
                    .cloned()
                    .unwrap_or(json!({}));

                // Count tool usage for telemetry
                let command = tool_name.strip_prefix("webact_").unwrap_or(&tool_name);
                *ctx.tool_counts.entry(command.to_string()).or_insert(0) += 1;

                let result = handle_tool_call(&mut ctx, &tool_name, &arguments).await;

                let response = match result {
                    Ok(content) => {
                        json!({
                            "jsonrpc": "2.0",
                            "id": id,
                            "result": {
                                "content": content
                            }
                        })
                    }
                    Err(e) => {
                        json!({
                            "jsonrpc": "2.0",
                            "id": id,
                            "result": {
                                "content": [{
                                    "type": "text",
                                    "text": format!("Error: {e:#}")
                                }],
                                "isError": true
                            }
                        })
                    }
                };
                write_response(&stdout, &response)?;
            }
            _ => {
                // Unknown method -- return error if it has an id
                if let Some(id) = id {
                    let response = json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "error": {
                            "code": -32601,
                            "message": format!("Method not found: {method}")
                        }
                    });
                    write_response(&stdout, &response)?;
                }
            }
        }
    }

    // Send telemetry on shutdown (fire-and-forget)
    let cfg = config::load_config();
    if cfg.telemetry && !ctx.tool_counts.is_empty() {
        let duration = ctx.session_start.elapsed().as_secs();
        let platform = format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH);
        let _ = api_client::send_telemetry(
            &ctx.session_id,
            env!("CARGO_PKG_VERSION"),
            &platform,
            duration,
            &ctx.tool_counts,
        )
        .await;
    }

    Ok(())
}

fn write_response(stdout: &io::Stdout, response: &Value) -> Result<()> {
    let mut out = stdout.lock();
    serde_json::to_writer(&mut out, response)
        .context("failed writing JSON-RPC response")?;
    out.write_all(b"\n")
        .context("failed writing newline")?;
    out.flush()
        .context("failed flushing stdout")?;
    Ok(())
}

async fn handle_tool_call(
    ctx: &mut AppContext,
    tool_name: &str,
    arguments: &Value,
) -> Result<Vec<Value>> {
    // Strip webact_ prefix to get command name
    let command = tool_name.strip_prefix("webact_").unwrap_or(tool_name);

    // Commands that don't need a browser session
    let no_browser = matches!(command, "launch" | "connect" | "feedback" | "config");

    // Auto-discover session for most commands
    if !no_browser && ctx.current_session_id.is_none() {
        let _ = ctx.auto_discover_last_session();
    }

    // Auto-launch: if no session or Chrome not reachable, launch automatically
    if !no_browser {
        let needs_launch = if ctx.current_session_id.is_none() {
            true
        } else {
            get_debug_tabs(ctx).await.is_err()
        };
        if needs_launch {
            eprintln!("Auto-launching browser for {command}...");
            ctx.output.clear();
            commands::dispatch(ctx, "launch", &[]).await?;
            let launch_output = ctx.drain_output();
            eprintln!("Auto-launch complete: {}", launch_output.trim());
        }
    }

    // Map tool arguments to CLI args vector
    let args = map_tool_args(command, arguments);

    // Dispatch the command
    commands::dispatch(ctx, command, &args).await?;

    // Drain the output buffer
    let output = ctx.drain_output();

    // Special handling for screenshot: return image content
    if command == "screenshot" {
        return handle_screenshot_output(&output);
    }

    // Return text content
    let text = output.trim_end().to_string();
    if text.is_empty() {
        Ok(vec![json!({ "type": "text", "text": format!("{command}: no output") })])
    } else {
        Ok(vec![json!({ "type": "text", "text": text })])
    }
}

fn handle_screenshot_output(output: &str) -> Result<Vec<Value>> {
    let path = output
        .lines()
        .find_map(|line| line.trim().strip_prefix("Screenshot saved to "))
        .map(|s| s.trim())
        .unwrap_or_default();

    if path.is_empty() || !std::path::Path::new(path).exists() {
        return Ok(vec![json!({
            "type": "text",
            "text": output.trim_end()
        })]);
    }

    let bytes = fs::read(path)
        .with_context(|| format!("failed reading screenshot file: {path}"))?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let mime = if path.ends_with(".png") { "image/png" } else { "image/jpeg" };

    Ok(vec![
        json!({
            "type": "image",
            "data": b64,
            "mimeType": mime
        }),
        json!({
            "type": "text",
            "text": output.trim_end()
        }),
    ])
}

fn map_tool_args(command: &str, arguments: &Value) -> Vec<String> {
    match command {
        // Single URL arg
        "navigate" => {
            let mut args = vec_from_opt_str(arguments, "url");
            if arguments.get("no_dismiss").and_then(Value::as_bool).unwrap_or(false) {
                args.push("--no-dismiss".to_string());
            }
            args
        }
        // Read: optional selector, optional --tokens=N
        "read" | "text" => {
            let mut args = Vec::new();
            if let Some(sel) = arguments.get("selector").and_then(Value::as_str) {
                if !sel.is_empty() {
                    args.push(sel.to_string());
                }
            }
            if let Some(tokens) = arguments.get("max_tokens").and_then(Value::as_i64) {
                if tokens > 0 {
                    args.push(format!("--tokens={tokens}"));
                }
            }
            args
        }
        // DOM: optional selector, optional --tokens=N
        "dom" => {
            let mut args = Vec::new();
            if let Some(sel) = arguments.get("selector").and_then(Value::as_str) {
                if !sel.is_empty() {
                    args.push(sel.to_string());
                }
            }
            if let Some(tokens) = arguments.get("max_tokens").and_then(Value::as_i64) {
                if tokens > 0 {
                    args.push(format!("--tokens={tokens}"));
                }
            }
            args
        }
        // Axtree: optional -i, --diff, selector, --tokens=N
        "axtree" => {
            let mut args = Vec::new();
            if arguments
                .get("interactive")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                args.push("-i".to_string());
            }
            if arguments
                .get("diff")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                args.push("--diff".to_string());
            }
            if let Some(sel) = arguments.get("selector").and_then(Value::as_str) {
                if !sel.is_empty() {
                    args.push(sel.to_string());
                }
            }
            if let Some(tokens) = arguments.get("max_tokens").and_then(Value::as_i64) {
                if tokens > 0 {
                    args.push(format!("--tokens={tokens}"));
                }
            }
            args
        }
        // Click variants, hover: split target on whitespace
        "click" | "doubleclick" | "rightclick" | "hover" | "humanclick" => {
            split_target(arguments)
        }
        // Type/humantype: selector + text
        "type" | "humantype" => {
            let mut args = Vec::new();
            if let Some(sel) = arguments.get("selector").and_then(Value::as_str) {
                args.push(sel.to_string());
            }
            if let Some(text) = arguments.get("text").and_then(Value::as_str) {
                args.push(text.to_string());
            }
            args
        }
        // Fill: fields object -> alternating selector/value pairs
        "fill" => {
            let mut args = Vec::new();
            if let Some(fields) = arguments.get("fields").and_then(Value::as_object) {
                for (selector, value) in fields {
                    args.push(selector.clone());
                    args.push(value.as_str().unwrap_or_default().to_string());
                }
            }
            args
        }
        // Keyboard/paste: text
        "keyboard" | "paste" => {
            vec_from_opt_str(arguments, "text")
        }
        // Press: key
        "press" => {
            vec_from_opt_str(arguments, "key")
        }
        // Select: selector + values array
        "select" => {
            let mut args = Vec::new();
            if let Some(sel) = arguments.get("selector").and_then(Value::as_str) {
                args.push(sel.to_string());
            }
            if let Some(vals) = arguments.get("values").and_then(Value::as_array) {
                for v in vals {
                    if let Some(s) = v.as_str() {
                        args.push(s.to_string());
                    } else {
                        args.push(v.to_string());
                    }
                }
            }
            args
        }
        // Upload: selector + files array
        "upload" => {
            let mut args = Vec::new();
            if let Some(sel) = arguments.get("selector").and_then(Value::as_str) {
                args.push(sel.to_string());
            }
            if let Some(files) = arguments.get("files").and_then(Value::as_array) {
                for f in files {
                    if let Some(s) = f.as_str() {
                        args.push(s.to_string());
                    }
                }
            }
            args
        }
        // Drag: from + to
        "drag" => {
            let mut args = Vec::new();
            if let Some(from) = arguments.get("from").and_then(Value::as_str) {
                args.push(from.to_string());
            }
            if let Some(to) = arguments.get("to").and_then(Value::as_str) {
                args.push(to.to_string());
            }
            args
        }
        // Scroll: target (split on whitespace) + optional pixels
        "scroll" => {
            let mut args = Vec::new();
            if let Some(target) = arguments.get("target").and_then(Value::as_str) {
                args.extend(target.split_whitespace().map(String::from));
            }
            if let Some(px) = arguments.get("pixels").and_then(Value::as_i64) {
                args.push(px.to_string());
            }
            args
        }
        // Eval: expression
        "eval" => {
            vec_from_opt_str(arguments, "expression")
        }
        // Dialog: action + optional text
        "dialog" => {
            let mut args = Vec::new();
            if let Some(action) = arguments.get("action").and_then(Value::as_str) {
                args.push(action.to_string());
            }
            if let Some(text) = arguments.get("text").and_then(Value::as_str) {
                if !text.is_empty() {
                    args.push(text.to_string());
                }
            }
            args
        }
        // Waitfor: selector + optional timeout
        "waitfor" => {
            let mut args = Vec::new();
            if let Some(sel) = arguments.get("selector").and_then(Value::as_str) {
                args.push(sel.to_string());
            }
            if let Some(t) = arguments.get("timeout").and_then(Value::as_i64) {
                args.push(t.to_string());
            }
            args
        }
        // Waitfornav: optional timeout
        "waitfornav" => {
            let mut args = Vec::new();
            if let Some(t) = arguments.get("timeout").and_then(Value::as_i64) {
                args.push(t.to_string());
            }
            args
        }
        // Cookies: action, name, value, domain
        "cookies" => {
            let mut args = Vec::new();
            if let Some(action) = arguments.get("action").and_then(Value::as_str) {
                args.push(action.to_string());
            }
            if let Some(name) = arguments.get("name").and_then(Value::as_str) {
                args.push(name.to_string());
            }
            if let Some(value) = arguments.get("value").and_then(Value::as_str) {
                args.push(value.to_string());
            }
            if let Some(domain) = arguments.get("domain").and_then(Value::as_str) {
                args.push(domain.to_string());
            }
            args
        }
        // Console: optional action
        "console" => {
            let mut args = Vec::new();
            if let Some(action) = arguments.get("action").and_then(Value::as_str) {
                args.push(action.to_string());
            }
            args
        }
        // Network: action, duration, filter
        "network" => {
            let mut args = Vec::new();
            if let Some(action) = arguments.get("action").and_then(Value::as_str) {
                args.push(action.to_string());
            }
            if let Some(dur) = arguments.get("duration").and_then(Value::as_i64) {
                args.push(dur.to_string());
            }
            if let Some(filter) = arguments.get("filter").and_then(Value::as_str) {
                if !filter.is_empty() {
                    args.push(filter.to_string());
                }
            }
            args
        }
        // Block: patterns array
        "block" => {
            let mut args = Vec::new();
            if let Some(patterns) = arguments.get("patterns").and_then(Value::as_array) {
                for p in patterns {
                    if let Some(s) = p.as_str() {
                        args.push(s.to_string());
                    }
                }
            }
            args
        }
        // Viewport: preset_or_width + optional height
        "viewport" => {
            let mut args = Vec::new();
            if let Some(pw) = arguments.get("preset_or_width").and_then(Value::as_str) {
                args.push(pw.to_string());
            }
            if let Some(h) = arguments.get("height").and_then(Value::as_str) {
                args.push(h.to_string());
            }
            args
        }
        // Frame: target
        "frame" => {
            vec_from_opt_str(arguments, "target")
        }
        // Tab: id
        "tab" => {
            vec_from_opt_str(arguments, "id")
        }
        // Newtab: optional url
        "newtab" => {
            let mut args = Vec::new();
            if let Some(url) = arguments.get("url").and_then(Value::as_str) {
                if !url.is_empty() {
                    args.push(url.to_string());
                }
            }
            args
        }
        // Lock: optional seconds
        "lock" => {
            let mut args = Vec::new();
            if let Some(s) = arguments.get("seconds").and_then(Value::as_i64) {
                args.push(s.to_string());
            }
            args
        }
        // Download: action, path
        "download" => {
            let mut args = Vec::new();
            if let Some(action) = arguments.get("action").and_then(Value::as_str) {
                args.push(action.to_string());
            }
            if let Some(path) = arguments.get("path").and_then(Value::as_str) {
                if !path.is_empty() {
                    args.push(path.to_string());
                }
            }
            args
        }
        // Search: engine, max_tokens, query
        "search" => {
            let mut args = Vec::new();
            if let Some(engine) = arguments.get("engine").and_then(Value::as_str) {
                if !engine.is_empty() {
                    args.push(format!("--engine={engine}"));
                }
            }
            if let Some(tokens) = arguments.get("max_tokens").and_then(Value::as_u64) {
                args.push(format!("--tokens={tokens}"));
            }
            if let Some(query) = arguments.get("query").and_then(Value::as_str) {
                args.push(query.to_string());
            }
            args
        }
        // Readurls: urls array + optional --tokens=N
        "readurls" => {
            let mut args = Vec::new();
            if let Some(tokens) = arguments.get("max_tokens").and_then(Value::as_u64) {
                args.push(format!("--tokens={tokens}"));
            }
            if let Some(urls) = arguments.get("urls").and_then(Value::as_array) {
                for url in urls {
                    if let Some(u) = url.as_str() {
                        args.push(u.to_string());
                    }
                }
            }
            args
        }
        // Find: query
        "find" => {
            vec_from_opt_str(arguments, "query")
        }
        // Pdf: optional path
        "pdf" => {
            let mut args = Vec::new();
            if let Some(path) = arguments.get("path").and_then(Value::as_str) {
                if !path.is_empty() {
                    args.push(path.to_string());
                }
            }
            args
        }
        // Focus/clear: selector
        "focus" | "clear" => {
            vec_from_opt_str(arguments, "selector")
        }
        "screenshot" => {
            let mut args = Vec::new();
            if let Some(sel) = arguments.get("selector").and_then(Value::as_str) {
                if !sel.is_empty() {
                    args.push(format!("--selector={sel}"));
                }
            }
            if let Some(fmt) = arguments.get("format").and_then(Value::as_str) {
                args.push(format!("--format={fmt}"));
            }
            if let Some(q) = arguments.get("quality").and_then(Value::as_i64) {
                args.push(format!("--quality={q}"));
            }
            if let Some(w) = arguments.get("width").and_then(Value::as_i64) {
                args.push(format!("--width={w}"));
            }
            args
        }
        // Feedback: rating + optional comment
        "feedback" => {
            let mut args = Vec::new();
            if let Some(r) = arguments.get("rating").and_then(Value::as_i64) {
                args.push(r.to_string());
            }
            if let Some(c) = arguments.get("comment").and_then(Value::as_str) {
                args.push(c.to_string());
            }
            args
        }
        // Config: action + optional key + optional value
        "config" => {
            let mut args = Vec::new();
            if let Some(a) = arguments.get("action").and_then(Value::as_str) {
                args.push(a.to_string());
            }
            if let Some(k) = arguments.get("key").and_then(Value::as_str) {
                args.push(k.to_string());
            }
            if let Some(v) = arguments.get("value") {
                args.push(v.to_string());
            }
            args
        }
        // No-arg commands
        "launch" | "observe" | "frames" | "tabs" | "close" | "back"
        | "forward" | "reload" | "activate" | "minimize" | "unlock" => {
            Vec::new()
        }
        _ => Vec::new(),
    }
}

fn vec_from_opt_str(arguments: &Value, key: &str) -> Vec<String> {
    let mut args = Vec::new();
    if let Some(val) = arguments.get(key).and_then(Value::as_str) {
        if !val.is_empty() {
            args.push(val.to_string());
        }
    }
    args
}

fn split_target(arguments: &Value) -> Vec<String> {
    if let Some(target) = arguments.get("target").and_then(Value::as_str) {
        target.split_whitespace().map(String::from).collect()
    } else {
        Vec::new()
    }
}
