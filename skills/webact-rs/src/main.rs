use anyhow::{Context, Result, anyhow, bail};
use base64::Engine;
use futures_util::{SinkExt, StreamExt};
use rand::RngCore;
use reqwest::Client;
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet, VecDeque};
use std::env;
use std::fmt::Write as _;
use std::fs;
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::time::{sleep, timeout};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

macro_rules! out {
    ($ctx:expr, $($arg:tt)*) => {{
        use std::fmt::Write;
        let _ = writeln!($ctx.output, $($arg)*);
    }};
}

mod commands;

const DEFAULT_CDP_PORT: u16 = 9222;
const DEFAULT_CDP_HOST: &str = "127.0.0.1";
const CACHE_TTL_MS: i64 = 48 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES: usize = 100;

mod scripts;
mod types;
mod utils;

use scripts::*;
use types::*;
use utils::*;

struct AppContext {
    current_session_id: Option<String>,
    cdp_port: u16,
    cdp_host: String,
    launch_browser_name: Option<String>,
    http: Client,
    output: String,
}

impl AppContext {
    fn new() -> Result<Self> {
        let http = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .context("failed to initialize HTTP client")?;
        Ok(Self {
            current_session_id: None,
            cdp_port: DEFAULT_CDP_PORT,
            cdp_host: DEFAULT_CDP_HOST.to_string(),
            launch_browser_name: None,
            http,
            output: String::new(),
        })
    }

    fn drain_output(&mut self) -> String {
        std::mem::take(&mut self.output)
    }

    fn tmp_dir(&self) -> PathBuf {
        env::temp_dir()
    }

    fn last_session_file(&self) -> PathBuf {
        self.tmp_dir().join("webact-rs-last-session")
    }

    fn session_state_file(&self, session_id: &str) -> PathBuf {
        self.tmp_dir()
            .join(format!("webact-rs-state-{session_id}.json"))
    }

    fn command_file(&self, session_id: &str) -> PathBuf {
        self.tmp_dir()
            .join(format!("webact-rs-command-{session_id}.json"))
    }

    fn chrome_profile_dir(&self) -> PathBuf {
        self.tmp_dir().join("webact-rs-chrome-profile")
    }

    fn chrome_port_file(&self) -> PathBuf {
        self.chrome_profile_dir().join(".webact-port")
    }

    fn action_cache_file(&self) -> PathBuf {
        self.tmp_dir().join("webact-rs-action-cache.json")
    }

    fn tab_locks_file(&self) -> PathBuf {
        self.tmp_dir().join("webact-rs-tab-locks.json")
    }

    fn default_download_dir(&self) -> PathBuf {
        self.tmp_dir().join("webact-rs-downloads")
    }

    fn network_log_file(&self) -> PathBuf {
        let sid = self
            .current_session_id
            .clone()
            .unwrap_or_else(|| "default".to_string());
        self.tmp_dir().join(format!("webact-rs-network-{sid}.json"))
    }

    fn require_session_id(&self) -> Result<&str> {
        self.current_session_id
            .as_deref()
            .ok_or_else(|| anyhow!("No active session"))
    }

    fn set_current_session(&mut self, session_id: String) {
        self.current_session_id = Some(session_id);
    }

    fn load_session_state(&self) -> Result<SessionState> {
        let session_id = self.require_session_id()?.to_string();
        let path = self.session_state_file(&session_id);
        let mut state = if path.exists() {
            let content = fs::read_to_string(&path)
                .with_context(|| format!("failed reading {}", path.display()))?;
            serde_json::from_str::<SessionState>(&content)
                .with_context(|| format!("failed parsing {}", path.display()))?
        } else {
            SessionState::default()
        };

        if state.session_id.is_empty() {
            state.session_id = session_id;
        }
        Ok(state)
    }

    fn save_session_state(&self, state: &SessionState) -> Result<()> {
        let session_id = self.require_session_id()?;
        let path = self.session_state_file(session_id);
        let data =
            serde_json::to_string_pretty(state).context("failed serializing session state")?;
        fs::write(&path, data).with_context(|| format!("failed writing {}", path.display()))
    }

    fn auto_discover_last_session(&mut self) -> Result<()> {
        let sid = fs::read_to_string(self.last_session_file())
            .context("No active session")?
            .trim()
            .to_string();
        if sid.is_empty() {
            bail!("No active session");
        }
        self.current_session_id = Some(sid);
        self.hydrate_connection_from_state()
    }

    fn hydrate_connection_from_state(&mut self) -> Result<()> {
        let state = self.load_session_state()?;
        if let Some(port) = state.port {
            self.cdp_port = port;
        }
        if let Some(host) = state.host {
            self.cdp_host = host;
        }
        Ok(())
    }
}

struct CdpClient {
    ws: tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    next_id: u64,
    pending_events: VecDeque<Value>,
    /// If set, auto-handle JS dialogs via CDP Page.handleJavaScriptDialog.
    auto_dialog: Option<(bool, String)>, // (accept, promptText)
}

impl CdpClient {
    async fn connect(ws_url: &str) -> Result<Self> {
        let (ws, _) = connect_async(ws_url)
            .await
            .with_context(|| format!("failed to connect CDP websocket: {ws_url}"))?;
        Ok(Self {
            ws,
            next_id: 1,
            pending_events: VecDeque::new(),
            auto_dialog: None,
        })
    }

    async fn send(&mut self, method: &str, params: Value) -> Result<Value> {
        let id = self.next_id;
        self.next_id += 1;

        let payload = json!({
            "id": id,
            "method": method,
            "params": params,
        });

        self.ws
            .send(Message::Text(payload.to_string().into()))
            .await
            .with_context(|| format!("failed to send CDP method {method}"))?;

        while let Some(msg) = self.ws.next().await {
            let value = self
                .parse_ws_message(msg.context("CDP websocket read error")?)?
                .ok_or_else(|| anyhow!("WebSocket closed"))?;

            // Auto-handle JS dialogs at the CDP protocol level
            if value.get("method").and_then(Value::as_str)
                == Some("Page.javascriptDialogOpening")
            {
                if let Some((accept, prompt_text)) = &self.auto_dialog {
                    let dialog_id = self.next_id;
                    self.next_id += 1;
                    let mut params = json!({ "accept": *accept });
                    if !prompt_text.is_empty() {
                        params["promptText"] = Value::String(prompt_text.clone());
                    }
                    let payload = json!({
                        "id": dialog_id,
                        "method": "Page.handleJavaScriptDialog",
                        "params": params,
                    });
                    let _ = self
                        .ws
                        .send(Message::Text(payload.to_string().into()))
                        .await;
                    let dialog_type = value
                        .pointer("/params/type")
                        .and_then(Value::as_str)
                        .unwrap_or("dialog");
                    let msg_text = value
                        .pointer("/params/message")
                        .and_then(Value::as_str)
                        .unwrap_or("");
                    eprintln!(
                        "Auto-{}ed {}: \"{}\"",
                        if *accept { "accept" } else { "dismiss" },
                        dialog_type,
                        msg_text
                    );
                    continue;
                }
            }

            if value.get("id").and_then(Value::as_u64) == Some(id) {
                if let Some(err) = value.get("error") {
                    let message = err
                        .get("message")
                        .and_then(Value::as_str)
                        .unwrap_or("Unknown CDP error");
                    let code = err.get("code").and_then(Value::as_i64).unwrap_or_default();
                    bail!("{message} ({code})");
                }
                return Ok(value.get("result").cloned().unwrap_or(Value::Null));
            }
            if value.get("method").is_some() {
                self.pending_events.push_back(value);
            }
        }

        bail!("WebSocket closed")
    }

    async fn next_event(&mut self, wait: Duration) -> Result<Option<Value>> {
        if let Some(v) = self.pending_events.pop_front() {
            return Ok(Some(v));
        }

        let msg = match timeout(wait, self.ws.next()).await {
            Ok(maybe) => maybe,
            Err(_) => return Ok(None),
        };

        match msg {
            Some(raw) => self.parse_ws_message(raw.context("CDP websocket read error")?),
            None => Ok(None),
        }
    }

    fn parse_ws_message(&self, msg: Message) -> Result<Option<Value>> {
        match msg {
            Message::Text(text) => {
                let value: Value = serde_json::from_str(&text)
                    .with_context(|| format!("invalid CDP JSON message: {text}"))?;
                Ok(Some(value))
            }
            Message::Binary(bin) => {
                let text = String::from_utf8_lossy(&bin);
                let value: Value = serde_json::from_str(&text)
                    .with_context(|| format!("invalid CDP JSON message: {text}"))?;
                Ok(Some(value))
            }
            Message::Close(_) => Ok(None),
            _ => Ok(Some(Value::Null)),
        }
    }

    async fn close(mut self) {
        let _ = self.ws.close(None).await;
    }
}

#[tokio::main]
async fn main() {
    if let Err(err) = run().await {
        eprintln!("Error: {err:#}");
        std::process::exit(1);
    }
}

async fn run() -> Result<()> {
    let mut args: Vec<String> = env::args().skip(1).collect();

    if args.is_empty() {
        print_help();
        return Ok(());
    }

    let command = args.remove(0);
    if matches!(command.as_str(), "-v" | "-V" | "--version") {
        println!("{}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }
    if matches!(command.as_str(), "-h" | "--help" | "help") {
        print_help();
        return Ok(());
    }

    let mut ctx = AppContext::new()?;
    if let Some(port) = env::var("CDP_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
    {
        ctx.cdp_port = port;
    }

    if command == "run" {
        let session_id = args
            .first()
            .cloned()
            .context("Usage: webact-rs run <sessionId> [command args...]")?;
        ctx.set_current_session(session_id);
        ctx.hydrate_connection_from_state()?;

        if args.len() > 1 {
            let inline_command = args[1].clone();
            let inline_args = args[2..].to_vec();
            commands::dispatch(&mut ctx, &inline_command, &inline_args).await?;
        } else {
            run_command_file(&mut ctx).await?;
        }
        let buffered = ctx.drain_output();
        if !buffered.is_empty() {
            print!("{buffered}");
        }
        return Ok(());
    }

    if command != "launch" && command != "connect" {
        ctx.auto_discover_last_session()
            .context("No active session. Run: webact-rs launch")?;
    }

    commands::dispatch(&mut ctx, &command, &args).await?;
    let buffered = ctx.drain_output();
    if !buffered.is_empty() {
        print!("{buffered}");
    }
    Ok(())
}

async fn run_command_file(ctx: &mut AppContext) -> Result<()> {
    let session_id = ctx.require_session_id()?.to_string();
    let cmd_file = ctx.command_file(&session_id);
    let content = fs::read_to_string(&cmd_file)
        .with_context(|| format!("Cannot read {}", cmd_file.display()))?;
    let parsed: Value = serde_json::from_str(&content)
        .with_context(|| format!("Invalid JSON in {}", cmd_file.display()))?;

    let entries = if parsed.is_array() {
        serde_json::from_value::<Vec<CommandFileEntry>>(parsed)?
    } else {
        vec![serde_json::from_value::<CommandFileEntry>(parsed)?]
    };

    for entry in entries {
        if entry.command.trim().is_empty() {
            bail!("Missing \"command\" field in command file");
        }
        let args = entry.args.iter().map(json_value_to_arg).collect::<Vec<_>>();
        commands::dispatch(ctx, &entry.command, &args).await?;
    }

    Ok(())
}

async fn open_cdp(ctx: &mut AppContext) -> Result<CdpClient> {
    let tab = connect_to_tab(ctx).await?;
    if let Some(lock) = check_tab_lock(ctx, &tab.id)? {
        let sid = ctx.require_session_id()?;
        if lock.session_id != sid {
            let remaining = ((lock.expires - now_epoch_ms()).max(0) / 1000) as i64;
            bail!(
                "Tab is locked by session {} (expires in {}s). Use a different tab or wait.",
                lock.session_id,
                remaining
            );
        }
    }
    let ws_url = tab
        .web_socket_debugger_url
        .ok_or_else(|| anyhow!("No active tab for this session. Navigate to a URL first."))?;
    CdpClient::connect(&ws_url).await
}

async fn connect_to_tab(ctx: &mut AppContext) -> Result<DebugTab> {
    let mut state = ctx.load_session_state()?;
    let tabs = get_debug_tabs(ctx).await?;

    let mut tab = None;
    if let Some(active_id) = state.active_tab_id.clone() {
        tab = tabs.iter().find(|t| t.id == active_id).cloned();
        if tab.is_none() {
            for owned_id in &state.tabs {
                tab = tabs.iter().find(|t| t.id == *owned_id).cloned();
                if tab.is_some() {
                    break;
                }
            }
        }
    }

    let selected =
        tab.ok_or_else(|| anyhow!("No active tab for this session. Navigate to a URL first."))?;
    if selected.web_socket_debugger_url.is_none() {
        bail!("Selected tab has no webSocketDebuggerUrl");
    }

    state.active_tab_id = Some(selected.id.clone());
    ctx.save_session_state(&state)?;

    Ok(selected)
}

async fn get_debug_tabs(ctx: &AppContext) -> Result<Vec<DebugTab>> {
    let body = http_get_text(ctx, "/json").await?;
    serde_json::from_str::<Vec<DebugTab>>(&body).context("Failed to parse Chrome debug info")
}

async fn create_new_tab(ctx: &AppContext, url: Option<&str>) -> Result<DebugTab> {
    let suffix = match url {
        Some(raw) if !raw.is_empty() => format!("/json/new?{raw}"),
        _ => "/json/new".to_string(),
    };
    let body = http_put_text(ctx, &suffix).await?;
    serde_json::from_str::<DebugTab>(&body).context("Failed to create new tab")
}

async fn http_get_text(ctx: &AppContext, path: &str) -> Result<String> {
    let url = format!("http://{}:{}{}", ctx.cdp_host, ctx.cdp_port, path);
    let resp = ctx
        .http
        .get(&url)
        .send()
        .await
        .with_context(|| format!("GET {url} failed"))?;
    resp.text()
        .await
        .context("failed reading GET response body")
}

async fn http_put_text(ctx: &AppContext, path: &str) -> Result<String> {
    let url = format!("http://{}:{}{}", ctx.cdp_host, ctx.cdp_port, path);
    let resp = ctx
        .http
        .put(&url)
        .send()
        .await
        .with_context(|| format!("PUT {url} failed"))?;
    resp.text()
        .await
        .context("failed reading PUT response body")
}

async fn runtime_evaluate(
    cdp: &mut CdpClient,
    expression: &str,
    return_by_value: bool,
    await_promise: bool,
) -> Result<Value> {
    runtime_evaluate_with_context(cdp, expression, return_by_value, await_promise, None).await
}

async fn runtime_evaluate_with_context(
    cdp: &mut CdpClient,
    expression: &str,
    return_by_value: bool,
    await_promise: bool,
    context_id: Option<i64>,
) -> Result<Value> {
    let mut params = json!({ "expression": expression });
    if return_by_value {
        params["returnByValue"] = Value::Bool(true);
    }
    if await_promise {
        params["awaitPromise"] = Value::Bool(true);
    }
    if let Some(id) = context_id {
        params["contextId"] = Value::from(id);
    }

    let result = cdp.send("Runtime.evaluate", params).await?;
    if let Some(details) = result.get("exceptionDetails") {
        let text = details
            .get("text")
            .and_then(Value::as_str)
            .or_else(|| {
                details
                    .get("exception")
                    .and_then(|ex| ex.get("description"))
                    .and_then(Value::as_str)
            })
            .unwrap_or("Runtime evaluation failed");
        bail!("{text}");
    }

    Ok(result)
}

async fn get_frame_context_id(ctx: &AppContext, cdp: &mut CdpClient) -> Result<Option<i64>> {
    let state = ctx.load_session_state()?;
    if let Some(frame_id) = state.active_frame_id {
        let result = cdp
            .send(
                "Page.createIsolatedWorld",
                json!({
                    "frameId": frame_id,
                    "worldName": "webact-rs",
                    "grantUniversalAccess": true
                }),
            )
            .await?;
        let context_id = result
            .get("executionContextId")
            .and_then(Value::as_i64)
            .ok_or_else(|| anyhow!("Could not find execution context for selected frame"))?;
        return Ok(Some(context_id));
    }
    Ok(None)
}

async fn prepare_cdp(ctx: &mut AppContext, cdp: &mut CdpClient) -> Result<()> {
    let mut state = ctx.load_session_state()?;

    if let Some(handler) = state.dialog_handler.clone() {
        cdp.send("Page.enable", json!({})).await?;
        cdp.auto_dialog = Some((handler.accept, handler.prompt_text));
        state.dialog_handler = None;
        ctx.save_session_state(&state)?;
    }

    if let Some(block_patterns) = state.block_patterns {
        let mut blocked = block_patterns.url_patterns;
        for rt in block_patterns.resource_types {
            blocked.extend(resource_type_url_patterns(&rt));
        }
        if !blocked.is_empty() {
            cdp.send("Network.enable", json!({})).await?;
            let uniq = blocked
                .into_iter()
                .collect::<HashSet<_>>()
                .into_iter()
                .collect::<Vec<_>>();
            cdp.send("Network.setBlockedURLs", json!({ "urls": uniq }))
                .await?;
        }
    }

    Ok(())
}

async fn get_page_brief(cdp: &mut CdpClient) -> Result<String> {
    let result = runtime_evaluate(cdp, PAGE_BRIEF_SCRIPT, true, false).await?;
    Ok(result
        .pointer("/result/value")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string())
}

async fn wait_for_ready_state_complete(cdp: &mut CdpClient, timeout: Duration) -> Result<()> {
    let deadline = Instant::now() + timeout;
    while Instant::now() <= deadline {
        let result = runtime_evaluate(cdp, "document.readyState", true, false).await?;
        let state = result
            .pointer("/result/value")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if state == "complete" {
            return Ok(());
        }
        sleep(Duration::from_millis(300)).await;
    }
    Ok(())
}

async fn locate_element(
    ctx: &AppContext,
    cdp: &mut CdpClient,
    selector: &str,
) -> Result<LocatedElement> {
    let context_id = get_frame_context_id(ctx, cdp).await?;
    let script = format!(
        r#"
      (async function() {{
        const sel = {sel};
        let el;
        try {{
          for (let i = 0; i < 50; i++) {{
            el = document.querySelector(sel);
            if (el) break;
            await new Promise(r => setTimeout(r, 100));
          }}
        }} catch (e) {{
          return {{ error: 'Invalid CSS selector: ' + sel + '. Use CSS selectors (#id, .class, tag).' }};
        }}
        if (!el) return {{ error: 'Element not found after 5s: ' + sel }};
        el.scrollIntoView({{ block: 'center', inline: 'center', behavior: 'instant' }});
        await new Promise(r => setTimeout(r, 50));
        const rect = el.getBoundingClientRect();
        return {{
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          tag: el.tagName,
          text: (el.textContent || '').substring(0, 50).trim()
        }};
      }})()
    "#,
        sel = serde_json::to_string(selector)?
    );

    let result = runtime_evaluate_with_context(cdp, &script, true, true, context_id).await?;
    let value = result
        .pointer("/result/value")
        .cloned()
        .unwrap_or(Value::Null);

    if let Some(err) = value.get("error").and_then(Value::as_str) {
        bail!("{err}");
    }

    let x = value
        .get("x")
        .and_then(Value::as_f64)
        .ok_or_else(|| anyhow!("Element location missing x"))?;
    let y = value
        .get("y")
        .and_then(Value::as_f64)
        .ok_or_else(|| anyhow!("Element location missing y"))?;
    let tag = value
        .get("tag")
        .and_then(Value::as_str)
        .unwrap_or("element")
        .to_string();
    let text = value
        .get("text")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    Ok(LocatedElement { x, y, tag, text })
}

async fn locate_element_by_text(
    ctx: &AppContext,
    cdp: &mut CdpClient,
    text: &str,
) -> Result<LocatedElement> {
    let context_id = get_frame_context_id(ctx, cdp).await?;
    let script = format!(
        r#"
      (function() {{
        const target = {target};
        const lower = target.toLowerCase();
        let best = null;
        let bestLen = Infinity;

        function* allElements(root) {{
          for (const el of root.querySelectorAll('*')) {{
            yield el;
            if (el.shadowRoot) yield* allElements(el.shadowRoot);
          }}
        }}

        for (const el of allElements(document)) {{
          if (el.offsetParent === null && el.tagName !== 'BODY' && el.tagName !== 'HTML') {{
            const s = getComputedStyle(el);
            if (s.display === 'none' || (s.position !== 'fixed' && s.position !== 'sticky')) continue;
          }}
          const t = (el.textContent || '').trim();
          if (!t) continue;
          const tl = t.toLowerCase();
          const exact = tl === lower;
          const has = tl.includes(lower);
          if (!exact && !has) continue;
          const len = t.length;
          if (exact && (!best || !best.exact || len < bestLen)) {{ best = {{ el, exact: true }}; bestLen = len; }}
          else if (has && !(best && best.exact) && len < bestLen) {{ best = {{ el, exact: false }}; bestLen = len; }}
        }}

        if (!best) return {{ error: 'No visible element with text: ' + target }};
        const el = best.el;
        el.scrollIntoView({{ block: 'center', inline: 'center', behavior: 'instant' }});
        const rect = el.getBoundingClientRect();
        return {{
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          tag: el.tagName,
          text: (el.textContent || '').substring(0, 50).trim()
        }};
      }})()
    "#,
        target = serde_json::to_string(text)?
    );

    let result = runtime_evaluate_with_context(cdp, &script, true, false, context_id).await?;
    let value = result
        .pointer("/result/value")
        .cloned()
        .unwrap_or(Value::Null);
    if let Some(err) = value.get("error").and_then(Value::as_str) {
        bail!("{err}");
    }
    let x = value
        .get("x")
        .and_then(Value::as_f64)
        .ok_or_else(|| anyhow!("Element location missing x"))?;
    let y = value
        .get("y")
        .and_then(Value::as_f64)
        .ok_or_else(|| anyhow!("Element location missing y"))?;
    let tag = value
        .get("tag")
        .and_then(Value::as_str)
        .unwrap_or("element")
        .to_string();
    let text = value
        .get("text")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    Ok(LocatedElement { x, y, tag, text })
}

fn resolve_selector(ctx: &AppContext, input: &str) -> Result<String> {
    if input.chars().all(|c| c.is_ascii_digit()) {
        let state = ctx.load_session_state()?;
        let map = state
            .ref_map
            .ok_or_else(|| anyhow!("No ref map. Run: axtree -i"))?;
        let selector = map
            .get(input)
            .cloned()
            .ok_or_else(|| anyhow!("Ref {input} not found. Run: axtree -i to refresh."))?;
        return Ok(selector);
    }
    Ok(input.to_string())
}

#[derive(Debug)]
struct InteractiveData {
    elements: Vec<InteractiveElement>,
    output: String,
}

async fn fetch_interactive_elements(
    ctx: &mut AppContext,
    cdp: &mut CdpClient,
) -> Result<InteractiveData> {
    let current_url_result = runtime_evaluate(cdp, "location.href", true, false).await?;
    let current_url = current_url_result
        .pointer("/result/value")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let cache_key = cache_key_from_url(&current_url);

    let mut action_cache = load_action_cache(ctx)?;
    if let Some(cached) = action_cache.get(&cache_key).cloned() {
        if now_epoch_ms() - cached.timestamp < CACHE_TTL_MS && !cached.ref_map.is_empty() {
            let refs_to_check = cached.ref_map.values().take(3).cloned().collect::<Vec<_>>();
            let mut valid = !refs_to_check.is_empty();
            for sel in refs_to_check {
                let check = runtime_evaluate(
                    cdp,
                    &format!("!!document.querySelector({})", serde_json::to_string(&sel)?),
                    true,
                    false,
                )
                .await?;
                if !check
                    .pointer("/result/value")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
                {
                    valid = false;
                    break;
                }
            }
            if valid {
                let mut state = ctx.load_session_state()?;
                state.prev_elements = state.current_elements.clone();
                state.current_elements = Some(cached.elements.clone());
                state.ref_map = Some(cached.ref_map.clone());
                state.ref_map_url = Some(current_url);
                state.ref_map_timestamp = Some(cached.timestamp);
                ctx.save_session_state(&state)?;
                return Ok(InteractiveData {
                    elements: cached.elements,
                    output: cached.output,
                });
            }
        }
    }

    let script = AXTREE_INTERACTIVE_SCRIPT.replace("__WEBACT_SELECTOR_GEN__", SELECTOR_GEN_SCRIPT);
    let context_id = get_frame_context_id(ctx, cdp).await?;
    let result = runtime_evaluate_with_context(cdp, &script, true, false, context_id).await?;
    let items = result
        .pointer("/result/value")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mut elements = Vec::new();
    let mut ref_map = HashMap::new();
    let mut lines = Vec::new();
    for (idx, item) in items.iter().enumerate() {
        let ref_id = idx + 1;
        let selector = item
            .get("selector")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let role = item
            .get("role")
            .and_then(Value::as_str)
            .unwrap_or("element")
            .to_string();
        let name = item
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let value = item
            .get("value")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();

        lines.push(if name.is_empty() {
            format!("[{}] {}", ref_id, role)
        } else {
            format!("[{}] {} \"{}\"", ref_id, role, truncate(&name, 80))
        });
        ref_map.insert(ref_id.to_string(), selector);
        elements.push(InteractiveElement {
            ref_id,
            role,
            name,
            value,
        });
    }
    let mut output = lines.join("\n");
    if output.len() > 6000 {
        let boundary = output.floor_char_boundary(6000);
        output = format!("{}\n... (truncated)", &output[..boundary]);
    }
    if output.is_empty() {
        output = "(no interactive elements found)".to_string();
    }

    let mut state = ctx.load_session_state()?;
    state.prev_elements = state.current_elements.clone();
    state.current_elements = Some(elements.clone());
    state.ref_map = Some(ref_map.clone());
    state.ref_map_url = Some(current_url.clone());
    state.ref_map_timestamp = Some(now_epoch_ms());
    ctx.save_session_state(&state)?;

    action_cache.insert(
        cache_key,
        ActionCacheEntry {
            ref_map: ref_map.clone(),
            elements: elements.clone(),
            output: output.clone(),
            timestamp: now_epoch_ms(),
        },
    );
    save_action_cache(ctx, &action_cache)?;

    Ok(InteractiveData { elements, output })
}

fn diff_elements(
    prev: &[InteractiveElement],
    curr: &[InteractiveElement],
) -> (
    Vec<InteractiveElement>,
    Vec<InteractiveElement>,
    Vec<(InteractiveElement, InteractiveElement)>,
) {
    let prev_map = prev
        .iter()
        .map(|e| (e.ref_id, e.clone()))
        .collect::<HashMap<_, _>>();
    let curr_map = curr
        .iter()
        .map(|e| (e.ref_id, e.clone()))
        .collect::<HashMap<_, _>>();

    let mut added = Vec::new();
    let mut removed = Vec::new();
    let mut changed = Vec::new();

    for (ref_id, el) in &curr_map {
        if let Some(old) = prev_map.get(ref_id) {
            if old.role != el.role || old.name != el.name || old.value != el.value {
                changed.push((old.clone(), el.clone()));
            }
        } else {
            added.push(el.clone());
        }
    }
    for (ref_id, el) in &prev_map {
        if !curr_map.contains_key(ref_id) {
            removed.push(el.clone());
        }
    }
    (added, removed, changed)
}

fn cache_key_from_url(url: &str) -> String {
    if let Ok(parsed) = reqwest::Url::parse(url) {
        format!("{}{}", parsed.host_str().unwrap_or_default(), parsed.path())
    } else {
        url.to_string()
    }
}

fn load_action_cache(ctx: &AppContext) -> Result<HashMap<String, ActionCacheEntry>> {
    let path = ctx.action_cache_file();
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let content =
        fs::read_to_string(&path).with_context(|| format!("failed reading {}", path.display()))?;
    serde_json::from_str(&content).with_context(|| format!("failed parsing {}", path.display()))
}

fn save_action_cache(ctx: &AppContext, cache: &HashMap<String, ActionCacheEntry>) -> Result<()> {
    let now = now_epoch_ms();
    let mut entries = cache
        .iter()
        .filter(|(_, v)| now - v.timestamp <= CACHE_TTL_MS)
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect::<Vec<_>>();
    entries.sort_by(|a, b| b.1.timestamp.cmp(&a.1.timestamp));
    entries.truncate(CACHE_MAX_ENTRIES);
    let pruned = entries.into_iter().collect::<HashMap<_, _>>();
    let path = ctx.action_cache_file();
    fs::write(&path, serde_json::to_string(&pruned)?)
        .with_context(|| format!("failed writing {}", path.display()))
}

fn load_tab_locks(ctx: &AppContext) -> Result<HashMap<String, TabLock>> {
    let path = ctx.tab_locks_file();
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let content =
        fs::read_to_string(&path).with_context(|| format!("failed reading {}", path.display()))?;
    serde_json::from_str(&content).with_context(|| format!("failed parsing {}", path.display()))
}

fn save_tab_locks(ctx: &AppContext, locks: &HashMap<String, TabLock>) -> Result<()> {
    let path = ctx.tab_locks_file();
    fs::write(&path, serde_json::to_string_pretty(locks)?)
        .with_context(|| format!("failed writing {}", path.display()))
}

fn check_tab_lock(ctx: &AppContext, tab_id: &str) -> Result<Option<TabLock>> {
    let mut locks = load_tab_locks(ctx)?;
    let lock = locks.get(tab_id).cloned();
    if let Some(l) = lock.clone() {
        if now_epoch_ms() > l.expires {
            locks.remove(tab_id);
            save_tab_locks(ctx, &locks)?;
            return Ok(None);
        }
    }
    Ok(lock)
}

fn print_help() {
    println!(
        "webact-rs v{} - side-by-side Rust port of webact\n\nUsage: webact-rs <command> [args]\n\nCommands:\n  launch              Launch Chrome and start a session\n  connect             Attach to already-running Chrome (no launch)\n  run <sid>           Run command(s) from /tmp/webact-rs-command-<sid>.json\n  navigate <url>      Navigate to URL\n  back                Go back in history\n  forward             Go forward in history\n  reload              Reload the current page\n  dom [selector]      Get compact DOM (--tokens=N to limit output)\n  axtree [selector]   Get accessibility tree\n  axtree -i           Interactive elements with ref numbers\n  axtree -i --diff    Show only changes since last snapshot\n  observe             Show interactive elements as ready-to-use commands\n  find <query>        Find element by description\n  screenshot          Capture screenshot\n  pdf [path]          Save page as PDF\n  click <sel|x,y|--text> Click element, coordinates, or text match\n  doubleclick <sel|x,y|--text> Double-click\n  rightclick <sel|x,y|--text> Right-click\n  hover <sel|x,y|--text> Hover\n  focus <selector>    Focus an element without clicking\n  clear <selector>    Clear an input or contenteditable\n  type <sel> <text>   Type text into element\n  keyboard <text>     Type at current caret position\n  paste <text>        Paste text via ClipboardEvent\n  select <sel> <val>  Select option(s) from a <select>\n  upload <sel> <file> Upload file(s) to a file input\n  drag <from> <to>    Drag from one element to another\n  dialog <accept|dismiss> [text] Handle next dialog\n  waitfor <sel> [ms]  Wait for element to appear\n  waitfornav [ms]     Wait for navigation/readystate\n  press <key>         Press key or combo (Enter, Ctrl+A, Meta+C)\n  scroll <...>        Scroll page or element\n  eval <js>           Evaluate JavaScript\n  cookies ...         Manage cookies\n  console ...         Show/listen for console logs\n  network ...         Capture/show network requests\n  block ...           Configure request blocking\n  viewport ...        Set viewport preset or dimensions\n  frames              List frames/iframes\n  frame <id|sel>      Switch frame (frame main to reset)\n  download ...        Configure/list downloads\n  tabs                List tabs owned by this session\n  tab <id>            Switch to a session-owned tab\n  newtab [url]        Open a new tab in this session\n  close               Close current tab\n  activate            Bring browser window to front (macOS)\n  minimize            Minimize browser window (macOS)\n  humanclick <...>    Human-like click movement/timing\n  humantype <...>     Human-like typing\n  lock [seconds]      Lock active tab for exclusive access\n  unlock              Release tab lock",
        env!("CARGO_PKG_VERSION")
    );
}
