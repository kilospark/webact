# Search, Auto-Dismiss, Readurls Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `search` command (web search via browser), cookie/popup auto-dismiss on navigate, `readurls` for parallel multi-URL reading, fix dom selector suggestions, and update docs.

**Architecture:** New commands follow existing dispatch pattern: tools.json definition, mcp_main.rs arg mapping, mod.rs dispatch, core.rs implementation. Auto-dismiss is injected into the existing `cmd_navigate` flow. No new dependencies.

**Tech Stack:** Rust, Chrome DevTools Protocol, JavaScript (injected scripts)

---

### Task 1: Add `search` command

**Files:**
- Modify: `tools.json` (add `webact_search` tool definition)
- Modify: `src/mcp_main.rs:252` (add `search` to `map_tool_args`)
- Modify: `src/commands/mod.rs:13` (add `search` dispatch)
- Modify: `src/commands/core.rs` (add `cmd_search` function)

**Step 1: Add tool definition to tools.json**

Add before the closing `]` in tools.json:

```json
  {
    "name": "webact_search",
    "description": "Search the web using a real browser. Navigates to a search engine, submits the query, and extracts results. Default engine: Google. Use engine parameter for alternatives.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": { "type": "string", "description": "Search query" },
        "engine": { "type": "string", "description": "Search engine: google (default), bing, duckduckgo, or a custom URL (query appended)" },
        "max_tokens": { "type": "integer", "description": "Approximate token limit for results" }
      },
      "required": ["query"]
    }
  }
```

**Step 2: Add MCP arg mapping in `src/mcp_main.rs`**

In `map_tool_args`, add a new arm:

```rust
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
```

**Step 3: Add dispatch in `src/commands/mod.rs`**

Add after the `"text"` arm in the dispatch match:

```rust
"search" => {
    let mut max_tokens = 0usize;
    let mut engine = None;
    let mut query_parts = Vec::new();
    for arg in args {
        if let Some(raw) = arg.strip_prefix("--tokens=") {
            max_tokens = raw.parse::<usize>().unwrap_or(0);
        } else if let Some(raw) = arg.strip_prefix("--engine=") {
            engine = Some(raw.to_string());
        } else {
            query_parts.push(arg.clone());
        }
    }
    if query_parts.is_empty() {
        bail!("Usage: webact search <query> [--engine=google|bing|duckduckgo|<url>]");
    }
    cmd_search(ctx, &query_parts.join(" "), engine.as_deref(), max_tokens).await
}
```

**Step 4: Implement `cmd_search` in `src/commands/core.rs`**

Add at end of file:

```rust
pub(super) async fn cmd_search(
    ctx: &mut AppContext,
    query: &str,
    engine: Option<&str>,
    max_tokens: usize,
) -> Result<()> {
    let encoded = urlencoding::encode(query);
    let search_url = match engine.unwrap_or("google") {
        "google" => format!("https://www.google.com/search?q={encoded}"),
        "bing" => format!("https://www.bing.com/search?q={encoded}"),
        "duckduckgo" | "ddg" => format!("https://duckduckgo.com/?q={encoded}"),
        custom if custom.starts_with("http") => format!("{custom}{encoded}"),
        other => bail!("Unknown engine: {other}. Use google, bing, duckduckgo, or a URL."),
    };

    // Navigate to search results
    cmd_navigate(ctx, &search_url).await?;
    // Clear the navigate brief — we'll return read output instead
    ctx.output.clear();

    // Extract readable content from search results
    cmd_read(ctx, None, if max_tokens > 0 { max_tokens } else { 4000 }).await
}
```

**Step 5: Add `urlencoding` dependency**

Run: `cargo add urlencoding`

If you'd rather avoid a dependency, use this inline instead:
```rust
let encoded: String = query.bytes().map(|b| match b {
    b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
    b' ' => "+".to_string(),
    _ => format!("%{:02X}", b),
}).collect();
```

**Step 6: Build and verify**

Run: `cargo build`
Expected: Compiles cleanly

**Step 7: Commit**

```bash
git add tools.json src/commands/core.rs src/commands/mod.rs src/mcp_main.rs Cargo.toml Cargo.lock
git commit -m "feat: add search command with engine selection"
```

---

### Task 2: Add cookie/popup auto-dismiss to `navigate`

**Files:**
- Modify: `tools.json:12-21` (add `no_dismiss` to navigate schema)
- Modify: `src/mcp_main.rs:255-257` (pass `--no-dismiss` flag)
- Modify: `src/commands/mod.rs:17-22` (parse `--no-dismiss`, pass to cmd_navigate)
- Modify: `src/commands/core.rs:101-124` (add dismiss logic to cmd_navigate)
- Modify: `src/scripts.rs` (add `DISMISS_POPUPS_SCRIPT`)

**Step 1: Add dismiss script to `src/scripts.rs`**

Add at end of file:

```rust
pub const DISMISS_POPUPS_SCRIPT: &str = r#"(function() {
    const selectors = [
        '#onetrust-accept-btn-handler',
        '#CookieBoxSaveButton',
        '[data-testid="cookie-policy-manage-dialog-accept-button"]',
        '.cc-accept', '.cc-dismiss',
        '#accept-cookies', '#cookie-accept',
        '#cookie-consent-accept', '#cookies-accept',
        '[data-cookiefirst-action="accept"]',
        '.js-cookie-consent-agree',
        '#truste-consent-button',
        '#didomi-notice-agree-button',
    ];
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) { el.click(); return 'dismissed:' + sel; }
    }
    const textPatterns = [
        /^accept\s*(all|cookies)?$/i,
        /^(i\s+)?agree$/i,
        /^got\s*it$/i,
        /^(ok|okay)$/i,
        /^allow\s*(all|cookies)?$/i,
        /^close$/i,
    ];
    const buttons = document.querySelectorAll('button, [role="button"], a.button, a.btn');
    for (const btn of buttons) {
        const text = (btn.textContent || '').trim();
        if (text.length > 30) continue;
        for (const pat of textPatterns) {
            if (pat.test(text) && btn.offsetParent !== null) {
                btn.click();
                return 'dismissed:text:' + text;
            }
        }
    }
    return 'none';
})()"#;
```

**Step 2: Update `cmd_navigate` in `src/commands/core.rs`**

Change signature and add dismiss logic:

```rust
pub(super) async fn cmd_navigate(ctx: &mut AppContext, url: &str, dismiss: bool) -> Result<()> {
    let target_url = if url.starts_with("http://") || url.starts_with("https://") {
        url.to_string()
    } else {
        format!("https://{url}")
    };

    let mut state = ctx.load_session_state()?;
    state.ref_map = None;
    state.ref_map_url = None;
    state.ref_map_timestamp = None;
    ctx.save_session_state(&state)?;

    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    cdp.send("Page.enable", json!({})).await?;
    cdp.send("Page.navigate", json!({ "url": target_url }))
        .await?;
    wait_for_ready_state_complete(&mut cdp, Duration::from_secs(15)).await?;

    if dismiss {
        // Brief pause for cookie banners to render
        sleep(Duration::from_millis(300)).await;
        let _ = runtime_evaluate(&mut cdp, DISMISS_POPUPS_SCRIPT, true, false).await;
        // Wait for banner to disappear
        sleep(Duration::from_millis(200)).await;
    }

    out!(ctx, "{}", get_page_brief(&mut cdp).await?);
    cdp.close().await;
    Ok(())
}
```

**Step 3: Update dispatch in `src/commands/mod.rs`**

```rust
"navigate" => {
    if args.is_empty() {
        bail!("Usage: webact navigate <url>");
    }
    let no_dismiss = args.iter().any(|a| a == "--no-dismiss");
    let url_parts: Vec<&str> = args.iter()
        .filter(|a| *a != "--no-dismiss")
        .map(String::as_str)
        .collect();
    cmd_navigate(ctx, &url_parts.join(" "), !no_dismiss).await
}
```

**Step 4: Update all other callers of `cmd_navigate`**

Search for `cmd_navigate(ctx,` and add `true` (dismiss by default) to each call. This includes `cmd_search` from Task 1.

**Step 5: Update `tools.json` navigate definition**

```json
{
    "name": "webact_navigate",
    "description": "Navigate to a URL. Auto-dismisses cookie/popup banners. Auto-prints a compact page summary showing URL, title, inputs, buttons, and links.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "url": { "type": "string", "description": "URL to navigate to (https:// prefix added if missing)" },
        "no_dismiss": { "type": "boolean", "description": "Skip auto-dismissing cookie/popup banners (default: false)" }
      },
      "required": ["url"]
    }
}
```

**Step 6: Update MCP arg mapping in `src/mcp_main.rs`**

```rust
"navigate" => {
    let mut args = vec_from_opt_str(arguments, "url");
    if arguments.get("no_dismiss").and_then(Value::as_bool).unwrap_or(false) {
        args.push("--no-dismiss".to_string());
    }
    args
}
```

**Step 7: Add `use crate::scripts::DISMISS_POPUPS_SCRIPT;` to core.rs imports**

Check existing imports in `src/commands/core.rs` and add the new script constant.

**Step 8: Build and verify**

Run: `cargo build`
Expected: Compiles cleanly

**Step 9: Commit**

```bash
git add src/scripts.rs src/commands/core.rs src/commands/mod.rs src/mcp_main.rs tools.json
git commit -m "feat: auto-dismiss cookie/popup banners on navigate"
```

---

### Task 3: Add `readurls` command

**Files:**
- Modify: `tools.json` (add `webact_readurls` tool definition)
- Modify: `src/mcp_main.rs` (add `readurls` to `map_tool_args`)
- Modify: `src/commands/mod.rs` (add `readurls` dispatch)
- Modify: `src/commands/core.rs` (add `cmd_readurls` function)

**Step 1: Add tool definition to tools.json**

```json
{
    "name": "webact_readurls",
    "description": "Read multiple URLs in parallel. Opens each URL in a new tab, extracts readable content from each, and returns combined results. Closes tabs when done.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "urls": {
          "type": "array",
          "items": { "type": "string" },
          "description": "URLs to read"
        },
        "max_tokens": { "type": "integer", "description": "Approximate token limit per URL" }
      },
      "required": ["urls"]
    }
}
```

**Step 2: Add MCP arg mapping**

```rust
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
```

**Step 3: Add dispatch**

```rust
"readurls" => {
    let mut max_tokens = 0usize;
    let mut urls = Vec::new();
    for arg in args {
        if let Some(raw) = arg.strip_prefix("--tokens=") {
            max_tokens = raw.parse::<usize>().unwrap_or(0);
        } else {
            urls.push(arg.clone());
        }
    }
    if urls.is_empty() {
        bail!("Usage: webact readurls <url1> <url2> ...");
    }
    cmd_readurls(ctx, &urls, max_tokens).await
}
```

**Step 4: Implement `cmd_readurls`**

```rust
pub(super) async fn cmd_readurls(
    ctx: &mut AppContext,
    urls: &[String],
    max_tokens: usize,
) -> Result<()> {
    let effective_max = if max_tokens > 0 { max_tokens } else { 2000 };

    // Open each URL in a new tab and collect tab IDs
    let mut tab_ids: Vec<String> = Vec::new();
    for url in urls {
        let tab = create_new_tab(ctx, Some(url.as_str())).await?;
        let mut state = ctx.load_session_state()?;
        state.tabs.push(tab.id.clone());
        ctx.save_session_state(&state)?;
        tab_ids.push(tab.id.clone());
    }

    // Wait for all tabs to load
    sleep(Duration::from_secs(3)).await;

    // Save current active tab to restore later
    let original_state = ctx.load_session_state()?;
    let original_tab = original_state.active_tab_id.clone();

    // Read each tab
    let mut combined = String::new();
    for (i, tab_id) in tab_ids.iter().enumerate() {
        // Switch to tab
        let mut state = ctx.load_session_state()?;
        state.active_tab_id = Some(tab_id.clone());
        ctx.save_session_state(&state)?;

        // Wait for this tab's content
        let mut cdp = open_cdp(ctx).await?;
        prepare_cdp(ctx, &mut cdp).await?;
        let _ = wait_for_ready_state_complete(&mut cdp, Duration::from_secs(10)).await;

        // Run read extraction
        let script = build_read_extract_script(None)?;
        let context_id = get_frame_context_id(ctx, &mut cdp).await?;
        let result = runtime_evaluate_with_context(&mut cdp, &script, true, false, context_id).await?;
        let mut output = result
            .pointer("/result/value")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();

        // Truncate per-URL
        let char_budget = effective_max.saturating_mul(4);
        if output.len() > char_budget {
            let boundary = output.floor_char_boundary(char_budget);
            output = format!("{}\n... (truncated)", &output[..boundary]);
        }

        combined.push_str(&format!("--- {} ---\n{}\n\n", urls[i], output));
        cdp.close().await;
    }

    // Close all opened tabs
    for tab_id in &tab_ids {
        let _ = http_put_text(ctx, &format!("/json/close/{tab_id}")).await;
        let mut state = ctx.load_session_state()?;
        state.tabs.retain(|id| id != tab_id);
        ctx.save_session_state(&state)?;
    }

    // Restore original active tab
    if let Some(orig) = original_tab {
        let mut state = ctx.load_session_state()?;
        state.active_tab_id = Some(orig);
        ctx.save_session_state(&state)?;
    }

    out!(ctx, "{}", combined.trim());
    Ok(())
}
```

**Step 5: Build and verify**

Run: `cargo build`

**Step 6: Commit**

```bash
git add tools.json src/commands/core.rs src/commands/mod.rs src/mcp_main.rs
git commit -m "feat: add readurls command for parallel multi-URL reading"
```

---

### Task 4: Fix dom selector suggestions

**Files:**
- Modify: `src/commands/core.rs:142-170` (debug and fix selector suggestion logic)

**Step 1: Investigate the issue**

The selector suggestion code at `core.rs:142-170` checks if dom_output starts with "ERROR: Element not found". The issue may be that the DOM extraction script returns a different error format, or the suggestion JS runs in wrong context.

Read `src/scripts.rs` DOM_EXTRACT_TEMPLATE to check exactly what error string it returns when the selector doesn't match. Verify the error prefix matches what `core.rs:142` checks for.

**Step 2: Fix the issue**

Once identified, fix the mismatch. Common issues:
- The error string has different casing or wording
- The suggestion script runs in isolated world but needs page context
- The `runtime_evaluate_with_context` uses wrong context for suggestions

**Step 3: Test manually**

Navigate to a page and run `dom main` — verify suggestions appear.

**Step 4: Commit**

```bash
git add src/commands/core.rs
git commit -m "fix: dom selector suggestions now fire correctly"
```

---

### Task 5: Update MCP_INSTRUCTIONS.md

**Files:**
- Modify: `MCP_INSTRUCTIONS.md`

**Step 1: Add search documentation**

In Key Concepts section, add:

```markdown
**`search`:** Web search via real browser. Navigates to a search engine, submits query, extracts results with `read`. Default: Google. Use `engine` parameter for bing, duckduckgo, or a custom search URL.
```

**Step 2: Add readurls documentation**

```markdown
**`readurls`:** Read multiple URLs in parallel. Opens each in a new tab, extracts content, returns combined results, closes tabs. Use for research tasks comparing multiple pages.
```

**Step 3: Document auto-dismiss**

Add to the `navigate` entry or auto-brief section:

```markdown
**Auto-dismiss:** `navigate` automatically dismisses cookie consent banners and common popups. Use `no_dismiss: true` to skip this behavior.
```

**Step 4: Update "Choosing the Right Reading Tool" table**

Add rows for `search` and `readurls`.

**Step 5: Update "Prefer webact" section**

Update the WebSearch bullet to mention `search` command specifically:

```markdown
- **Instead of WebSearch:** Use `search <query>` — runs a real Google/Bing/DuckDuckGo search in Chrome and extracts results. More reliable than WebSearch and returns actual page content.
```

**Step 6: Commit**

```bash
git add MCP_INSTRUCTIONS.md
git commit -m "docs: document search, readurls, auto-dismiss in MCP instructions"
```

---

### Task 6: Update README.md and www/index.html

**Files:**
- Modify: `README.md`
- Modify: `www/index.html`

**Step 1: Update README.md**

- Add `search` and `readurls` to the command reference table
- Mention auto-dismiss in the navigate description
- Update any tool/command counts

**Step 2: Update www/index.html**

- Add search/readurls to feature lists or command tables
- Update stats (command count, lines of code if shown)
- Mention auto-dismiss as a feature

**Step 3: Commit**

```bash
git add README.md www/index.html
git commit -m "docs: add search, readurls, auto-dismiss to README and website"
```

---

### Task 7: Final build, push, and deploy

**Step 1: Clean build**

```bash
cargo build --release
```

**Step 2: Push all commits**

```bash
git push origin main
```

**Step 3: Deploy website**

```bash
vercel --prod
```
