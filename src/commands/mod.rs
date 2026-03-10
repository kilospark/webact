use crate::*;

mod core;
mod data;
mod interaction;
mod session;

use core::*;
use data::*;
use interaction::*;
use session::*;

pub async fn dispatch(ctx: &mut AppContext, command: &str, args: &[String]) -> Result<()> {
    match command {
        "launch" => cmd_launch(ctx).await,
        "connect" => cmd_connect(ctx).await,
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
        "activate" => cmd_activate(ctx).await,
        "minimize" => cmd_minimize(ctx).await,
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
        _ => bail!("Unknown command: {command}"),
    }
}
