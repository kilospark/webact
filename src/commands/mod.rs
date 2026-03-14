use crate::*;

mod batch;
mod core;
mod data;
mod interaction;
mod session;

use batch::*;
use core::*;
use data::*;
use interaction::*;
use session::*;

pub async fn dispatch(ctx: &mut AppContext, command: &str, args: &[String]) -> Result<()> {
    match command {
        "launch" => cmd_launch(ctx, args).await,
        "connect" => cmd_connect(ctx).await.map(|_| ()),
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
        "dom" => {
            let mut max_tokens = 0usize;
            let mut selector_parts = Vec::new();
            for arg in args {
                if let Some(raw) = arg.strip_prefix("--tokens=") {
                    max_tokens = raw.parse::<usize>().unwrap_or(0);
                } else if arg != "--full" {
                    selector_parts.push(arg.clone());
                }
            }

            let selector = if selector_parts.is_empty() {
                None
            } else {
                Some(resolve_selector(ctx, &selector_parts.join(" "))?)
            };
            cmd_dom(ctx, selector.as_deref(), max_tokens).await
        }
        "read" => {
            let mut max_tokens = 0usize;
            let mut selector_parts = Vec::new();
            for arg in args {
                if let Some(raw) = arg.strip_prefix("--tokens=") {
                    max_tokens = raw.parse::<usize>().unwrap_or(0);
                } else {
                    selector_parts.push(arg.clone());
                }
            }
            let selector = if selector_parts.is_empty() {
                None
            } else {
                Some(resolve_selector(ctx, &selector_parts.join(" "))?)
            };
            cmd_read(ctx, selector.as_deref(), max_tokens).await
        }
        "text" => {
            let mut max_tokens = 0usize;
            let mut selector_parts = Vec::new();
            for arg in args {
                if let Some(raw) = arg.strip_prefix("--tokens=") {
                    max_tokens = raw.parse::<usize>().unwrap_or(0);
                } else {
                    selector_parts.push(arg.clone());
                }
            }
            let selector = if selector_parts.is_empty() {
                None
            } else {
                Some(resolve_selector(ctx, &selector_parts.join(" "))?)
            };
            cmd_text(ctx, selector.as_deref(), max_tokens).await
        }
        "axtree" => {
            let interactive = args.iter().any(|a| a == "-i" || a == "--interactive");
            let diff = args.iter().any(|a| a == "--diff");
            let selector = args
                .iter()
                .filter(|a| !matches!(a.as_str(), "-i" | "--interactive" | "--diff"))
                .find(|a| !a.starts_with("--tokens="))
                .map(|s| s.as_str());
            let max_tokens = args
                .iter()
                .find_map(|a| a.strip_prefix("--tokens="))
                .and_then(|v| v.parse::<usize>().ok())
                .unwrap_or(0);
            if interactive {
                cmd_axtree_interactive(ctx, max_tokens, diff).await
            } else {
                // Default cap for full axtree to prevent 1M+ char output
                let effective_max = if max_tokens > 0 { max_tokens } else { 4000 };
                cmd_axtree_full(ctx, selector, effective_max).await
            }
        }
        "screenshot" => cmd_screenshot(ctx, args).await,
        "pdf" => cmd_pdf(ctx, args.first().map(String::as_str)).await,
        "click" => {
            if args.is_empty() {
                bail!("Usage: webact click <sel|x,y|--text>");
            }
            cmd_click_dispatch(ctx, args).await
        }
        "doubleclick" => {
            if args.is_empty() {
                bail!("Usage: webact doubleclick <sel|x,y|--text>");
            }
            cmd_double_click_dispatch(ctx, args).await
        }
        "rightclick" => {
            if args.is_empty() {
                bail!("Usage: webact rightclick <sel|x,y|--text>");
            }
            cmd_right_click_dispatch(ctx, args).await
        }
        "hover" => {
            if args.is_empty() {
                bail!("Usage: webact hover <sel|x,y|--text>");
            }
            cmd_hover_dispatch(ctx, args).await
        }
        "focus" => {
            let selector = resolve_selector(ctx, &args.join(" "))?;
            cmd_focus(ctx, &selector).await
        }
        "clear" => {
            let selector = resolve_selector(ctx, &args.join(" "))?;
            cmd_clear(ctx, &selector).await
        }
        "type" => {
            let selector_arg = args
                .first()
                .cloned()
                .context("Usage: webact type <selector> <text>")?;
            let text = args.iter().skip(1).cloned().collect::<Vec<_>>().join(" ");
            if text.is_empty() {
                bail!("Usage: webact type <selector> <text>");
            }
            let selector = resolve_selector(ctx, &selector_arg)?;
            cmd_type(ctx, &selector, &text).await
        }
        "fill" => {
            let fields: Vec<(String, String)> = args.chunks(2)
                .filter(|c| c.len() == 2)
                .map(|c| (c[0].clone(), c[1].clone()))
                .collect();
            cmd_fill(ctx, &fields).await
        }
        "keyboard" => cmd_keyboard(ctx, &args.join(" ")).await,
        "paste" => cmd_paste(ctx, &args.join(" ")).await,
        "select" => {
            let selector = args
                .first()
                .cloned()
                .context("Usage: webact select <selector> <value> [value2...]")?;
            let selector = resolve_selector(ctx, &selector)?;
            cmd_select(ctx, &selector, &args[1..]).await
        }
        "upload" => {
            let selector = args
                .first()
                .cloned()
                .context("Usage: webact upload <selector> <file> [file2...]")?;
            let selector = resolve_selector(ctx, &selector)?;
            cmd_upload(ctx, &selector, &args[1..]).await
        }
        "drag" => {
            if args.len() < 2 {
                bail!("Usage: webact drag <from> <to>");
            }
            let from = resolve_selector(ctx, &args[0])?;
            let to = resolve_selector(ctx, &args[1])?;
            cmd_drag(ctx, &from, &to).await
        }
        "dialog" => cmd_dialog(ctx, args.first().map(String::as_str), &args[1..]).await,
        "waitfor" => {
            let selector = args
                .first()
                .cloned()
                .context("Usage: webact waitfor <selector> [timeout_ms]")?;
            let selector = resolve_selector(ctx, &selector)?;
            cmd_wait_for(ctx, &selector, args.get(1).map(String::as_str)).await
        }
        "waitfornav" => cmd_wait_for_nav(ctx, args.first().map(String::as_str)).await,
        "press" => {
            let key = args
                .first()
                .cloned()
                .context("Usage: webact press <key>")?;
            cmd_press(ctx, &key).await
        }
        "scroll" => cmd_scroll(ctx, args).await,
        "eval" => cmd_eval(ctx, &args.join(" ")).await,
        "observe" => cmd_observe(ctx).await,
        "find" => cmd_find(ctx, &args.join(" ")).await,
        "cookies" => cmd_cookies(ctx, args).await,
        "console" => cmd_console(ctx, args.first().map(String::as_str)).await,
        "network" => cmd_network(ctx, args).await,
        "block" => cmd_block(ctx, args).await,
        "viewport" => {
            cmd_viewport(
                ctx,
                args.first().map(String::as_str),
                args.get(1).map(String::as_str),
            )
            .await
        }
        "zoom" => cmd_zoom(ctx, args.first().map(String::as_str)).await,
        "frames" => cmd_frames(ctx).await,
        "frame" => cmd_frame(ctx, args.first().map(String::as_str)).await,
        "download" => cmd_download(ctx, args).await,
        "tabs" => cmd_tabs(ctx).await,
        "tab" => {
            let id = args.first().cloned().context("Usage: webact tab <id>")?;
            cmd_tab(ctx, &id).await
        }
        "newtab" => {
            let url = args.first().cloned();
            cmd_new_tab(ctx, url.as_deref()).await
        }
        "close" => cmd_close(ctx).await,
        "kill" => cmd_kill(ctx).await,
        "batch" => Box::pin(cmd_batch(ctx, args)).await,
        "media" => cmd_media(ctx, args).await,
        "animations" => cmd_animations(ctx, args.first().map(String::as_str)).await,
        "security" => cmd_security(ctx, args).await,
        "storage" => cmd_storage(ctx, args).await,
        "sw" => cmd_sw(ctx, args).await,
        "activate" => cmd_activate(ctx).await,
        "minimize" => cmd_minimize(ctx).await,
        "grid" => cmd_grid(ctx, args).await,
        "humanclick" => cmd_human_click_dispatch(ctx, args).await,
        "humantype" => {
            if args.len() < 2 {
                bail!("Usage: webact humantype <selector> <text>");
            }
            let selector = resolve_selector(ctx, &args[0])?;
            let text = args[1..].join(" ");
            cmd_human_type(ctx, &selector, &text).await
        }
        "lock" => cmd_lock(ctx, args.first().map(String::as_str)).await,
        "unlock" => cmd_unlock(ctx).await,
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
        "back" => cmd_back(ctx).await,
        "forward" => cmd_forward(ctx).await,
        "reload" => cmd_reload(ctx).await,
        "feedback" => {
            let rating: u8 = args
                .first()
                .and_then(|s| s.parse().ok())
                .unwrap_or(0);
            let comment = args.get(1).map(String::as_str).unwrap_or("");
            let config = crate::config::load_config();
            if !config.feedback {
                out!(ctx, "Feedback is disabled. Enable with: webact config set feedback true");
                return Ok(());
            }
            if rating < 1 || rating > 5 {
                bail!("Rating must be 1-5");
            }
            match crate::api_client::send_feedback(
                &ctx.session_id,
                env!("CARGO_PKG_VERSION"),
                rating,
                comment,
            )
            .await
            {
                Ok(_) => out!(ctx, "Feedback sent. Thank you!"),
                Err(e) => out!(ctx, "Failed to send feedback: {e}"),
            }
            Ok(())
        }
        "install" => cmd_setup(ctx).await,
        "uninstall" => cmd_uninstall(ctx).await,
        "config" => {
            let action = args.first().map(String::as_str).unwrap_or("get");
            match action {
                "get" => {
                    let config = crate::config::load_config();
                    let json = serde_json::to_string_pretty(&config)?;
                    out!(ctx, "{json}");
                    Ok(())
                }
                "set" => {
                    let key = args.get(1).map(String::as_str).unwrap_or("");
                    let raw_value = args.get(2).map(String::as_str).unwrap_or("true");
                    let mut config = crate::config::load_config();
                    match key {
                        "telemetry" => config.telemetry = raw_value == "true",
                        "feedback" => config.feedback = raw_value == "true",
                        "browser" => {
                            if raw_value == "false" || raw_value == "none" || raw_value == "default" {
                                config.browser = None;
                                crate::config::save_config(&config)?;
                                out!(ctx, "Cleared browser preference (will use system default)");
                                return Ok(());
                            }
                            // Validate the browser name
                            if find_browser_by_name(raw_value).is_none() {
                                bail!("Browser '{raw_value}' not found. Available: chrome, edge, brave, arc, vivaldi, chromium, canary");
                            }
                            config.browser = Some(raw_value.to_string());
                        }
                        _ => bail!("Unknown config key: {key}. Valid keys: telemetry, feedback, browser"),
                    }
                    crate::config::save_config(&config)?;
                    out!(ctx, "Set {key} = {raw_value}");
                    Ok(())
                }
                _ => bail!("Usage: config get | config set <key> <true|false>"),
            }
        }
        _ => bail!("Unknown command: {command}"),
    }
}
