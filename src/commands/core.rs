use super::*;

pub(super) async fn cmd_launch(ctx: &mut AppContext) -> Result<()> {
    let user_data_dir = ctx.chrome_profile_dir();
    let port_file = ctx.chrome_port_file();

    if let Ok(saved) = fs::read_to_string(&port_file) {
        if let Ok(saved_port) = saved.trim().parse::<u16>() {
            ctx.cdp_port = saved_port;
            if get_debug_tabs(ctx).await.is_ok() {
                ctx.launch_browser_name = find_browser().map(|b| b.name);
                out!(ctx, "Browser already running.");
                return cmd_connect(ctx).await;
            }
        }
        let _ = fs::remove_file(&port_file);
    }

    if let Some(port) = env::var("CDP_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
    {
        ctx.cdp_port = port;
    } else {
        ctx.cdp_port = find_free_port()?;
    }

    let browser = find_browser().ok_or_else(|| {
        anyhow!(
            "No Chromium-based browser found. Install Chrome/Edge/Brave/Chromium or set CHROME_PATH."
        )
    })?;
    ctx.launch_browser_name = Some(browser.name.clone());

    fs::create_dir_all(&user_data_dir)
        .with_context(|| format!("failed creating {}", user_data_dir.display()))?;

    let chrome_args = [
        format!("--remote-debugging-port={}", ctx.cdp_port),
        format!("--user-data-dir={}", user_data_dir.to_string_lossy()),
        "--no-first-run".to_string(),
        "--no-default-browser-check".to_string(),
    ];

    let mut command = if cfg!(target_os = "macos") {
        // Use `open -gja` to launch hidden and without stealing focus
        let mut cmd = Command::new("open");
        cmd.arg("-gja").arg(&browser.name).arg("--args");
        for a in &chrome_args {
            cmd.arg(a);
        }
        cmd
    } else {
        let mut cmd = Command::new(&browser.path);
        for a in &chrome_args {
            cmd.arg(a);
        }
        cmd
    };

    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }

    let _child = command
        .spawn()
        .with_context(|| format!("failed launching browser at {}", browser.path))?;

    for _ in 0..30 {
        sleep(Duration::from_millis(500)).await;
        if get_debug_tabs(ctx).await.is_ok() {
            fs::write(&port_file, ctx.cdp_port.to_string())
                .with_context(|| format!("failed writing {}", port_file.display()))?;
            out!(ctx, "{} launched successfully.", browser.name);
            return cmd_connect(ctx).await;
        }
    }

    bail!(
        "{} launched but debug port not responding after 15s.",
        browser.name
    )
}

pub(super) async fn cmd_connect(ctx: &mut AppContext) -> Result<()> {
    let session_id = new_session_id();
    ctx.set_current_session(session_id.clone());

    let new_tab = create_new_tab(ctx, None).await?;

    let state = SessionState {
        session_id: session_id.clone(),
        active_tab_id: Some(new_tab.id.clone()),
        tabs: vec![new_tab.id],
        port: Some(ctx.cdp_port),
        host: Some(ctx.cdp_host.clone()),
        browser_name: ctx.launch_browser_name.clone(),
        ..SessionState::default()
    };
    ctx.save_session_state(&state)?;
    fs::write(ctx.last_session_file(), &session_id)
        .context("failed writing last session pointer")?;

    // Minimize so Chrome doesn't steal focus from the user
    if let Some(name) = &ctx.launch_browser_name {
        let _ = minimize_browser(name);
    }

    out!(ctx, "Session: {session_id}");
    out!(ctx, "Command file: {}", ctx.command_file(&session_id).display());
    Ok(())
}

pub(super) async fn cmd_navigate(ctx: &mut AppContext, url: &str, dismiss: bool) -> Result<()> {
    let target_url = if url.starts_with("http://") || url.starts_with("https://") {
        url.to_string()
    } else {
        format!("https://{url}")
    };

    // New page invalidates ref map.
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
        sleep(Duration::from_millis(300)).await;
        let _ = runtime_evaluate(&mut cdp, DISMISS_POPUPS_SCRIPT, true, false).await;
        sleep(Duration::from_millis(200)).await;
    }

    out!(ctx, "{}", get_page_brief(&mut cdp).await?);
    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_dom(
    ctx: &mut AppContext,
    selector: Option<&str>,
    max_tokens: usize,
) -> Result<()> {
    let script = build_dom_extract_script(selector)?;
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let context_id = get_frame_context_id(ctx, &mut cdp).await?;
    let result = runtime_evaluate_with_context(&mut cdp, &script, true, false, context_id).await?;
    let mut dom_output = result
        .pointer("/result/value")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    if dom_output.starts_with("ERROR: Element not found") {
        // Suggest alternative selectors
        let suggest_script = r#"(function() {
            const s = [];
            document.querySelectorAll('[id]').forEach(el => {
                if (s.length < 15) s.push('#' + CSS.escape(el.id));
            });
            document.querySelectorAll('[data-testid]').forEach(el => {
                if (s.length < 20) s.push('[data-testid="' + el.getAttribute('data-testid') + '"]');
            });
            ['main','article','section','nav','header','footer','aside','form','table'].forEach(tag => {
                if (document.querySelector(tag)) s.push(tag);
            });
            document.querySelectorAll('[role]').forEach(el => {
                const r = el.getAttribute('role');
                const sel = '[role="' + r + '"]';
                if (s.length < 30 && !s.includes(sel)) s.push(sel);
            });
            document.querySelectorAll('[aria-label]').forEach(el => {
                if (s.length < 35) s.push('[aria-label="' + el.getAttribute('aria-label').replace(/"/g, '\\"') + '"]');
            });
            if (s.length === 0) {
                const top = document.body.children;
                for (let i = 0; i < Math.min(top.length, 5); i++) {
                    const el = top[i];
                    const tag = el.tagName.toLowerCase();
                    const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0,2).join('.') : '';
                    s.push(tag + cls);
                }
            }
            return s;
        })()"#;
        let suggest_result = runtime_evaluate_with_context(&mut cdp, suggest_script, true, false, context_id).await?;
        let suggestions = suggest_result
            .pointer("/result/value")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        if !suggestions.is_empty() {
            let sel_list: Vec<&str> = suggestions.iter().filter_map(Value::as_str).collect();
            dom_output = format!("{dom_output}\n\nAvailable selectors: {}", sel_list.join(", "));
        }
        out!(ctx, "{dom_output}");
        cdp.close().await;
        return Ok(());
    }

    if max_tokens > 0 {
        let char_budget = max_tokens.saturating_mul(4);
        if dom_output.len() > char_budget {
            let boundary = dom_output.floor_char_boundary(char_budget);
            dom_output = format!(
                "{}\n... (truncated to ~{} tokens)",
                &dom_output[..boundary],
                max_tokens
            );
        }
    }

    out!(ctx, "{dom_output}");
    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_axtree_interactive(
    ctx: &mut AppContext,
    max_tokens: usize,
    show_diff: bool,
) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;

    let data = fetch_interactive_elements(ctx, &mut cdp).await?;
    if show_diff {
        let state = ctx.load_session_state()?;
        if let (Some(prev), Some(curr)) = (state.prev_elements, state.current_elements) {
            let diff = diff_elements(&prev, &curr);
            if diff.0.is_empty() && diff.1.is_empty() && diff.2.is_empty() {
                out!(ctx, "(no changes since last snapshot)");
            } else {
                let mut diff_buf = String::new();
                if !diff.0.is_empty() {
                    diff_buf.push_str("ADDED:\n");
                    for e in &diff.0 {
                        diff_buf.push_str(&format!("  + [{}] {} \"{}\"\n", e.ref_id, e.role, e.name));
                    }
                }
                if !diff.1.is_empty() {
                    diff_buf.push_str("REMOVED:\n");
                    for e in &diff.1 {
                        diff_buf.push_str(&format!("  - [{}] {} \"{}\"\n", e.ref_id, e.role, e.name));
                    }
                }
                if !diff.2.is_empty() {
                    diff_buf.push_str("CHANGED:\n");
                    for (from, to) in &diff.2 {
                        diff_buf.push_str(&format!(
                            "  ~ [{}] {} \"{}\" (was: \"{}\")\n",
                            to.ref_id, to.role, to.name, from.name
                        ));
                    }
                }
                diff_buf.push_str(&format!(
                    "({} added, {} removed, {} changed)",
                    diff.0.len(),
                    diff.1.len(),
                    diff.2.len()
                ));
                out!(ctx, "{}", diff_buf.trim_end());
            }
        } else {
            out!(ctx, "(no previous snapshot to diff against)");
            out!(ctx, "{}", data.output);
        }
        cdp.close().await;
        return Ok(());
    }

    let mut axtree_output = data.output;
    if max_tokens > 0 {
        let char_budget = max_tokens.saturating_mul(4);
        if axtree_output.len() > char_budget {
            let boundary = axtree_output.floor_char_boundary(char_budget);
            axtree_output = format!(
                "{}\n... (truncated to ~{} tokens)",
                &axtree_output[..boundary],
                max_tokens
            );
        }
    }
    out!(ctx, "{axtree_output}");
    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_axtree_full(ctx: &mut AppContext, selector: Option<&str>, max_tokens: usize) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    cdp.send("Accessibility.enable", json!({})).await?;

    let mut output = if let Some(sel) = selector {
        let context_id = get_frame_context_id(ctx, &mut cdp).await?;
        let obj_result = runtime_evaluate_with_context(
            &mut cdp,
            &format!("document.querySelector({})", serde_json::to_string(sel)?),
            false,
            false,
            context_id,
        )
        .await?;
        let object_id = obj_result
            .pointer("/result/objectId")
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow!("Element not found: {sel}"))?;
        let result = cdp
            .send(
                "Accessibility.queryAXTree",
                json!({ "objectId": object_id }),
            )
            .await?;
        serde_json::to_string_pretty(&result)?
    } else {
        let result = cdp.send("Accessibility.getFullAXTree", json!({})).await?;
        serde_json::to_string_pretty(&result)?
    };

    if max_tokens > 0 {
        let char_budget = max_tokens.saturating_mul(4);
        if output.len() > char_budget {
            let boundary = output.floor_char_boundary(char_budget);
            output = format!(
                "{}\n... (truncated to ~{} tokens — use axtree -i for interactive elements or axtree with selector to scope)",
                &output[..boundary],
                max_tokens
            );
        }
    }

    out!(ctx, "{output}");
    cdp.send("Accessibility.disable", json!({})).await?;
    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_read(
    ctx: &mut AppContext,
    selector: Option<&str>,
    max_tokens: usize,
) -> Result<()> {
    let script = build_read_extract_script(selector)?;
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let context_id = get_frame_context_id(ctx, &mut cdp).await?;
    let result = runtime_evaluate_with_context(&mut cdp, &script, true, false, context_id).await?;
    let mut output = result
        .pointer("/result/value")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    if max_tokens > 0 {
        let char_budget = max_tokens.saturating_mul(4);
        if output.len() > char_budget {
            let boundary = output.floor_char_boundary(char_budget);
            output = format!(
                "{}\n... (truncated to ~{} tokens)",
                &output[..boundary],
                max_tokens
            );
        }
    }

    out!(ctx, "{output}");
    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_text(
    ctx: &mut AppContext,
    selector: Option<&str>,
    max_tokens: usize,
) -> Result<()> {
    let script = build_text_extract_script(selector)?;
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let context_id = get_frame_context_id(ctx, &mut cdp).await?;
    let result = runtime_evaluate_with_context(&mut cdp, &script, true, false, context_id).await?;
    let raw = result
        .pointer("/result/value")
        .and_then(Value::as_str)
        .unwrap_or_default();

    let parsed: Value = serde_json::from_str(raw).unwrap_or(Value::Null);

    if let Some(err) = parsed.get("error").and_then(Value::as_str) {
        out!(ctx, "ERROR: {err}");
        cdp.close().await;
        return Ok(());
    }

    let lines = parsed
        .get("lines")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let ref_map_val = parsed
        .get("refMap")
        .cloned()
        .unwrap_or(json!({}));

    // Save ref map to session state
    if let Some(obj) = ref_map_val.as_object() {
        let ref_map: HashMap<String, String> = obj
            .iter()
            .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
            .collect();
        if !ref_map.is_empty() {
            let mut state = ctx.load_session_state()?;
            state.ref_map = Some(ref_map);
            let url_result = runtime_evaluate(&mut cdp, "location.href", true, false).await?;
            state.ref_map_url = url_result
                .pointer("/result/value")
                .and_then(Value::as_str)
                .map(|s| s.to_string());
            state.ref_map_timestamp = Some(now_epoch_ms());
            ctx.save_session_state(&state)?;
        }
    }

    let mut output = lines
        .iter()
        .filter_map(Value::as_str)
        .collect::<Vec<_>>()
        .join("\n");

    if max_tokens > 0 {
        let char_budget = max_tokens.saturating_mul(4);
        if output.len() > char_budget {
            let boundary = output.floor_char_boundary(char_budget);
            output = format!(
                "{}\n... (truncated to ~{} tokens)",
                &output[..boundary],
                max_tokens
            );
        }
    }

    out!(ctx, "{output}");
    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_click(ctx: &mut AppContext, selector: &str) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let loc = locate_element(ctx, &mut cdp, selector).await?;

    cdp.send(
        "Input.dispatchMouseEvent",
        json!({ "type": "mouseMoved", "x": loc.x, "y": loc.y }),
    )
    .await?;
    sleep(Duration::from_millis(80)).await;
    cdp.send(
        "Input.dispatchMouseEvent",
        json!({ "type": "mousePressed", "x": loc.x, "y": loc.y, "button": "left", "clickCount": 1 }),
    )
    .await?;
    cdp.send(
        "Input.dispatchMouseEvent",
        json!({ "type": "mouseReleased", "x": loc.x, "y": loc.y, "button": "left", "clickCount": 1 }),
    )
    .await?;

    out!(ctx, "Clicked {} \"{}\"", loc.tag.to_lowercase(), loc.text);
    sleep(Duration::from_millis(150)).await;
    out!(ctx, "{}", get_page_brief(&mut cdp).await?);
    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_type(ctx: &mut AppContext, selector: &str, text: &str) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let context_id = get_frame_context_id(ctx, &mut cdp).await?;

    let focus_script = format!(
        "(function() {{ const el = document.querySelector({sel}); if (!el) return {{ error: 'Element not found: ' + {sel} }}; el.focus(); if (el.select) el.select(); return {{ ok: true }}; }})()",
        sel = serde_json::to_string(selector)?
    );

    let focus_result =
        runtime_evaluate_with_context(&mut cdp, &focus_script, true, false, context_id).await?;
    if let Some(err) = focus_result
        .pointer("/result/value/error")
        .and_then(Value::as_str)
    {
        bail!("{err}");
    }

    for ch in text.chars() {
        let char_s = ch.to_string();
        cdp.send(
            "Input.dispatchKeyEvent",
            json!({ "type": "keyDown", "text": char_s, "unmodifiedText": ch.to_string() }),
        )
        .await?;
        cdp.send(
            "Input.dispatchKeyEvent",
            json!({ "type": "keyUp", "text": ch.to_string(), "unmodifiedText": ch.to_string() }),
        )
        .await?;
    }

    out!(ctx, "Typed \"{}\" into {selector}", truncate(text, 50));
    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_press(ctx: &mut AppContext, key: &str) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;

    if key.contains('+') {
        let (mods, main_key) = parse_key_combo(key);
        let mapping = key_mapping(&main_key);
        let mod_bits = (if mods.alt { 1 } else { 0 })
            | (if mods.ctrl { 2 } else { 0 })
            | (if mods.meta { 4 } else { 0 })
            | (if mods.shift { 8 } else { 0 });

        cdp.send(
            "Input.dispatchKeyEvent",
            json!({
                "type": "keyDown",
                "key": mapping.key,
                "code": mapping.code,
                "keyCode": mapping.key_code,
                "windowsVirtualKeyCode": mapping.key_code,
                "modifiers": mod_bits,
            }),
        )
        .await?;

        cdp.send(
            "Input.dispatchKeyEvent",
            json!({
                "type": "keyUp",
                "key": mapping.key,
                "code": mapping.code,
                "keyCode": mapping.key_code,
                "windowsVirtualKeyCode": mapping.key_code,
                "modifiers": mod_bits,
            }),
        )
        .await?;

        out!(ctx, "OK press {key}");
        if matches!(main_key.to_lowercase().as_str(), "enter" | "tab" | "escape") {
            sleep(Duration::from_millis(150)).await;
            out!(ctx, "{}", get_page_brief(&mut cdp).await?);
        }

        cdp.close().await;
        return Ok(());
    }

    let mapping = key_mapping(key);
    cdp.send(
        "Input.dispatchKeyEvent",
        json!({
            "type": "keyDown",
            "key": mapping.key,
            "code": mapping.code,
            "keyCode": mapping.key_code,
            "windowsVirtualKeyCode": mapping.key_code,
        }),
    )
    .await?;
    cdp.send(
        "Input.dispatchKeyEvent",
        json!({
            "type": "keyUp",
            "key": mapping.key,
            "code": mapping.code,
            "keyCode": mapping.key_code,
            "windowsVirtualKeyCode": mapping.key_code,
        }),
    )
    .await?;

    out!(ctx, "OK press {key}");
    if matches!(key.to_lowercase().as_str(), "enter" | "tab" | "escape") {
        sleep(Duration::from_millis(150)).await;
        out!(ctx, "{}", get_page_brief(&mut cdp).await?);
    }

    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_tabs(ctx: &mut AppContext) -> Result<()> {
    let all_tabs = get_debug_tabs(ctx).await?;
    let state = ctx.load_session_state()?;
    let owned_ids = state
        .tabs
        .iter()
        .cloned()
        .collect::<std::collections::HashSet<_>>();
    let owned = all_tabs
        .into_iter()
        .filter(|t| owned_ids.contains(&t.id))
        .collect::<Vec<_>>();

    if owned.is_empty() {
        out!(ctx, "No tabs owned by this session.");
        return Ok(());
    }

    for tab in owned {
        let active = if state.active_tab_id.as_deref() == Some(tab.id.as_str()) {
            " *"
        } else {
            ""
        };
        out!(ctx,
            "[{}] {} - {}{}",
            tab.id,
            tab.title.unwrap_or_else(|| "(untitled)".to_string()),
            tab.url.unwrap_or_else(|| "(no url)".to_string()),
            active
        );
    }

    Ok(())
}

pub(super) async fn cmd_tab(ctx: &mut AppContext, tab_id: &str) -> Result<()> {
    let mut state = ctx.load_session_state()?;
    if !state.tabs.iter().any(|id| id == tab_id) {
        bail!("Tab {tab_id} is not owned by this session.");
    }

    let all_tabs = get_debug_tabs(ctx).await?;
    let tab = all_tabs
        .iter()
        .find(|t| t.id == tab_id)
        .cloned()
        .ok_or_else(|| anyhow!("Tab {tab_id} not found in Chrome"))?;

    state.active_tab_id = Some(tab_id.to_string());
    ctx.save_session_state(&state)?;

    http_put_text(ctx, &format!("/json/activate/{tab_id}")).await?;
    out!(ctx,
        "Switched to tab: {}",
        tab.title
            .or(tab.url)
            .unwrap_or_else(|| "(untitled)".to_string())
    );
    Ok(())
}

pub(super) async fn cmd_new_tab(ctx: &mut AppContext, url: Option<&str>) -> Result<()> {
    let new_tab = create_new_tab(ctx, url).await?;
    let mut state = ctx.load_session_state()?;
    state.tabs.push(new_tab.id.clone());
    state.active_tab_id = Some(new_tab.id.clone());
    ctx.save_session_state(&state)?;

    out!(ctx,
        "New tab: [{}] {}",
        new_tab.id,
        new_tab.url.unwrap_or_else(|| "about:blank".to_string())
    );
    Ok(())
}

pub(super) async fn cmd_close(ctx: &mut AppContext) -> Result<()> {
    let mut state = ctx.load_session_state()?;
    let tab_id = state
        .active_tab_id
        .clone()
        .ok_or_else(|| anyhow!("No active tab"))?;

    http_put_text(ctx, &format!("/json/close/{tab_id}")).await?;
    state.tabs.retain(|id| id != &tab_id);
    state.active_tab_id = state.tabs.last().cloned();
    ctx.save_session_state(&state)?;

    out!(ctx, "Closed tab {tab_id}");
    if let Some(active) = state.active_tab_id {
        out!(ctx, "Active tab is now: {active}");
    } else {
        out!(ctx, "No tabs remaining in this session.");
    }

    Ok(())
}

pub(super) async fn cmd_back(ctx: &mut AppContext) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let nav = cdp.send("Page.getNavigationHistory", json!({})).await?;

    let current_index = nav
        .get("currentIndex")
        .and_then(Value::as_i64)
        .ok_or_else(|| anyhow!("Invalid navigation history"))?;
    let entries = nav
        .get("entries")
        .and_then(Value::as_array)
        .ok_or_else(|| anyhow!("Invalid navigation history entries"))?;

    if current_index <= 0 {
        bail!("No previous page in history.");
    }

    let entry_id = entries[(current_index - 1) as usize]
        .get("id")
        .and_then(Value::as_i64)
        .ok_or_else(|| anyhow!("Missing history entry id"))?;

    cdp.send(
        "Page.navigateToHistoryEntry",
        json!({ "entryId": entry_id }),
    )
    .await?;
    sleep(Duration::from_millis(500)).await;
    out!(ctx, "{}", get_page_brief(&mut cdp).await?);
    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_forward(ctx: &mut AppContext) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let nav = cdp.send("Page.getNavigationHistory", json!({})).await?;

    let current_index = nav
        .get("currentIndex")
        .and_then(Value::as_i64)
        .ok_or_else(|| anyhow!("Invalid navigation history"))?;
    let entries = nav
        .get("entries")
        .and_then(Value::as_array)
        .ok_or_else(|| anyhow!("Invalid navigation history entries"))?;

    if current_index >= entries.len() as i64 - 1 {
        bail!("No next page in history.");
    }

    let entry_id = entries[(current_index + 1) as usize]
        .get("id")
        .and_then(Value::as_i64)
        .ok_or_else(|| anyhow!("Missing history entry id"))?;

    cdp.send(
        "Page.navigateToHistoryEntry",
        json!({ "entryId": entry_id }),
    )
    .await?;
    sleep(Duration::from_millis(500)).await;
    out!(ctx, "{}", get_page_brief(&mut cdp).await?);
    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_reload(ctx: &mut AppContext) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    cdp.send("Page.reload", json!({})).await?;
    wait_for_ready_state_complete(&mut cdp, Duration::from_secs(15)).await?;
    out!(ctx, "{}", get_page_brief(&mut cdp).await?);
    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_search(
    ctx: &mut AppContext,
    query: &str,
    engine: Option<&str>,
    max_tokens: usize,
) -> Result<()> {
    // URL-encode the query inline (avoid adding dependency)
    let encoded: String = query.bytes().map(|b| match b {
        b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
        b' ' => "+".to_string(),
        _ => format!("%{:02X}", b),
    }).collect();

    let search_url = match engine.unwrap_or("google") {
        "google" => format!("https://www.google.com/search?q={encoded}"),
        "bing" => format!("https://www.bing.com/search?q={encoded}"),
        "duckduckgo" | "ddg" => format!("https://duckduckgo.com/?q={encoded}"),
        custom if custom.starts_with("http") => format!("{custom}{encoded}"),
        other => bail!("Unknown engine: {other}. Use google, bing, duckduckgo, or a URL."),
    };

    // Navigate to search results
    cmd_navigate(ctx, &search_url, true).await?;
    // Clear the navigate brief — we'll return read output instead
    ctx.output.clear();

    // Extract readable content from search results
    cmd_read(ctx, None, if max_tokens > 0 { max_tokens } else { 4000 }).await
}

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

pub(super) async fn cmd_screenshot(ctx: &mut AppContext) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let result = cdp
        .send("Page.captureScreenshot", json!({ "format": "png" }))
        .await?;
    let data = result
        .get("data")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow!("Missing screenshot data"))?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data)
        .context("Failed to decode screenshot data")?;
    let sid = ctx
        .current_session_id
        .clone()
        .unwrap_or_else(|| "default".to_string());
    let out = ctx
        .tmp_dir()
        .join(format!("webact-screenshot-{sid}.png"));
    fs::write(&out, bytes).with_context(|| format!("failed writing {}", out.display()))?;
    out!(ctx, "Screenshot saved to {}", out.display());
    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_pdf(ctx: &mut AppContext, output_path: Option<&str>) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let result = cdp
        .send(
            "Page.printToPDF",
            json!({
                "printBackground": true,
                "preferCSSPageSize": true
            }),
        )
        .await?;
    let data = result
        .get("data")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow!("Missing PDF data"))?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data)
        .context("Failed to decode PDF data")?;
    let sid = ctx
        .current_session_id
        .clone()
        .unwrap_or_else(|| "default".to_string());
    let out = output_path
        .map(PathBuf::from)
        .unwrap_or_else(|| ctx.tmp_dir().join(format!("webact-page-{sid}.pdf")));
    fs::write(&out, bytes).with_context(|| format!("failed writing {}", out.display()))?;
    out!(ctx, "PDF saved to {}", out.display());
    cdp.close().await;
    Ok(())
}
