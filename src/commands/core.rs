use super::*;

pub(super) async fn cmd_launch(ctx: &mut AppContext, args: &[String]) -> Result<()> {
    // Parse --browser <name> argument, fall back to config
    let preferred_browser = args.windows(2).find_map(|pair| {
        if pair[0] == "--browser" {
            Some(pair[1].clone())
        } else {
            None
        }
    }).or_else(|| crate::config::load_config().browser);

    // Parse --profile <name> argument
    let profile = args.windows(2).find_map(|pair| {
        if pair[0] == "--profile" {
            Some(pair[1].clone())
        } else {
            None
        }
    }).unwrap_or_else(|| "default".to_string());

    // Handle --profile new: generate random ID
    let profile = if profile == "new" {
        format!("webact-{:08x}", rand::random::<u32>())
    } else {
        profile
    };

    ctx.current_profile = profile.clone();

    let user_data_dir = ctx.chrome_profile_dir_for(&profile);
    let port_file = ctx.chrome_port_file_for(&profile);

    if let Ok(saved) = fs::read_to_string(&port_file) {
        if let Ok(saved_port) = saved.trim().parse::<u16>() {
            ctx.cdp_port = saved_port;
            if get_debug_tabs(ctx).await.is_ok() {
                // Bug fix: error if --browser specified and differs from running browser
                if profile == "default" {
                    if let Some(ref wanted) = preferred_browser {
                        let running = detect_browser_from_port(ctx).await.unwrap_or_default();
                        if !running.to_lowercase().contains(&wanted.to_lowercase()) {
                            bail!("Default browser already running ({running}). Use --profile <name> to launch a separate {wanted} instance.");
                        }
                    }
                }
                ctx.launch_browser_name = detect_browser_from_port(ctx).await;
                out!(ctx, "Browser already running.");
                cmd_connect(ctx).await?;
                return Ok(());
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

    let browser = if let Some(ref name) = preferred_browser {
        find_browser_by_name(name).ok_or_else(|| {
            anyhow!("Browser '{name}' not found. Available: chrome, edge, brave, arc, vivaldi, chromium")
        })?
    } else {
        find_browser().ok_or_else(|| {
            anyhow!(
                "No Chromium-based browser found. Install Chrome/Edge/Brave/Chromium or set CHROME_PATH."
            )
        })?
    };
    ctx.launch_browser_name = Some(browser.name.clone());

    // Migrate legacy profile from $TMPDIR to ~/.webact/profiles/default
    if profile == "default" && !user_data_dir.exists() {
        let legacy = env::temp_dir().join("webact-chrome-profile");
        if legacy.is_dir() {
            fs::create_dir_all(user_data_dir.parent().unwrap())?;
            if fs::rename(&legacy, &user_data_dir).is_ok() {
                eprintln!("Migrated Chrome profile to {}", user_data_dir.display());
            }
        }
    }

    fs::create_dir_all(&user_data_dir)
        .with_context(|| format!("failed creating {}", user_data_dir.display()))?;

    let chrome_args = [
        format!("--remote-debugging-port={}", ctx.cdp_port),
        format!("--user-data-dir={}", user_data_dir.to_string_lossy()),
        "--no-first-run".to_string(),
        "--no-default-browser-check".to_string(),
    ];

    let mut command = {
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

    // Wait for Chrome to start and expose at least one tab
    let mut ready = false;
    for _ in 0..30 {
        sleep(Duration::from_millis(500)).await;
        if let Ok(tabs) = get_debug_tabs(ctx).await {
            if !tabs.is_empty() {
                ready = true;
                break;
            }
        }
    }
    if !ready {
        bail!(
            "{} launched but debug port not responding after 15s.",
            browser.name
        );
    }

    // Snapshot Chrome's initial default tabs before creating the session window
    let initial_tabs: Vec<String> = get_debug_tabs(ctx)
        .await
        .map(|tabs| tabs.iter().map(|t| t.id.clone()).collect())
        .unwrap_or_default();

    fs::write(&port_file, ctx.cdp_port.to_string())
        .with_context(|| format!("failed writing {}", port_file.display()))?;
    out!(ctx, "{} launched successfully.", browser.name);
    if profile != "default" {
        out!(ctx, "Profile: {profile}");
    }

    let has_own_window = cmd_connect(ctx).await?;

    // Close Chrome's default initial window — the agent uses its own window.
    // Only safe when cmd_connect created a dedicated window (not a tab fallback).
    if has_own_window {
        for tab_id in &initial_tabs {
            let _ = http_put_text(ctx, &format!("/json/close/{tab_id}")).await;
        }
    }

    Ok(())
}

/// Returns `true` if the session got its own dedicated window.
pub(super) async fn cmd_connect(ctx: &mut AppContext) -> Result<bool> {
    let session_id = new_session_id();
    ctx.set_current_session(session_id.clone());

    // In MCP mode, create a new window for isolation so agents don't
    // confuse each other's tabs. In CLI mode, use a regular tab.
    let (new_tab, has_own_window) = if ctx.mcp_mode {
        match create_new_window(ctx, None).await {
            Ok(tab) => (tab, true),
            Err(e) => {
                eprintln!("New window failed ({e}), falling back to tab");
                (create_new_tab(ctx, None).await?, false)
            }
        }
    } else {
        (create_new_tab(ctx, None).await?, false)
    };

    // Immediately minimize the new window so it doesn't steal focus.
    if has_own_window {
        if let Some(ws_url) = &new_tab.web_socket_debugger_url {
            if let Ok(wid) = get_window_id_for_target(ctx, ws_url).await {
                let _ = minimize_window_by_id(ctx, ws_url, wid).await;
            }
        }
    }

    // Only capture window_id when this session owns its own window.
    // If we fell back to create_new_tab, the window is shared and we must not
    // auto-minimize it (that would interfere with other agents/user tabs).
    let window_id = if has_own_window {
        if let Some(ws_url) = &new_tab.web_socket_debugger_url {
            get_window_id_for_target(ctx, ws_url).await.ok()
        } else {
            None
        }
    } else {
        None
    };

    // If browser_name wasn't set (attach-to-existing path), detect from debug port
    if ctx.launch_browser_name.is_none() {
        ctx.launch_browser_name = detect_browser_from_port(ctx).await;
    }

    let state = SessionState {
        session_id: session_id.clone(),
        active_tab_id: Some(new_tab.id.clone()),
        tabs: vec![new_tab.id.clone()],
        port: Some(ctx.cdp_port),
        host: Some(ctx.cdp_host.clone()),
        browser_name: ctx.launch_browser_name.clone(),
        window_id,
        profile: if ctx.current_profile != "default" { Some(ctx.current_profile.clone()) } else { None },
        ..SessionState::default()
    };
    ctx.save_session_state(&state)?;
    fs::write(ctx.last_session_file(), &session_id)
        .context("failed writing last session pointer")?;

    out!(ctx, "Session: {session_id}");
    out!(ctx, "Command file: {}", ctx.command_file(&session_id).display());
    Ok(has_own_window)
}

pub(super) async fn cmd_kill(ctx: &mut AppContext) -> Result<()> {
    let state = ctx.load_session_state()?;
    let profile = state.profile.clone().unwrap_or_else(|| "default".to_string());

    if profile == "default" {
        bail!("Cannot kill default profile. Use 'close' to close your tabs.");
    }

    // Get the port for this profile's browser
    let port_file = ctx.chrome_port_file_for(&profile);
    if let Ok(port_str) = fs::read_to_string(&port_file) {
        if let Ok(port) = port_str.trim().parse::<u16>() {
            // Try to close the browser gracefully via CDP
            let old_port = ctx.cdp_port;
            ctx.cdp_port = port;
            if let Ok(mut cdp) = open_cdp(ctx).await {
                let _ = cdp.send("Browser.close", json!({})).await;
            }
            ctx.cdp_port = old_port;
        }
    }

    // Clean up files
    let _ = fs::remove_file(&port_file);
    let profile_dir = ctx.chrome_profile_dir_for(&profile);
    let _ = fs::remove_dir_all(&profile_dir);

    // Clean up session state file
    let session_id = ctx.require_session_id()?.to_string();
    let _ = fs::remove_file(ctx.session_state_file(&session_id));

    out!(ctx, "Killed profile '{profile}' and cleaned up.");
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

    if dom_output.is_empty() {
        if let Some(sel) = selector {
            out!(ctx, "Element matched but has no visible DOM content: {sel}");
        }
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

    // Wait for JS-loaded content: no network activity for 800ms, up to 5s total
    wait_for_network_idle(&mut cdp, 800, 5000).await?;

    let context_id = get_frame_context_id(ctx, &mut cdp).await?;
    let result = runtime_evaluate_with_context(&mut cdp, &script, true, false, context_id).await?;
    let mut output = result
        .pointer("/result/value")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    // If extraction returned too little content, wait longer and retry
    if output.len() < 200 && selector.is_none() {
        wait_for_network_idle(&mut cdp, 1000, 5000).await?;
        let retry = runtime_evaluate_with_context(&mut cdp, &script, true, false, context_id).await?;
        let retry_text = retry
            .pointer("/result/value")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if retry_text.len() > output.len() {
            output = retry_text.to_string();
        }
    }

    // Last resort: fall back to innerText if structured extraction got almost nothing
    if output.len() < 100 && selector.is_none() {
        let fallback = runtime_evaluate_with_context(
            &mut cdp,
            "document.body?.innerText?.substring(0, 50000) || ''",
            true,
            false,
            context_id,
        )
        .await?;
        let fallback_text = fallback
            .pointer("/result/value")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if fallback_text.len() > output.len() {
            output = fallback_text.to_string();
        }
    }

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

    // Only activate in Chrome when running as CLI (not MCP) to avoid
    // disrupting other agents sharing the same Chrome instance.
    if !ctx.mcp_mode {
        let _ = http_put_text(ctx, &format!("/json/activate/{tab_id}")).await;
    }
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

pub(super) async fn cmd_screenshot(ctx: &mut AppContext, args: &[String]) -> Result<()> {
    // Parse args
    let mut selector: Option<String> = None;
    let mut format = "jpeg".to_string();
    let mut quality: u32 = 80;
    let mut ref_id: Option<String> = None;
    let mut pad: u32 = 48;
    let mut full_page = false;
    let mut output_path: Option<String> = None;
    let mut scale_factor: Option<f64> = None;

    for arg in args {
        if let Some(v) = arg.strip_prefix("--output=") {
            output_path = Some(v.to_string());
        } else if let Some(v) = arg.strip_prefix("--selector=") {
            selector = Some(v.to_string());
        } else if let Some(v) = arg.strip_prefix("--format=") {
            format = if v == "png" { "png".to_string() } else { "jpeg".to_string() };
        } else if let Some(v) = arg.strip_prefix("--quality=") {
            quality = v.parse().unwrap_or(80).clamp(1, 100);
        } else if let Some(v) = arg.strip_prefix("--ref=") {
            ref_id = Some(v.to_string());
        } else if let Some(v) = arg.strip_prefix("--pad=") {
            pad = v.parse().unwrap_or(48);
        } else if arg == "--full" {
            full_page = true;
        } else if let Some(v) = arg.strip_prefix("--scale=") {
            scale_factor = v.parse().ok();
        }
    }

    // Resolve ref to selector if provided
    if let Some(rid) = &ref_id {
        selector = Some(resolve_selector(ctx, rid)?);
    }

    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;

    // Build CDP params
    let mut params = json!({ "format": &format });

    if format == "jpeg" {
        params["quality"] = json!(quality);
    }

    // If selector given, get element bounding rect for clip region
    if let Some(sel) = &selector {
        let context_id = get_frame_context_id(ctx, &mut cdp).await?;
        let pad_val = if ref_id.is_some() { pad } else { 0 };
        let script = format!(
            r#"(function() {{
                const el = document.querySelector({sel});
                if (!el) return {{ error: 'Element not found: ' + {sel} }};
                el.scrollIntoView({{ block: 'center', inline: 'center', behavior: 'instant' }});
                const rect = el.getBoundingClientRect();
                const pad = {pad};
                const x = Math.max(0, rect.x - pad);
                const y = Math.max(0, rect.y - pad);
                const w = rect.width + pad * 2;
                const h = rect.height + pad * 2;
                return {{ x: x, y: y, width: w, height: h }};
            }})()"#,
            sel = serde_json::to_string(sel.as_str())?,
            pad = pad_val
        );
        let result = runtime_evaluate_with_context(&mut cdp, &script, true, false, context_id).await?;
        let value = result.pointer("/result/value").cloned().unwrap_or(Value::Null);
        if let Some(err) = value.get("error").and_then(Value::as_str) {
            bail!("{err}");
        }
        let x = value.get("x").and_then(Value::as_f64).unwrap_or(0.0);
        let y = value.get("y").and_then(Value::as_f64).unwrap_or(0.0);
        let w = value.get("width").and_then(Value::as_f64).unwrap_or(0.0);
        let h = value.get("height").and_then(Value::as_f64).unwrap_or(0.0);
        if w > 0.0 && h > 0.0 {
            params["clip"] = json!({
                "x": x, "y": y, "width": w, "height": h, "scale": 1
            });
        }
    }

    // Get viewport dimensions, device pixel ratio, and full document height
    let vp_result = runtime_evaluate(
        &mut cdp,
        "[window.innerWidth, window.innerHeight, window.devicePixelRatio, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)]",
        true,
        false,
    )
    .await?;
    let vp_arr = vp_result
        .pointer("/result/value")
        .and_then(Value::as_array);
    let viewport_w = vp_arr
        .and_then(|a| a.first())
        .and_then(Value::as_f64)
        .unwrap_or(1280.0);
    let viewport_h = vp_arr
        .and_then(|a| a.get(1))
        .and_then(Value::as_f64)
        .unwrap_or(800.0);
    let dpr = vp_arr
        .and_then(|a| a.get(2))
        .and_then(Value::as_f64)
        .unwrap_or(1.0);
    let doc_height = vp_arr
        .and_then(|a| a.get(3))
        .and_then(Value::as_f64)
        .unwrap_or(viewport_h);

    // Scale: explicit --scale overrides, otherwise default to 800px wide.
    // Ref/selector crops default to 1x CSS pixels (already small).
    let capture_h = if full_page { doc_height } else { viewport_h };
    let has_clip = params.get("clip").is_some();
    let effective_scale = if let Some(sf) = scale_factor {
        Some(sf / dpr)
    } else if has_clip && ref_id.is_some() {
        if dpr > 1.0 { Some(1.0 / dpr) } else { None }
    } else {
        Some(800.0 / (viewport_w * dpr))
    };

    if let Some(scale) = effective_scale {
        if let Some(clip) = params.get_mut("clip") {
            clip["scale"] = json!(scale);
        } else {
            params["clip"] = json!({
                "x": 0, "y": 0,
                "width": viewport_w,
                "height": capture_h,
                "scale": scale
            });
        }
    } else if full_page && !has_clip {
        // Full page without scaling — set clip to full document height
        params["clip"] = json!({
            "x": 0, "y": 0,
            "width": viewport_w,
            "height": capture_h,
            "scale": 1
        });
    }

    // captureBeyondViewport is needed for full-page screenshots
    if full_page {
        params["captureBeyondViewport"] = json!(true);
    }

    let result = cdp.send("Page.captureScreenshot", params.clone()).await?;
    let data = result
        .get("data")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow!("Missing screenshot data"))?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data)
        .context("Failed to decode screenshot data")?;

    let ext = if format == "png" { "png" } else { "jpeg" };
    let out = if let Some(ref p) = output_path {
        PathBuf::from(p)
    } else {
        let sid = ctx
            .current_session_id
            .clone()
            .unwrap_or_else(|| "default".to_string());
        ctx.tmp_dir().join(format!("webact-screenshot-{sid}.{ext}"))
    };

    fs::write(&out, &bytes).with_context(|| format!("failed writing {}", out.display()))?;

    // Estimate token cost and include in output
    let file_kb = bytes.len() / 1024;
    let est_tokens = if let Some(clip) = params.get("clip") {
        let cw = clip.get("width").and_then(Value::as_f64).unwrap_or(viewport_w);
        let ch = clip.get("height").and_then(Value::as_f64).unwrap_or(viewport_h);
        let cs = clip.get("scale").and_then(Value::as_f64).unwrap_or(1.0);
        let pw = (cw * cs) as u64;
        let ph = (ch * cs) as u64;
        (pw * ph) / 750
    } else {
        let pw = (viewport_w / dpr) as u64;
        let ph = (viewport_h / dpr) as u64;
        (pw * ph) / 750
    };
    out!(ctx, "Screenshot saved to {}", out.display());
    out!(ctx, "Size: {}KB | Est. vision tokens: ~{}", file_kb, est_tokens);
    if est_tokens > 500 && ref_id.is_none() && selector.is_none() {
        out!(ctx, "Tip: Use ref=N, selector, or --width to reduce cost.");
    }
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

pub(super) async fn cmd_grid(ctx: &mut AppContext, args: &[String]) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let context_id = get_frame_context_id(ctx, &mut cdp).await?;

    let first = args.first().map(String::as_str).unwrap_or("");

    if first == "off" {
        runtime_evaluate_with_context(
            &mut cdp,
            "document.getElementById('webact-grid-overlay')?.remove()",
            false,
            false,
            context_id,
        ).await?;
        out!(ctx, "Grid overlay removed.");
        return Ok(());
    }

    // Parse grid spec: "8x6" (cols x rows), "50" (px cell size), or empty (10x10)
    let (cols, rows) = if first.is_empty() {
        (10, 10)
    } else if first.contains('x') {
        let parts: Vec<&str> = first.split('x').collect();
        let c = parts[0].parse::<u32>().unwrap_or(10);
        let r = parts.get(1).and_then(|s| s.parse::<u32>().ok()).unwrap_or(10);
        (c, r)
    } else if let Ok(px) = first.parse::<u32>() {
        // px cell size — we'll compute cols/rows from viewport in JS
        // Pass as negative to signal "pixel mode"
        (px, 0) // special: rows=0 means px mode
    } else {
        (10, 10)
    };

    let script = if rows == 0 {
        // Pixel mode: cols holds the cell size in px
        format!(r#"(function() {{
            document.getElementById('webact-grid-overlay')?.remove();
            const px = {cols};
            const vw = window.innerWidth, vh = window.innerHeight;
            const c = Math.ceil(vw / px), r = Math.ceil(vh / px);
            const d = document.createElement('div');
            d.id = 'webact-grid-overlay';
            d.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:999999;pointer-events:none;display:grid;grid-template-columns:repeat('+c+',1fr);grid-template-rows:repeat('+r+',1fr)';
            for (let row = 0; row < r; row++) {{
                for (let col = 0; col < c; col++) {{
                    const cell = document.createElement('div');
                    const cx = Math.round(col * px + px/2);
                    const cy = Math.round(row * px + px/2);
                    cell.style.cssText = 'border:1px solid rgba(255,0,0,0.3);display:flex;align-items:center;justify-content:center;font:9px monospace;color:rgba(255,0,0,0.7);background:rgba(255,255,255,0.05)';
                    cell.textContent = cx+','+cy;
                    d.appendChild(cell);
                }}
            }}
            document.body.appendChild(d);
            return {{ cols: c, rows: r, cellPx: px }};
        }})()"#)
    } else {
        format!(r#"(function() {{
            document.getElementById('webact-grid-overlay')?.remove();
            const cols = {cols}, rows = {rows};
            const vw = window.innerWidth, vh = window.innerHeight;
            const cw = vw / cols, ch = vh / rows;
            const d = document.createElement('div');
            d.id = 'webact-grid-overlay';
            d.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:999999;pointer-events:none;display:grid;grid-template-columns:repeat('+cols+',1fr);grid-template-rows:repeat('+rows+',1fr)';
            for (let row = 0; row < rows; row++) {{
                for (let col = 0; col < cols; col++) {{
                    const cell = document.createElement('div');
                    const cx = Math.round(col * cw + cw/2);
                    const cy = Math.round(row * ch + ch/2);
                    cell.style.cssText = 'border:1px solid rgba(255,0,0,0.3);display:flex;align-items:center;justify-content:center;font:9px monospace;color:rgba(255,0,0,0.7);background:rgba(255,255,255,0.05)';
                    cell.textContent = cx+','+cy;
                    d.appendChild(cell);
                }}
            }}
            document.body.appendChild(d);
            return {{ cols, rows, cellW: Math.round(cw), cellH: Math.round(ch) }};
        }})()"#)
    };

    let result = runtime_evaluate_with_context(&mut cdp, &script, true, false, context_id).await?;

    if let Some(val) = result.pointer("/result/value") {
        let c = val.get("cols").and_then(Value::as_u64).unwrap_or(0);
        let r = val.get("rows").and_then(Value::as_u64).unwrap_or(0);
        out!(ctx, "Grid overlay: {c}x{r}. Each cell shows its center coordinate. Use 'grid off' to remove.");
    } else {
        out!(ctx, "Grid overlay applied.");
    }

    Ok(())
}

pub(super) async fn cmd_setup(_ctx: &mut AppContext) -> Result<()> {
    crate::mcp_clients::configure_clients();
    Ok(())
}

pub(super) async fn cmd_uninstall(_ctx: &mut AppContext) -> Result<()> {
    crate::mcp_clients::remove_clients();
    Ok(())
}
