use super::*;

pub(crate) async fn cmd_focus(ctx: &mut AppContext, selector: &str) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let context_id = get_frame_context_id(ctx, &mut cdp).await?;
    let script = format!(
        r#"(async function() {{
          const sel = {sel};
          let el;
          for (let i = 0; i < 50; i++) {{
            el = document.querySelector(sel);
            if (el) break;
            await new Promise(r => setTimeout(r, 100));
          }}
          if (!el) return {{ error: 'Element not found after 5s: ' + sel }};
          el.focus();
          return {{ tag: el.tagName, text: (el.textContent || '').substring(0, 50).trim() }};
        }})()"#,
        sel = serde_json::to_string(selector)?
    );
    let result = runtime_evaluate_with_context(&mut cdp, &script, true, true, context_id).await?;
    let val = result
        .pointer("/result/value")
        .cloned()
        .unwrap_or(Value::Null);
    if let Some(err) = val.get("error").and_then(Value::as_str) {
        bail!("{err}");
    }
    out!(ctx,
        "Focused <{}> \"{}\"",
        val.get("tag")
            .and_then(Value::as_str)
            .unwrap_or("element")
            .to_lowercase(),
        val.get("text").and_then(Value::as_str).unwrap_or_default()
    );
    cdp.close().await;
    Ok(())
}

pub(crate) async fn cmd_clear(ctx: &mut AppContext, selector: &str) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let context_id = get_frame_context_id(ctx, &mut cdp).await?;
    let script = format!(
        r#"(async function() {{
          const sel = {sel};
          let el;
          for (let i = 0; i < 50; i++) {{
            el = document.querySelector(sel);
            if (el) break;
            await new Promise(r => setTimeout(r, 100));
          }}
          if (!el) return {{ error: 'Element not found after 5s: ' + sel }};
          el.focus();
          if ('value' in el) {{
            el.value = '';
            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
          }} else if (el.isContentEditable) {{
            el.textContent = '';
            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
          }}
          return {{ tag: el.tagName }};
        }})()"#,
        sel = serde_json::to_string(selector)?
    );
    let result = runtime_evaluate_with_context(&mut cdp, &script, true, true, context_id).await?;
    let val = result
        .pointer("/result/value")
        .cloned()
        .unwrap_or(Value::Null);
    if let Some(err) = val.get("error").and_then(Value::as_str) {
        bail!("{err}");
    }
    out!(ctx,
        "Cleared {} {}",
        val.get("tag")
            .and_then(Value::as_str)
            .unwrap_or("element")
            .to_lowercase(),
        selector
    );
    cdp.close().await;
    Ok(())
}

pub(crate) async fn cmd_keyboard(ctx: &mut AppContext, text: &str) -> Result<()> {
    if text.is_empty() {
        bail!("Usage: webact keyboard <text>");
    }
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
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
    out!(ctx, "OK keyboard \"{}\"", truncate(text, 50));
    cdp.close().await;
    Ok(())
}

pub(crate) async fn cmd_paste(ctx: &mut AppContext, text: &str) -> Result<()> {
    if text.is_empty() {
        bail!("Usage: webact paste <text>");
    }
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let context_id = get_frame_context_id(ctx, &mut cdp).await?;
    let script = format!(
        r#"(function() {{
          const el = document.activeElement;
          if (!el) return {{ error: 'No active element to paste into' }};
          const dt = new DataTransfer();
          dt.setData('text/plain', {text});
          const evt = new ClipboardEvent('paste', {{
            clipboardData: dt,
            bubbles: true,
            cancelable: true
          }});
          el.dispatchEvent(evt);
          return {{ ok: true }};
        }})()"#,
        text = serde_json::to_string(text)?
    );
    let result = runtime_evaluate_with_context(&mut cdp, &script, true, false, context_id).await?;
    if let Some(err) = result
        .pointer("/result/value/error")
        .and_then(Value::as_str)
    {
        bail!("{err}");
    }
    out!(ctx, "OK pasted \"{}\"", truncate(text, 50));
    cdp.close().await;
    Ok(())
}

pub(crate) async fn cmd_select(
    ctx: &mut AppContext,
    selector: &str,
    values: &[String],
) -> Result<()> {
    if values.is_empty() {
        bail!("Usage: webact select <selector> <value> [value2...]");
    }
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let context_id = get_frame_context_id(ctx, &mut cdp).await?;
    let script = format!(
        r#"(async function() {{
          const sel = {sel};
          const vals = {vals};
          let el;
          for (let i = 0; i < 50; i++) {{
            el = document.querySelector(sel);
            if (el) break;
            await new Promise(r => setTimeout(r, 100));
          }}
          if (!el) return {{ error: 'Element not found after 5s: ' + sel }};
          if (el.tagName !== 'SELECT') return {{ error: 'Element is not a <select>: ' + sel }};
          const matched = [];
          for (const opt of el.options) {{
            const match = vals.some(v => opt.value === v || opt.textContent.trim() === v || opt.label === v);
            opt.selected = match;
            if (match) matched.push(opt.textContent.trim() || opt.value);
          }}
          el.dispatchEvent(new Event('input', {{ bubbles: true }}));
          el.dispatchEvent(new Event('change', {{ bubbles: true }}));
          if (matched.length === 0) return {{ error: 'No options matched: ' + vals.join(', ') }};
          return {{ selected: matched }};
        }})()"#,
        sel = serde_json::to_string(selector)?,
        vals = serde_json::to_string(values)?
    );
    let result = runtime_evaluate_with_context(&mut cdp, &script, true, true, context_id).await?;
    if let Some(err) = result
        .pointer("/result/value/error")
        .and_then(Value::as_str)
    {
        bail!("{err}");
    }
    let selected = result
        .pointer("/result/value/selected")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .iter()
        .filter_map(Value::as_str)
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    out!(ctx, "Selected: {}", selected.join(", "));
    out!(ctx, "{}", get_page_brief(&mut cdp).await?);
    cdp.close().await;
    Ok(())
}

pub(crate) async fn cmd_upload(
    ctx: &mut AppContext,
    selector: &str,
    file_paths: &[String],
) -> Result<()> {
    if file_paths.is_empty() {
        bail!("Usage: webact upload <selector> <file> [file2...]");
    }
    let resolved = file_paths
        .iter()
        .map(|f| fs::canonicalize(f).unwrap_or_else(|_| PathBuf::from(f)))
        .collect::<Vec<_>>();
    for f in &resolved {
        if !f.exists() {
            bail!("File not found: {}", f.display());
        }
    }

    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    cdp.send("DOM.enable", json!({})).await?;
    let doc = cdp.send("DOM.getDocument", json!({})).await?;
    let root = doc
        .pointer("/root/nodeId")
        .and_then(Value::as_i64)
        .ok_or_else(|| anyhow!("DOM root node not found"))?;
    let node = cdp
        .send(
            "DOM.querySelector",
            json!({ "nodeId": root, "selector": selector }),
        )
        .await?;
    let node_id = node
        .get("nodeId")
        .and_then(Value::as_i64)
        .ok_or_else(|| anyhow!("Element not found: {selector}"))?;

    cdp.send(
        "DOM.setFileInputFiles",
        json!({
            "nodeId": node_id,
            "files": resolved.iter().map(|p| p.to_string_lossy().to_string()).collect::<Vec<_>>()
        }),
    )
    .await?;

    out!(ctx,
        "Uploaded {} file(s) to {}: {}",
        resolved.len(),
        selector,
        resolved
            .iter()
            .map(|p| p
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string())
            .collect::<Vec<_>>()
            .join(", ")
    );
    cdp.close().await;
    Ok(())
}

pub(crate) async fn cmd_fill(ctx: &mut AppContext, fields: &[(String, String)]) -> Result<()> {
    if fields.is_empty() {
        bail!("Usage: webact fill requires at least one field");
    }
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let context_id = get_frame_context_id(ctx, &mut cdp).await?;

    let mut filled = 0usize;
    for (selector, value) in fields {
        let resolved = resolve_selector(ctx, selector)?;
        let focus_script = format!(
            "(function() {{ const el = document.querySelector({sel}); if (!el) return {{ error: 'Element not found: ' + {sel} }}; el.focus(); if (el.select) el.select(); return {{ ok: true }}; }})()",
            sel = serde_json::to_string(&resolved)?
        );
        let focus_result =
            runtime_evaluate_with_context(&mut cdp, &focus_script, true, false, context_id)
                .await?;
        if let Some(err) = focus_result
            .pointer("/result/value/error")
            .and_then(Value::as_str)
        {
            bail!("{err}");
        }

        for ch in value.chars() {
            let char_s = ch.to_string();
            cdp.send(
                "Input.dispatchKeyEvent",
                json!({ "type": "keyDown", "text": char_s, "unmodifiedText": char_s }),
            )
            .await?;
            cdp.send(
                "Input.dispatchKeyEvent",
                json!({ "type": "keyUp", "text": char_s, "unmodifiedText": char_s }),
            )
            .await?;
        }
        filled += 1;
    }

    out!(ctx, "Filled {} field(s)", filled);
    out!(ctx, "{}", get_page_brief(&mut cdp).await?);
    cdp.close().await;
    Ok(())
}

pub(crate) async fn cmd_dialog(
    ctx: &mut AppContext,
    action: Option<&str>,
    extra_args: &[String],
) -> Result<()> {
    let action = action.unwrap_or_default().to_lowercase();
    if !matches!(action.as_str(), "accept" | "dismiss") {
        bail!("Usage: webact dialog <accept|dismiss> [prompt-text]");
    }
    let accept = action == "accept";
    let prompt_text = extra_args.join(" ");
    let mut state = ctx.load_session_state()?;
    state.dialog_handler = Some(DialogHandler {
        accept,
        prompt_text: prompt_text.clone(),
    });
    ctx.save_session_state(&state)?;
    if prompt_text.is_empty() {
        out!(ctx,
            "Dialog handler set: will {} the next dialog",
            if accept { "accept" } else { "dismiss" }
        );
    } else {
        out!(ctx,
            "Dialog handler set: will {} the next dialog with text: \"{}\"",
            if accept { "accept" } else { "dismiss" },
            prompt_text
        );
    }
    Ok(())
}
