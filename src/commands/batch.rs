use super::*;

pub(crate) async fn cmd_batch(ctx: &mut AppContext, args: &[String]) -> Result<()> {
    if args.is_empty() {
        bail!("Usage: webact batch '<json>'");
    }

    let input: Value =
        serde_json::from_str(&args[0]).context("Failed to parse batch JSON input")?;

    let actions = input
        .get("actions")
        .and_then(Value::as_array)
        .ok_or_else(|| anyhow!("'actions' array is required"))?;

    let global_delay = input.get("delay").and_then(Value::as_u64).unwrap_or(0);

    let total = actions.len();
    let mut results: Vec<Value> = Vec::new();
    let mut error: Option<String> = None;

    // Commands that trigger smart waits (state-changing)
    let smart_wait_commands = [
        "navigate",
        "click",
        "fill",
        "select",
        "type",
        "doubleclick",
        "humanclick",
    ];

    for (i, action) in actions.iter().enumerate() {
        let tool = action
            .get("tool")
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow!("Action {} missing 'tool' field", i))?;

        // Build args from the action object (exclude "tool" and "wait" keys)
        let action_args = build_action_args(tool, action);

        // Execute the command
        ctx.output.clear();
        match crate::commands::dispatch(ctx, tool, &action_args).await {
            Ok(()) => {
                let output = ctx.drain_output();
                results.push(json!({
                    "tool": tool,
                    "ok": true,
                    "output": output.trim_end()
                }));
            }
            Err(e) => {
                let output = ctx.drain_output();
                let err_msg = format!("{e}");
                results.push(json!({
                    "tool": tool,
                    "ok": false,
                    "output": if output.trim().is_empty() {
                        err_msg.clone()
                    } else {
                        format!("{}\n{}", output.trim_end(), err_msg)
                    }
                }));
                error = Some(err_msg);
                break;
            }
        }

        // Apply wait: per-action wait field, or smart wait, or global delay
        let per_action_wait = action.get("wait").and_then(Value::as_u64);

        let wait_ms = if let Some(w) = per_action_wait {
            w
        } else if smart_wait_commands.contains(&tool) {
            500 + global_delay
        } else {
            global_delay
        };

        if wait_ms > 0 && i < total - 1 {
            sleep(Duration::from_millis(wait_ms)).await;
        }
    }

    let completed = results.len();
    let output = json!({
        "completed": completed,
        "total": total,
        "error": error,
        "results": results
    });

    out!(ctx, "{}", serde_json::to_string_pretty(&output)?);
    Ok(())
}

fn build_action_args(tool: &str, action: &Value) -> Vec<String> {
    let mut args = Vec::new();

    match tool {
        "navigate" => {
            if let Some(url) = action.get("url").and_then(Value::as_str) {
                args.push(url.to_string());
            } else if let Some(target) = action.get("target").and_then(Value::as_str) {
                args.push(target.to_string());
            }
            if action
                .get("no_dismiss")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                args.push("--no-dismiss".to_string());
            }
        }
        "click" | "doubleclick" | "rightclick" | "hover" | "humanclick" => {
            if let Some(target) = action.get("target").and_then(Value::as_str) {
                args.extend(target.split_whitespace().map(String::from));
            }
        }
        "type" | "humantype" => {
            if let Some(sel) = action.get("selector").and_then(Value::as_str) {
                args.push(sel.to_string());
            }
            if let Some(text) = action.get("text").and_then(Value::as_str) {
                args.push(text.to_string());
            }
        }
        "keyboard" | "paste" => {
            if let Some(text) = action.get("text").and_then(Value::as_str) {
                args.push(text.to_string());
            }
        }
        "press" => {
            if let Some(key) = action.get("key").and_then(Value::as_str) {
                args.push(key.to_string());
            }
        }
        "screenshot" => {
            if let Some(r) = action.get("ref").and_then(Value::as_i64) {
                args.push(format!("--ref={r}"));
            } else if let Some(sel) = action.get("selector").and_then(Value::as_str) {
                if !sel.is_empty() {
                    args.push(format!("--selector={sel}"));
                }
            }
            if let Some(s) = action.get("scale").and_then(Value::as_f64) {
                args.push(format!("--scale={s}"));
            }
            if action
                .get("full")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                args.push("--full".to_string());
            }
            if let Some(o) = action.get("output").and_then(Value::as_str) {
                if !o.is_empty() {
                    args.push(format!("--output={o}"));
                }
            }
        }
        "scroll" => {
            if let Some(target) = action.get("target").and_then(Value::as_str) {
                args.extend(target.split_whitespace().map(String::from));
            }
            if let Some(px) = action.get("pixels").and_then(Value::as_i64) {
                args.push(px.to_string());
            }
        }
        "waitfor" => {
            if let Some(sel) = action.get("selector").and_then(Value::as_str) {
                args.push(sel.to_string());
            }
            if let Some(t) = action.get("timeout").and_then(Value::as_i64) {
                args.push(t.to_string());
            }
        }
        "waitfornav" => {
            if let Some(t) = action.get("timeout").and_then(Value::as_i64) {
                args.push(t.to_string());
            }
        }
        "eval" => {
            if let Some(expr) = action.get("expression").and_then(Value::as_str) {
                args.push(expr.to_string());
            }
        }
        "select" => {
            if let Some(sel) = action.get("selector").and_then(Value::as_str) {
                args.push(sel.to_string());
            }
            if let Some(vals) = action.get("values").and_then(Value::as_array) {
                for v in vals {
                    if let Some(s) = v.as_str() {
                        args.push(s.to_string());
                    }
                }
            }
        }
        "fill" => {
            if let Some(fields) = action.get("fields").and_then(Value::as_object) {
                for (selector, value) in fields {
                    args.push(selector.clone());
                    args.push(value.as_str().unwrap_or_default().to_string());
                }
            }
        }
        "read" | "text" | "dom" => {
            if let Some(sel) = action.get("selector").and_then(Value::as_str) {
                if !sel.is_empty() {
                    args.push(sel.to_string());
                }
            }
            if let Some(tokens) = action.get("max_tokens").and_then(Value::as_i64) {
                if tokens > 0 {
                    args.push(format!("--tokens={tokens}"));
                }
            }
        }
        "axtree" => {
            if action
                .get("interactive")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                args.push("-i".to_string());
            }
            if action
                .get("diff")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                args.push("--diff".to_string());
            }
        }
        // No-arg commands: observe, tabs, close, back, forward, reload, etc.
        _ => {}
    }

    args
}
