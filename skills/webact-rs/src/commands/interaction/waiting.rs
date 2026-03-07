use super::*;

pub(crate) async fn cmd_wait_for(
    ctx: &mut AppContext,
    selector: &str,
    timeout_ms: Option<&str>,
) -> Result<()> {
    let timeout = timeout_ms
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(5000);
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let context_id = get_frame_context_id(ctx, &mut cdp).await?;
    let script = format!(
        r#"(async function() {{
          const sel = {sel};
          const deadline = Date.now() + {timeout};
          while (Date.now() < deadline) {{
            const el = document.querySelector(sel);
            if (el) {{
              return {{
                found: true,
                tag: el.tagName.toLowerCase(),
                text: (el.textContent || '').substring(0, 200).trim()
              }};
            }}
            await new Promise(r => setTimeout(r, 100));
          }}
          return {{ found: false }};
        }})()"#,
        sel = serde_json::to_string(selector)?,
        timeout = timeout
    );
    let result = runtime_evaluate_with_context(&mut cdp, &script, true, true, context_id).await?;
    let val = result
        .pointer("/result/value")
        .cloned()
        .unwrap_or(Value::Null);
    if !val.get("found").and_then(Value::as_bool).unwrap_or(false) {
        bail!("Element not found after {}ms: {}", timeout, selector);
    }
    out!(ctx,
        "Found {} \"{}\"",
        val.get("tag").and_then(Value::as_str).unwrap_or("element"),
        val.get("text").and_then(Value::as_str).unwrap_or_default()
    );
    out!(ctx, "{}", get_page_brief(&mut cdp).await?);
    cdp.close().await;
    Ok(())
}

pub(crate) async fn cmd_wait_for_nav(ctx: &mut AppContext, timeout_ms: Option<&str>) -> Result<()> {
    let timeout = timeout_ms
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(10000);
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let context_id = get_frame_context_id(ctx, &mut cdp).await?;
    let script = format!(
        r#"(async function() {{
          const deadline = Date.now() + {timeout};
          while (Date.now() < deadline) {{
            if (document.readyState === 'complete') {{
              return {{ ready: true, url: location.href, title: document.title }};
            }}
            await new Promise(r => setTimeout(r, 100));
          }}
          return {{ ready: false, url: location.href, readyState: document.readyState }};
        }})()"#,
        timeout = timeout
    );
    let result = runtime_evaluate_with_context(&mut cdp, &script, true, true, context_id).await?;
    let val = result
        .pointer("/result/value")
        .cloned()
        .unwrap_or(Value::Null);
    if !val.get("ready").and_then(Value::as_bool).unwrap_or(false) {
        bail!(
            "Page not ready after {}ms (readyState: {})",
            timeout,
            val.get("readyState")
                .and_then(Value::as_str)
                .unwrap_or("unknown")
        );
    }
    out!(ctx, "{}", get_page_brief(&mut cdp).await?);
    cdp.close().await;
    Ok(())
}

pub(crate) async fn cmd_scroll(ctx: &mut AppContext, args: &[String]) -> Result<()> {
    if args.is_empty() {
        bail!(
            "Usage: webact-rs scroll <up|down|top|bottom|selector> [pixels]\n       webact-rs scroll <selector> <up|down|top|bottom> [pixels]"
        );
    }
    let directions = ["up", "down", "top", "bottom"];
    let first = args[0].clone();
    let lower = first.to_lowercase();
    let second_is_direction = args
        .get(1)
        .map(|s| directions.contains(&s.to_lowercase().as_str()))
        .unwrap_or(false);
    let first_is_direction = directions.contains(&lower.as_str());

    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let context_id = get_frame_context_id(ctx, &mut cdp).await?;
    if first_is_direction {
        if lower == "top" {
            runtime_evaluate_with_context(
                &mut cdp,
                "window.scrollTo(0, 0)",
                false,
                false,
                context_id,
            )
            .await?;
        } else if lower == "bottom" {
            runtime_evaluate_with_context(
                &mut cdp,
                "window.scrollTo(0, document.body.scrollHeight)",
                false,
                false,
                context_id,
            )
            .await?;
        } else {
            let pixels = args
                .get(1)
                .and_then(|v| v.parse::<i64>().ok())
                .unwrap_or(400);
            let delta = if lower == "up" { -pixels } else { pixels };
            cdp.send(
                "Input.dispatchMouseEvent",
                json!({ "type": "mouseWheel", "x": 200, "y": 200, "deltaX": 0, "deltaY": delta }),
            )
            .await?;
        }
    } else if second_is_direction {
        let selector = first;
        let dir = args[1].to_lowercase();
        let pixels = args
            .get(2)
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(400);
        let script = format!(
            r#"(function() {{
              const el = document.querySelector({sel});
              if (!el) return {{ error: 'Element not found' }};
              const dir = {dir};
              const pixels = {pixels};
              if (dir === 'top') el.scrollTop = 0;
              else if (dir === 'bottom') el.scrollTop = el.scrollHeight;
              else el.scrollBy(0, dir === 'up' ? -pixels : pixels);
              return {{ tag: el.tagName.toLowerCase(), dir }};
            }})()"#,
            sel = serde_json::to_string(&selector)?,
            dir = serde_json::to_string(&dir)?,
            pixels = pixels
        );
        let result =
            runtime_evaluate_with_context(&mut cdp, &script, true, false, context_id).await?;
        if let Some(err) = result
            .pointer("/result/value/error")
            .and_then(Value::as_str)
        {
            bail!("{err}");
        }
        out!(ctx,
            "Scrolled {} within {} {}",
            result
                .pointer("/result/value/dir")
                .and_then(Value::as_str)
                .unwrap_or(""),
            result
                .pointer("/result/value/tag")
                .and_then(Value::as_str)
                .unwrap_or("element"),
            selector
        );
    } else {
        let script = format!(
            r#"(function() {{
              const el = document.querySelector({sel});
              if (!el) return {{ error: 'Element not found: ' + {sel} }};
              el.scrollIntoView({{ block: 'center', behavior: 'smooth' }});
              return {{ tag: el.tagName.toLowerCase() }};
            }})()"#,
            sel = serde_json::to_string(&first)?
        );
        let result =
            runtime_evaluate_with_context(&mut cdp, &script, true, false, context_id).await?;
        if let Some(err) = result
            .pointer("/result/value/error")
            .and_then(Value::as_str)
        {
            bail!("{err}");
        }
        out!(ctx,
            "Scrolled to {} {}",
            result
                .pointer("/result/value/tag")
                .and_then(Value::as_str)
                .unwrap_or("element"),
            first
        );
    }

    sleep(Duration::from_millis(100)).await;
    out!(ctx, "{}", get_page_brief(&mut cdp).await?);
    cdp.close().await;
    Ok(())
}
