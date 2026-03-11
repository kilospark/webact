use super::*;

pub(crate) async fn cmd_click_dispatch(ctx: &mut AppContext, args: &[String]) -> Result<()> {
    if let Some((raw_x, raw_y)) = parse_coordinates(args) {
        let (x, y) = adjust_coords_for_zoom(ctx, raw_x, raw_y);
        let mut cdp = open_cdp(ctx).await?;
        prepare_cdp(ctx, &mut cdp).await?;
        cdp.send(
            "Input.dispatchMouseEvent",
            json!({ "type": "mouseMoved", "x": x, "y": y }),
        )
        .await?;
        sleep(Duration::from_millis(80)).await;
        cdp.send(
            "Input.dispatchMouseEvent",
            json!({ "type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 1 }),
        )
        .await?;
        cdp.send(
            "Input.dispatchMouseEvent",
            json!({ "type": "mouseReleased", "x": x, "y": y, "button": "left", "clickCount": 1 }),
        )
        .await?;
        out!(ctx, "Clicked at ({x}, {y})");
        sleep(Duration::from_millis(150)).await;
        out!(ctx, "{}", get_page_brief(&mut cdp).await?);
        cdp.close().await;
        return Ok(());
    }
    if args.first().map(String::as_str) == Some("--text") {
        let text = args[1..].join(" ");
        if text.is_empty() {
            bail!("Usage: webact click --text <text>");
        }
        let mut cdp = open_cdp(ctx).await?;
        prepare_cdp(ctx, &mut cdp).await?;
        let loc = locate_element_by_text(ctx, &mut cdp, &text).await?;
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
        out!(ctx,
            "Clicked {} \"{}\" (text match)",
            loc.tag.to_lowercase(),
            loc.text
        );
        sleep(Duration::from_millis(150)).await;
        out!(ctx, "{}", get_page_brief(&mut cdp).await?);
        cdp.close().await;
        return Ok(());
    }
    let selector = resolve_selector(ctx, &args.join(" "))?;
    cmd_click(ctx, &selector).await
}

pub(crate) async fn cmd_double_click_dispatch(ctx: &mut AppContext, args: &[String]) -> Result<()> {
    if let Some((raw_x, raw_y)) = parse_coordinates(args) {
        let (x, y) = adjust_coords_for_zoom(ctx, raw_x, raw_y);
        let mut cdp = open_cdp(ctx).await?;
        prepare_cdp(ctx, &mut cdp).await?;
        dispatch_double_click(&mut cdp, x, y).await?;
        out!(ctx, "Double-clicked at ({x}, {y})");
        sleep(Duration::from_millis(150)).await;
        out!(ctx, "{}", get_page_brief(&mut cdp).await?);
        cdp.close().await;
        return Ok(());
    }
    if args.first().map(String::as_str) == Some("--text") {
        let text = args[1..].join(" ");
        if text.is_empty() {
            bail!("Usage: webact doubleclick --text <text>");
        }
        let mut cdp = open_cdp(ctx).await?;
        prepare_cdp(ctx, &mut cdp).await?;
        let loc = locate_element_by_text(ctx, &mut cdp, &text).await?;
        dispatch_double_click(&mut cdp, loc.x, loc.y).await?;
        out!(ctx,
            "Double-clicked {} \"{}\" (text match)",
            loc.tag.to_lowercase(),
            loc.text
        );
        sleep(Duration::from_millis(150)).await;
        out!(ctx, "{}", get_page_brief(&mut cdp).await?);
        cdp.close().await;
        return Ok(());
    }
    let selector = resolve_selector(ctx, &args.join(" "))?;
    cmd_double_click(ctx, &selector).await
}

pub(crate) async fn cmd_right_click_dispatch(ctx: &mut AppContext, args: &[String]) -> Result<()> {
    if let Some((raw_x, raw_y)) = parse_coordinates(args) {
        let (x, y) = adjust_coords_for_zoom(ctx, raw_x, raw_y);
        let mut cdp = open_cdp(ctx).await?;
        prepare_cdp(ctx, &mut cdp).await?;
        dispatch_right_click(&mut cdp, x, y).await?;
        out!(ctx, "Right-clicked at ({x}, {y})");
        sleep(Duration::from_millis(150)).await;
        out!(ctx, "{}", get_page_brief(&mut cdp).await?);
        cdp.close().await;
        return Ok(());
    }
    if args.first().map(String::as_str) == Some("--text") {
        let text = args[1..].join(" ");
        if text.is_empty() {
            bail!("Usage: webact rightclick --text <text>");
        }
        let mut cdp = open_cdp(ctx).await?;
        prepare_cdp(ctx, &mut cdp).await?;
        let loc = locate_element_by_text(ctx, &mut cdp, &text).await?;
        dispatch_right_click(&mut cdp, loc.x, loc.y).await?;
        out!(ctx,
            "Right-clicked {} \"{}\" (text match)",
            loc.tag.to_lowercase(),
            loc.text
        );
        sleep(Duration::from_millis(150)).await;
        out!(ctx, "{}", get_page_brief(&mut cdp).await?);
        cdp.close().await;
        return Ok(());
    }
    let selector = resolve_selector(ctx, &args.join(" "))?;
    cmd_right_click(ctx, &selector).await
}

pub(crate) async fn cmd_hover_dispatch(ctx: &mut AppContext, args: &[String]) -> Result<()> {
    if let Some((raw_x, raw_y)) = parse_coordinates(args) {
        let (x, y) = adjust_coords_for_zoom(ctx, raw_x, raw_y);
        let mut cdp = open_cdp(ctx).await?;
        prepare_cdp(ctx, &mut cdp).await?;
        cdp.send(
            "Input.dispatchMouseEvent",
            json!({ "type": "mouseMoved", "x": x, "y": y }),
        )
        .await?;
        out!(ctx, "Hovered at ({x}, {y})");
        sleep(Duration::from_millis(150)).await;
        out!(ctx, "{}", get_page_brief(&mut cdp).await?);
        cdp.close().await;
        return Ok(());
    }
    if args.first().map(String::as_str) == Some("--text") {
        let text = args[1..].join(" ");
        if text.is_empty() {
            bail!("Usage: webact hover --text <text>");
        }
        let mut cdp = open_cdp(ctx).await?;
        prepare_cdp(ctx, &mut cdp).await?;
        let loc = locate_element_by_text(ctx, &mut cdp, &text).await?;
        cdp.send(
            "Input.dispatchMouseEvent",
            json!({ "type": "mouseMoved", "x": loc.x, "y": loc.y }),
        )
        .await?;
        out!(ctx,
            "Hovered {} \"{}\" (text match)",
            loc.tag.to_lowercase(),
            loc.text
        );
        sleep(Duration::from_millis(150)).await;
        out!(ctx, "{}", get_page_brief(&mut cdp).await?);
        cdp.close().await;
        return Ok(());
    }
    let selector = resolve_selector(ctx, &args.join(" "))?;
    cmd_hover(ctx, &selector).await
}

pub(crate) async fn cmd_double_click(ctx: &mut AppContext, selector: &str) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let loc = locate_element(ctx, &mut cdp, selector).await?;
    dispatch_double_click(&mut cdp, loc.x, loc.y).await?;
    out!(ctx, "Double-clicked {} \"{}\"", loc.tag.to_lowercase(), loc.text);
    sleep(Duration::from_millis(150)).await;
    out!(ctx, "{}", get_page_brief(&mut cdp).await?);
    cdp.close().await;
    Ok(())
}

pub(crate) async fn cmd_right_click(ctx: &mut AppContext, selector: &str) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let loc = locate_element(ctx, &mut cdp, selector).await?;
    dispatch_right_click(&mut cdp, loc.x, loc.y).await?;
    out!(ctx, "Right-clicked {} \"{}\"", loc.tag.to_lowercase(), loc.text);
    sleep(Duration::from_millis(150)).await;
    out!(ctx, "{}", get_page_brief(&mut cdp).await?);
    cdp.close().await;
    Ok(())
}

pub(crate) async fn cmd_hover(ctx: &mut AppContext, selector: &str) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let loc = locate_element(ctx, &mut cdp, selector).await?;
    cdp.send(
        "Input.dispatchMouseEvent",
        json!({ "type": "mouseMoved", "x": loc.x, "y": loc.y }),
    )
    .await?;
    out!(ctx, "Hovered {} \"{}\"", loc.tag.to_lowercase(), loc.text);
    sleep(Duration::from_millis(150)).await;
    out!(ctx, "{}", get_page_brief(&mut cdp).await?);
    cdp.close().await;
    Ok(())
}

pub(crate) async fn cmd_drag(
    ctx: &mut AppContext,
    from_selector: &str,
    to_selector: &str,
) -> Result<()> {
    let mut cdp = open_cdp(ctx).await?;
    prepare_cdp(ctx, &mut cdp).await?;
    let from = locate_element(ctx, &mut cdp, from_selector).await?;
    let to = locate_element(ctx, &mut cdp, to_selector).await?;
    cdp.send(
        "Input.dispatchMouseEvent",
        json!({ "type": "mouseMoved", "x": from.x, "y": from.y }),
    )
    .await?;
    cdp.send(
        "Input.dispatchMouseEvent",
        json!({ "type": "mousePressed", "x": from.x, "y": from.y, "button": "left", "clickCount": 1 }),
    )
    .await?;
    for i in 1..=5 {
        let x = from.x + (to.x - from.x) * (i as f64 / 5.0);
        let y = from.y + (to.y - from.y) * (i as f64 / 5.0);
        cdp.send(
            "Input.dispatchMouseEvent",
            json!({ "type": "mouseMoved", "x": x, "y": y }),
        )
        .await?;
    }
    cdp.send(
        "Input.dispatchMouseEvent",
        json!({ "type": "mouseReleased", "x": to.x, "y": to.y, "button": "left", "clickCount": 1 }),
    )
    .await?;
    out!(ctx,
        "Dragged {} to {}",
        from.tag.to_lowercase(),
        to.tag.to_lowercase()
    );
    out!(ctx, "{}", get_page_brief(&mut cdp).await?);
    cdp.close().await;
    Ok(())
}

pub(crate) async fn dispatch_double_click(cdp: &mut CdpClient, x: f64, y: f64) -> Result<()> {
    cdp.send(
        "Input.dispatchMouseEvent",
        json!({ "type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 1 }),
    )
    .await?;
    cdp.send(
        "Input.dispatchMouseEvent",
        json!({ "type": "mouseReleased", "x": x, "y": y, "button": "left", "clickCount": 1 }),
    )
    .await?;
    cdp.send(
        "Input.dispatchMouseEvent",
        json!({ "type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 2 }),
    )
    .await?;
    cdp.send(
        "Input.dispatchMouseEvent",
        json!({ "type": "mouseReleased", "x": x, "y": y, "button": "left", "clickCount": 2 }),
    )
    .await?;
    Ok(())
}

pub(crate) async fn dispatch_right_click(cdp: &mut CdpClient, x: f64, y: f64) -> Result<()> {
    cdp.send(
        "Input.dispatchMouseEvent",
        json!({ "type": "mousePressed", "x": x, "y": y, "button": "right", "clickCount": 1 }),
    )
    .await?;
    cdp.send(
        "Input.dispatchMouseEvent",
        json!({ "type": "mouseReleased", "x": x, "y": y, "button": "right", "clickCount": 1 }),
    )
    .await?;
    Ok(())
}
