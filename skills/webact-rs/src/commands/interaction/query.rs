use super::*;

pub(crate) async fn cmd_eval(ctx: &mut AppContext, expression: &str) -> Result<()> {
    if expression.is_empty() {
        bail!("Usage: webact-rs eval <js-expression>");
    }
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let context_id = get_frame_context_id(ctx, &mut cdp).await?;
    let result =
        runtime_evaluate_with_context(&mut cdp, expression, false, true, context_id).await?;

    let r = result.get("result").cloned().unwrap_or(Value::Null);
    let r_type = r.get("type").and_then(Value::as_str).unwrap_or("");
    if r_type == "undefined" {
        cdp.close().await;
        return Ok(());
    }
    if r_type == "object" {
        if let Some(object_id) = r.get("objectId").and_then(Value::as_str) {
            let ser = cdp
                .send(
                    "Runtime.callFunctionOn",
                    json!({
                        "objectId": object_id,
                        "functionDeclaration": "function() { return JSON.stringify(this, (k, v) => v instanceof HTMLElement ? v.outerHTML.slice(0, 200) : v, 2); }",
                        "returnByValue": true
                    }),
                )
                .await?;
            if let Some(v) = ser.pointer("/result/value").and_then(Value::as_str) {
                out!(ctx, "{v}");
            } else {
                out!(ctx,
                    "{}",
                    r.get("description")
                        .and_then(Value::as_str)
                        .unwrap_or("(object)")
                );
            }
        } else {
            out!(ctx,
                "{}",
                r.get("description")
                    .and_then(Value::as_str)
                    .unwrap_or("(object)")
            );
        }
    } else if let Some(v) = r.get("value") {
        match v {
            Value::String(s) => out!(ctx, "{s}"),
            _ => out!(ctx, "{v}"),
        }
    } else {
        out!(ctx,
            "{}",
            r.get("description")
                .and_then(Value::as_str)
                .unwrap_or("(value)")
        );
    }
    cdp.close().await;
    Ok(())
}

pub(crate) async fn cmd_observe(ctx: &mut AppContext) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let data = fetch_interactive_elements(ctx, &mut cdp).await?;
    if data.elements.is_empty() {
        out!(ctx, "(no interactive elements found)");
        cdp.close().await;
        return Ok(());
    }
    let mut observe_buf = String::new();
    for el in &data.elements {
        let desc = if el.name.is_empty() {
            el.role.clone()
        } else {
            format!("{} \"{}\"", el.role, truncate(&el.name, 60))
        };
        let cmd = match el.role.as_str() {
            "textbox" | "searchbox" => format!("type {} <text>", el.ref_id),
            "combobox" | "listbox" => format!("select {} <value>", el.ref_id),
            "slider" | "spinbutton" => format!("type {} <value>", el.ref_id),
            _ => format!("click {}", el.ref_id),
        };
        observe_buf.push_str(&format!("[{}] {}  — {}\n", el.ref_id, cmd, desc));
    }
    out!(ctx, "{}", observe_buf.trim_end());
    cdp.close().await;
    Ok(())
}

pub(crate) async fn cmd_find(ctx: &mut AppContext, query: &str) -> Result<()> {
    if query.trim().is_empty() {
        bail!("Usage: webact-rs find <query>");
    }
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let data = fetch_interactive_elements(ctx, &mut cdp).await?;
    if data.elements.is_empty() {
        bail!("No interactive elements found. Navigate to a page first.");
    }

    let stopwords: HashSet<&str> = [
        "the", "a", "an", "to", "for", "of", "in", "on", "is", "it", "and", "or", "this", "that",
    ]
    .into_iter()
    .collect();

    let tokenize = |s: &str| -> HashSet<String> {
        s.to_lowercase()
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() { c } else { ' ' })
            .collect::<String>()
            .split_whitespace()
            .filter(|t| t.len() > 1 && !stopwords.contains(*t))
            .map(|s| s.to_string())
            .collect()
    };

    let query_tokens = tokenize(query);
    if query_tokens.is_empty() {
        bail!("Query too vague. Use descriptive terms like \"search input\" or \"submit button\".");
    }

    let mut scored = Vec::<(usize, f64, InteractiveElement)>::new();
    for el in &data.elements {
        let text = format!("{} {} {}", el.role, el.name, el.value);
        let el_tokens = tokenize(&text);
        if el_tokens.is_empty() {
            continue;
        }
        let mut intersection = 0.0f64;
        for t in &query_tokens {
            if el_tokens.contains(t) {
                intersection += 1.0;
            } else if el_tokens.iter().any(|et| et.contains(t) || t.contains(et)) {
                intersection += 0.5;
            }
        }
        let union_size = query_tokens.union(&el_tokens).count() as f64;
        let score = if union_size > 0.0 {
            intersection / union_size
        } else {
            0.0
        };
        if score > 0.0 {
            scored.push((el.ref_id, score, el.clone()));
        }
    }

    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    let top = scored.into_iter().take(5).collect::<Vec<_>>();
    if top.is_empty() {
        bail!("No elements match \"{query}\". Try: axtree -i");
    }

    let (best_ref, best_score, best_el) = &top[0];
    let confidence = if *best_score >= 0.5 {
        "high"
    } else if *best_score >= 0.25 {
        "medium"
    } else {
        "low"
    };
    out!(ctx,
        "Best: [{}] {} \"{}\" ({} confidence, score:{:.2})",
        best_ref, best_el.role, best_el.name, confidence, best_score
    );
    if top.len() > 1 {
        out!(ctx, "Also:");
        for (r, s, e) in top.iter().skip(1) {
            out!(ctx, "  [{}] {} \"{}\" ({:.2})", r, e.role, e.name, s);
        }
    }
    cdp.close().await;
    Ok(())
}
