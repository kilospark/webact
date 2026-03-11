use super::*;

pub(super) async fn cmd_cookies(ctx: &mut AppContext, args: &[String]) -> Result<()> {
    let action = args
        .first()
        .map(|s| s.to_lowercase())
        .unwrap_or_else(|| "get".to_string());
    match action.as_str() {
        "get" => {
            let mut cdp = open_cdp(ctx).await?;
            prepare_cdp(ctx, &mut cdp).await?;
            let result = cdp.send("Network.getCookies", json!({})).await?;
            let cookies = result
                .get("cookies")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            if cookies.is_empty() {
                out!(ctx, "No cookies.");
            } else {
                for c in cookies {
                    let name = c.get("name").and_then(Value::as_str).unwrap_or("");
                    let value = c.get("value").and_then(Value::as_str).unwrap_or("");
                    let domain = c.get("domain").and_then(Value::as_str).unwrap_or("");
                    let expires = c.get("expires").and_then(Value::as_f64).unwrap_or(-1.0);
                    let mut flags = Vec::new();
                    if c.get("httpOnly").and_then(Value::as_bool).unwrap_or(false) {
                        flags.push("httpOnly");
                    }
                    if c.get("secure").and_then(Value::as_bool).unwrap_or(false) {
                        flags.push("secure");
                    }
                    if c.get("session").and_then(Value::as_bool).unwrap_or(false) {
                        flags.push("session");
                    }
                    let exp = if expires > 0.0 {
                        format!(" exp:{}", epoch_to_date(expires as i64))
                    } else {
                        String::new()
                    };
                    out!(ctx,
                        "{}={} ({}{} {})",
                        name,
                        truncate(value, 60),
                        domain,
                        exp,
                        flags.join(" ")
                    );
                }
            }
            cdp.close().await;
        }
        "set" => {
            if args.len() < 3 {
                bail!("Usage: webact cookies set <name> <value> [domain]");
            }
            let name = args[1].clone();
            let value = args[2].clone();
            let mut cdp = open_cdp(ctx).await?;
            prepare_cdp(ctx, &mut cdp).await?;
            let domain = if args.len() > 3 {
                args[3].clone()
            } else {
                runtime_evaluate(&mut cdp, "location.hostname", true, false)
                    .await?
                    .pointer("/result/value")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string()
            };
            cdp.send(
                "Network.setCookie",
                json!({ "name": name, "value": value, "domain": domain, "path": "/" }),
            )
            .await?;
            out!(ctx, "Cookie set: {}={} ({})", name, truncate(&value, 40), domain);
            cdp.close().await;
        }
        "clear" => {
            let mut cdp = open_cdp(ctx).await?;
            prepare_cdp(ctx, &mut cdp).await?;
            cdp.send("Network.clearBrowserCookies", json!({})).await?;
            out!(ctx, "All cookies cleared.");
            cdp.close().await;
        }
        "delete" => {
            if args.len() < 2 {
                bail!("Usage: webact cookies delete <name> [domain]");
            }
            let name = args[1].clone();
            let mut cdp = open_cdp(ctx).await?;
            prepare_cdp(ctx, &mut cdp).await?;
            let domain = if args.len() > 2 {
                args[2].clone()
            } else {
                runtime_evaluate(&mut cdp, "location.hostname", true, false)
                    .await?
                    .pointer("/result/value")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string()
            };
            cdp.send(
                "Network.deleteCookies",
                json!({ "name": name, "domain": domain }),
            )
            .await?;
            out!(ctx, "Deleted cookie: {} ({})", name, domain);
            cdp.close().await;
        }
        _ => bail!("Usage: webact cookies [get|set|clear|delete] [args]"),
    }
    Ok(())
}

pub(super) async fn cmd_console(ctx: &mut AppContext, action: Option<&str>) -> Result<()> {
    let action = action.unwrap_or("show");
    match action {
        "show" | "errors" => {
            let mut cdp = open_cdp(ctx).await?;
            prepare_cdp(ctx, &mut cdp).await?;
            cdp.send("Runtime.enable", json!({})).await?;
            let deadline = Instant::now() + Duration::from_secs(1);
            let mut logs = Vec::new();
            while Instant::now() < deadline {
                let remain = deadline.saturating_duration_since(Instant::now());
                let Some(event) = cdp.next_event(remain).await? else {
                    break;
                };
                if event.is_null() {
                    continue;
                }
                if event.get("method").and_then(Value::as_str) == Some("Runtime.consoleAPICalled") {
                    let params = event.get("params").cloned().unwrap_or(Value::Null);
                    let event_type = params.get("type").and_then(Value::as_str).unwrap_or("log");
                    if action == "errors" && event_type != "error" {
                        continue;
                    }
                    let args = params
                        .get("args")
                        .and_then(Value::as_array)
                        .cloned()
                        .unwrap_or_default();
                    let text = args
                        .iter()
                        .map(console_arg_to_text)
                        .collect::<Vec<_>>()
                        .join(" ");
                    logs.push(format!("[{}] {}", event_type, truncate(&text, 200)));
                } else if event.get("method").and_then(Value::as_str)
                    == Some("Runtime.exceptionThrown")
                {
                    let params = event.get("params").cloned().unwrap_or(Value::Null);
                    let desc = params
                        .pointer("/exceptionDetails/exception/description")
                        .and_then(Value::as_str)
                        .or_else(|| {
                            params
                                .pointer("/exceptionDetails/text")
                                .and_then(Value::as_str)
                        })
                        .unwrap_or("Unknown error");
                    logs.push(format!("[exception] {}", truncate(desc, 200)));
                }
            }
            if logs.is_empty() {
                out!(ctx, "No console output captured (listened for 1s).");
            } else {
                out!(ctx, "{}", logs.join("\n"));
            }
            cdp.close().await;
        }
        "listen" => {
            let mut cdp = open_cdp(ctx).await?;
            prepare_cdp(ctx, &mut cdp).await?;
            cdp.send("Runtime.enable", json!({})).await?;
            out!(ctx, "Listening for console output (Ctrl+C to stop)...");
            loop {
                let Some(event) = cdp.next_event(Duration::from_secs(60)).await? else {
                    continue;
                };
                if event.is_null() {
                    continue;
                }
                if event.get("method").and_then(Value::as_str) == Some("Runtime.consoleAPICalled") {
                    let params = event.get("params").cloned().unwrap_or(Value::Null);
                    let event_type = params.get("type").and_then(Value::as_str).unwrap_or("log");
                    let args = params
                        .get("args")
                        .and_then(Value::as_array)
                        .cloned()
                        .unwrap_or_default();
                    let text = args
                        .iter()
                        .map(console_arg_to_text)
                        .collect::<Vec<_>>()
                        .join(" ");
                    out!(ctx, "[{}] {}", event_type, truncate(&text, 500));
                } else if event.get("method").and_then(Value::as_str)
                    == Some("Runtime.exceptionThrown")
                {
                    let params = event.get("params").cloned().unwrap_or(Value::Null);
                    let desc = params
                        .pointer("/exceptionDetails/exception/description")
                        .and_then(Value::as_str)
                        .or_else(|| {
                            params
                                .pointer("/exceptionDetails/text")
                                .and_then(Value::as_str)
                        })
                        .unwrap_or("Unknown error");
                    out!(ctx, "[exception] {}", truncate(desc, 500));
                }
            }
        }
        _ => bail!("Usage: webact console [show|errors|listen]"),
    }
    #[allow(unreachable_code)]
    Ok(())
}

pub(super) async fn cmd_network(ctx: &mut AppContext, args: &[String]) -> Result<()> {
    let action = args.first().map(String::as_str).unwrap_or("capture");
    let log_file = ctx.network_log_file();
    match action {
        "capture" => {
            let duration = args
                .get(1)
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(10);
            let filter = args.get(2).cloned();
            let mut cdp = open_cdp(ctx).await?;
            prepare_cdp(ctx, &mut cdp).await?;
            cdp.send("Network.enable", json!({})).await?;
            out!(ctx,
                "Capturing network for {}s{}...",
                duration,
                filter
                    .as_ref()
                    .map(|f| format!(" (filter: \"{f}\")"))
                    .unwrap_or_default()
            );

            let mut requests: Vec<NetworkRequestLog> = Vec::new();
            let start = now_epoch_ms();
            let deadline = Instant::now() + Duration::from_secs(duration);
            while Instant::now() < deadline {
                let remain = deadline.saturating_duration_since(Instant::now());
                let Some(event) = cdp.next_event(remain).await? else {
                    break;
                };
                if event.is_null() {
                    continue;
                }
                match event
                    .get("method")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                {
                    "Network.requestWillBeSent" => {
                        let params = event.get("params").cloned().unwrap_or(Value::Null);
                        let url = params
                            .pointer("/request/url")
                            .and_then(Value::as_str)
                            .unwrap_or_default()
                            .to_string();
                        if filter.as_ref().is_some_and(|f| !url.contains(f)) {
                            continue;
                        }
                        let method = params
                            .pointer("/request/method")
                            .and_then(Value::as_str)
                            .unwrap_or("GET")
                            .to_string();
                        let request_id = params
                            .get("requestId")
                            .and_then(Value::as_str)
                            .unwrap_or_default()
                            .to_string();
                        let req_type = params
                            .get("type")
                            .and_then(Value::as_str)
                            .unwrap_or_default()
                            .to_string();
                        let post_data = params
                            .pointer("/request/postData")
                            .and_then(Value::as_str)
                            .map(|s| truncate(s, 2000));
                        requests.push(NetworkRequestLog {
                            id: request_id,
                            method,
                            url,
                            req_type,
                            time: now_epoch_ms() - start,
                            status: None,
                            status_text: None,
                            mime_type: None,
                            post_data,
                        });
                    }
                    "Network.responseReceived" => {
                        let params = event.get("params").cloned().unwrap_or(Value::Null);
                        let request_id = params
                            .get("requestId")
                            .and_then(Value::as_str)
                            .unwrap_or_default();
                        if let Some(req) = requests.iter_mut().find(|r| r.id == request_id) {
                            req.status = params
                                .pointer("/response/status")
                                .and_then(Value::as_f64)
                                .map(|v| v as i64);
                            req.status_text = params
                                .pointer("/response/statusText")
                                .and_then(Value::as_str)
                                .map(ToString::to_string);
                            req.mime_type = params
                                .pointer("/response/mimeType")
                                .and_then(Value::as_str)
                                .map(ToString::to_string);
                        }
                    }
                    _ => {}
                }
            }

            for r in &requests {
                let status = r
                    .status
                    .map(|s| format!("[{}]", s))
                    .unwrap_or_else(|| "[pending]".to_string());
                out!(ctx,
                    "{} {} {} ({}) +{}ms",
                    r.method,
                    truncate(&r.url, 150),
                    status,
                    if r.req_type.is_empty() {
                        "?"
                    } else {
                        r.req_type.as_str()
                    },
                    r.time
                );
                if let Some(body) = &r.post_data {
                    out!(ctx, "  body: {}", truncate(body, 200));
                }
            }
            out!(ctx, "\n{} requests captured", requests.len());
            fs::write(&log_file, serde_json::to_string_pretty(&requests)?)
                .with_context(|| format!("failed writing {}", log_file.display()))?;
            cdp.close().await;
        }
        "show" => {
            if !log_file.exists() {
                bail!("No captured requests. Run \"network capture\" first.");
            }
            let data = fs::read_to_string(&log_file)
                .with_context(|| format!("failed reading {}", log_file.display()))?;
            let requests: Vec<NetworkRequestLog> = serde_json::from_str(&data)
                .with_context(|| format!("failed parsing {}", log_file.display()))?;
            let filter = args.get(1).cloned();
            let filtered = requests
                .into_iter()
                .filter(|r| filter.as_ref().is_none_or(|f| r.url.contains(f)))
                .collect::<Vec<_>>();
            for r in &filtered {
                let status = r
                    .status
                    .map(|s| format!("[{}]", s))
                    .unwrap_or_else(|| "[pending]".to_string());
                out!(ctx,
                    "{} {} {} ({}) +{}ms",
                    r.method,
                    truncate(&r.url, 150),
                    status,
                    if r.req_type.is_empty() {
                        "?"
                    } else {
                        r.req_type.as_str()
                    },
                    r.time
                );
                if let Some(body) = &r.post_data {
                    out!(ctx, "  body: {}", truncate(body, 200));
                }
            }
            out!(ctx,
                "\n{} requests{}",
                filtered.len(),
                filter
                    .as_ref()
                    .map(|f| format!(" matching \"{}\"", f))
                    .unwrap_or_default()
            );
        }
        _ => bail!("Usage: webact network [capture [seconds] [filter]|show [filter]]"),
    }
    Ok(())
}

pub(super) async fn cmd_block(ctx: &mut AppContext, args: &[String]) -> Result<()> {
    if args.is_empty() {
        bail!(
            "Usage: webact block <pattern> [pattern2...]\nPatterns: images, css, fonts, media, scripts, or URL substring\nUse \"block off\" to disable blocking."
        );
    }
    let mut state = ctx.load_session_state()?;
    if args.first().map(String::as_str) == Some("off") {
        state.block_patterns = None;
        ctx.save_session_state(&state)?;
        out!(ctx, "Request blocking disabled.");
        return Ok(());
    }

    let mut resource_types = Vec::new();
    let mut url_patterns = Vec::new();

    let has_ads = args
        .iter()
        .any(|p| p == "--ads" || p.eq_ignore_ascii_case("ads"));
    if has_ads {
        url_patterns.extend(ADBLOCK_PATTERNS.iter().map(|p| p.to_string()));
    }
    for p in args {
        if p == "--ads" || p.eq_ignore_ascii_case("ads") {
            continue;
        }
        if let Some(rt) = map_resource_type(p) {
            resource_types.push(rt.to_string());
        } else {
            url_patterns.push(p.clone());
        }
    }

    state.block_patterns = Some(BlockPatterns {
        resource_types,
        url_patterns,
    });
    ctx.save_session_state(&state)?;
    if has_ads {
        out!(ctx,
            "Blocking: ads/trackers ({} patterns){}",
            ADBLOCK_PATTERNS.len(),
            if args.len() > 1 {
                format!(" + {}", args.join(", "))
            } else {
                String::new()
            }
        );
    } else {
        out!(ctx,
            "Blocking: {}. Takes effect on next page load.",
            args.join(", ")
        );
    }
    Ok(())
}

pub(super) async fn cmd_viewport(
    ctx: &mut AppContext,
    width: Option<&str>,
    height: Option<&str>,
) -> Result<()> {
    let width = width.ok_or_else(|| {
        anyhow!(
            "Usage: webact viewport <width> <height>\nPresets: mobile, tablet, desktop, iphone, ipad"
        )
    })?;
    let (w, h, dpr, mobile) = match width.to_lowercase().as_str() {
        "mobile" => (375i64, 667i64, 1i64, true),
        "iphone" => (390, 844, 1, true),
        "ipad" => (820, 1180, 1, true),
        "tablet" => (768, 1024, 1, true),
        "desktop" => (1280, 800, 1, false),
        _ => {
            let w = width
                .parse::<i64>()
                .context("Invalid width. Use a number or preset.")?;
            let h = height
                .and_then(|v| v.parse::<i64>().ok())
                .unwrap_or((w as f64 * 0.625).round() as i64);
            (w, h, 1, false)
        }
    };
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    cdp.send(
        "Emulation.setDeviceMetricsOverride",
        json!({
            "width": w,
            "height": h,
            "deviceScaleFactor": dpr,
            "mobile": mobile
        }),
    )
    .await?;
    out!(ctx,
        "Viewport set to {}x{} (dpr:{}{})",
        w,
        h,
        dpr,
        if mobile { " mobile" } else { "" }
    );
    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_zoom(ctx: &mut AppContext, level: Option<&str>) -> Result<()> {
    let mut state = ctx.load_session_state()?;
    let current = state.zoom_level.unwrap_or(100.0);

    let new_level = match level.unwrap_or("") {
        "in" => (current + 25.0).min(200.0),
        "out" => (current - 25.0).max(25.0),
        "reset" | "" => 100.0,
        v => v
            .parse::<f64>()
            .context("Usage: webact zoom <in|out|reset|25-200>")?,
    };

    let new_level = new_level.clamp(25.0, 200.0);
    let zoom_factor = new_level / 100.0;

    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;

    let script = format!(
        "document.documentElement.style.zoom = '{zoom_factor}';"
    );
    runtime_evaluate(&mut cdp, &script, true, false).await?;

    state.zoom_level = if (new_level - 100.0).abs() < 0.01 {
        None
    } else {
        Some(new_level)
    };
    ctx.save_session_state(&state)?;

    out!(ctx, "Zoom: {}%", new_level as u32);
    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_frames(ctx: &mut AppContext) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    cdp.send("Page.enable", json!({})).await?;
    let tree = cdp.send("Page.getFrameTree", json!({})).await?;
    print_frame_tree(&mut ctx.output, tree.get("frameTree").unwrap_or(&Value::Null), 0);
    cdp.close().await;
    Ok(())
}

pub(super) async fn cmd_frame(
    ctx: &mut AppContext,
    frame_id_or_selector: Option<&str>,
) -> Result<()> {
    let frame_id_or_selector = frame_id_or_selector.ok_or_else(|| {
        anyhow!(
            "Usage: webact frame <frameId|selector>\nUse \"webact frames\" to list frames.\nUse \"webact frame main\" to return to main frame."
        )
    })?;
    let mut state = ctx.load_session_state()?;
    if matches!(frame_id_or_selector, "main" | "top") {
        state.active_frame_id = None;
        ctx.save_session_state(&state)?;
        out!(ctx, "Switched to main frame.");
        return Ok(());
    }

    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    cdp.send("Page.enable", json!({})).await?;
    let tree = cdp.send("Page.getFrameTree", json!({})).await?;

    let mut found = find_frame_in_tree(
        tree.get("frameTree").unwrap_or(&Value::Null),
        frame_id_or_selector,
    );

    if found.is_none() {
        let info = runtime_evaluate(
            &mut cdp,
            &format!(
                r#"(function() {{
                const el = document.querySelector({sel});
                if (!el || (el.tagName !== 'IFRAME' && el.tagName !== 'FRAME')) return null;
                return {{ name: el.getAttribute('name') || null, id: el.id || null, src: el.src || null }};
              }})()"#,
                sel = serde_json::to_string(frame_id_or_selector)?
            ),
            true,
            false,
        )
        .await?;
        let info_val = info
            .pointer("/result/value")
            .cloned()
            .unwrap_or(Value::Null);
        if !info_val.is_null() {
            if let Some(name_or_id) = info_val
                .get("name")
                .and_then(Value::as_str)
                .or_else(|| info_val.get("id").and_then(Value::as_str))
            {
                found =
                    find_frame_in_tree(tree.get("frameTree").unwrap_or(&Value::Null), name_or_id);
            }
            if found.is_none() {
                if let Some(src) = info_val.get("src").and_then(Value::as_str) {
                    found = find_frame_by_url(tree.get("frameTree").unwrap_or(&Value::Null), src);
                }
            }
        }
    }

    let frame = found.ok_or_else(|| anyhow!("Frame not found: {}", frame_id_or_selector))?;
    state.active_frame_id = Some(frame.0.clone());
    ctx.save_session_state(&state)?;
    out!(ctx, "Switched to frame: [{}] {}", frame.0, frame.1);
    cdp.close().await;
    Ok(())
}
