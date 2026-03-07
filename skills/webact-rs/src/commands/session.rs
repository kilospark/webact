use super::*;

pub(super) async fn cmd_download(ctx: &mut AppContext, args: &[String]) -> Result<()> {
    let action = args.first().map(String::as_str).unwrap_or("path");
    let mut state = ctx.load_session_state()?;
    let download_dir = state
        .download_dir
        .clone()
        .map(PathBuf::from)
        .unwrap_or_else(|| ctx.default_download_dir());

    match action {
        "path" => {
            let dir = args
                .get(1)
                .map(PathBuf::from)
                .unwrap_or_else(|| download_dir.clone());
            fs::create_dir_all(&dir)
                .with_context(|| format!("failed creating {}", dir.display()))?;
            state.download_dir = Some(dir.to_string_lossy().to_string());
            ctx.save_session_state(&state)?;
            let mut cdp = open_cdp(ctx).await?;
            prepare_cdp(ctx, &mut cdp).await?;
            cdp.send(
                "Browser.setDownloadBehavior",
                json!({
                    "behavior": "allow",
                    "downloadPath": dir.to_string_lossy().to_string()
                }),
            )
            .await?;
            out!(ctx, "Downloads will be saved to: {}", dir.display());
            cdp.close().await;
        }
        "list" => {
            if !download_dir.exists() {
                out!(ctx, "No downloads directory.");
                return Ok(());
            }
            let mut files = fs::read_dir(&download_dir)
                .with_context(|| format!("failed listing {}", download_dir.display()))?
                .filter_map(|e| e.ok())
                .collect::<Vec<_>>();
            files.sort_by_key(|e| e.file_name());
            if files.is_empty() {
                out!(ctx, "No downloaded files.");
            } else {
                for entry in files {
                    let path = entry.path();
                    let name = path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let stat = fs::metadata(&path)
                        .with_context(|| format!("failed stat {}", path.display()))?;
                    let size = human_size(stat.len());
                    out!(ctx, "{} ({})", name, size);
                }
            }
        }
        _ => bail!("Usage: webact-rs download [path <dir>|list]"),
    }
    Ok(())
}

pub(super) async fn cmd_activate(ctx: &mut AppContext) -> Result<()> {
    let state = ctx.load_session_state()?;
    let browser_name = state
        .browser_name
        .or_else(|| find_browser().map(|b| b.name))
        .ok_or_else(|| anyhow!("Cannot determine browser."))?;
    activate_browser(&browser_name)?;
    out!(ctx, "Brought {} to front.", browser_name);
    Ok(())
}

pub(super) async fn cmd_minimize(ctx: &mut AppContext) -> Result<()> {
    let state = ctx.load_session_state()?;
    let browser_name = state
        .browser_name
        .or_else(|| find_browser().map(|b| b.name))
        .ok_or_else(|| anyhow!("Cannot determine browser."))?;
    minimize_browser(&browser_name)?;
    out!(ctx, "Minimized {}.", browser_name);
    Ok(())
}

pub(super) async fn cmd_human_click_dispatch(ctx: &mut AppContext, args: &[String]) -> Result<()> {
    if let Some((x, y)) = parse_coordinates(args) {
        let mut cdp = open_cdp(ctx).await?;
        prepare_cdp(ctx, &mut cdp).await?;
        human_click(&mut cdp, x, y).await?;
        out!(ctx, "Human-clicked at ({x}, {y})");
        sleep(Duration::from_millis(150)).await;
        out!(ctx, "{}", get_page_brief(&mut cdp).await?);
        cdp.close().await;
        return Ok(());
    }
    if args.first().map(String::as_str) == Some("--text") {
        let text = args[1..].join(" ");
        if text.is_empty() {
            bail!("Usage: webact-rs humanclick --text <text>");
        }
        let mut cdp = open_cdp(ctx).await?;
        prepare_cdp(ctx, &mut cdp).await?;
        let loc = locate_element_by_text(ctx, &mut cdp, &text).await?;
        human_click(&mut cdp, loc.x, loc.y).await?;
        out!(ctx,
            "Human-clicked {} \"{}\" (text match)",
            loc.tag.to_lowercase(),
            loc.text
        );
        sleep(Duration::from_millis(150)).await;
        out!(ctx, "{}", get_page_brief(&mut cdp).await?);
        cdp.close().await;
        return Ok(());
    }
    let selector = resolve_selector(ctx, &args.join(" "))?;
    cmd_human_click(ctx, &selector).await
}

pub(super) async fn cmd_human_click(ctx: &mut AppContext, selector: &str) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let loc = locate_element(ctx, &mut cdp, selector).await?;
    human_click(&mut cdp, loc.x, loc.y).await?;
    out!(ctx, "Human-clicked {} \"{}\"", loc.tag.to_lowercase(), loc.text);
    sleep(Duration::from_millis(150)).await;
    out!(ctx, "{}", get_page_brief(&mut cdp).await?);
    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_human_type(ctx: &mut AppContext, selector: &str, text: &str) -> Result<()> {
    if text.is_empty() {
        bail!("Usage: webact-rs humantype <selector> <text>");
    }
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let context_id = get_frame_context_id(ctx, &mut cdp).await?;
    let script = format!(
        "(function() {{ const el = document.querySelector({sel}); if (!el) return {{ error: 'Element not found' }}; el.focus(); if (el.select) el.select(); return {{ ok: true }}; }})()",
        sel = serde_json::to_string(selector)?
    );
    let r = runtime_evaluate_with_context(&mut cdp, &script, true, false, context_id).await?;
    if let Some(err) = r.pointer("/result/value/error").and_then(Value::as_str) {
        bail!("{err}");
    }
    human_type_text(&mut cdp, text, false).await?;
    out!(ctx, "Human-typed \"{}\" into {}", truncate(text, 50), selector);
    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_lock(ctx: &mut AppContext, ttl_seconds: Option<&str>) -> Result<()> {
    let ttl = ttl_seconds
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(300);
    let state = ctx.load_session_state()?;
    let tab_id = state
        .active_tab_id
        .ok_or_else(|| anyhow!("No active tab"))?;
    let sid = ctx.require_session_id()?.to_string();

    if let Some(lock) = check_tab_lock(ctx, &tab_id)? {
        if lock.session_id != sid {
            let remaining = ((lock.expires - now_epoch_ms()).max(0) / 1000) as i64;
            bail!(
                "Tab already locked by session {} (expires in {}s)",
                lock.session_id,
                remaining
            );
        }
    }

    let mut locks = load_tab_locks(ctx)?;
    locks.insert(
        tab_id.clone(),
        TabLock {
            session_id: sid.clone(),
            expires: now_epoch_ms() + ttl * 1000,
        },
    );
    save_tab_locks(ctx, &locks)?;
    out!(ctx, "Tab {} locked for {}s by session {}", tab_id, ttl, sid);
    Ok(())
}

pub(super) async fn cmd_unlock(ctx: &mut AppContext) -> Result<()> {
    let state = ctx.load_session_state()?;
    let tab_id = state
        .active_tab_id
        .ok_or_else(|| anyhow!("No active tab"))?;
    let sid = ctx.require_session_id()?.to_string();
    let mut locks = load_tab_locks(ctx)?;
    let lock = locks.get(&tab_id).cloned();
    match lock {
        None => out!(ctx, "Tab is not locked."),
        Some(l) if l.session_id != sid => {
            bail!("Tab is locked by session {}, not yours.", l.session_id)
        }
        Some(_) => {
            locks.remove(&tab_id);
            save_tab_locks(ctx, &locks)?;
            out!(ctx, "Tab {} unlocked.", tab_id);
        }
    }
    Ok(())
}
