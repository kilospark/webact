use super::*;

pub(crate) fn parse_coordinates(args: &[String]) -> Option<(f64, f64)> {
    if args.len() == 1 {
        let arg = args[0].trim();
        if let Some((x, y)) = arg.split_once(',') {
            if let (Ok(xv), Ok(yv)) = (x.parse::<f64>(), y.parse::<f64>()) {
                return Some((xv, yv));
            }
        }
    }
    if args.len() == 2 {
        if let (Ok(x), Ok(y)) = (args[0].parse::<f64>(), args[1].parse::<f64>()) {
            return Some((x, y));
        }
    }
    None
}

pub(crate) fn console_arg_to_text(arg: &Value) -> String {
    arg.get("value")
        .and_then(|v| match v {
            Value::String(s) => Some(s.clone()),
            Value::Number(n) => Some(n.to_string()),
            Value::Bool(b) => Some(b.to_string()),
            Value::Null => Some("null".to_string()),
            _ => Some(v.to_string()),
        })
        .or_else(|| {
            arg.get("description")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .unwrap_or_default()
}

pub(crate) fn map_resource_type(pattern: &str) -> Option<&'static str> {
    match pattern.to_lowercase().as_str() {
        "images" => Some("Image"),
        "css" => Some("Stylesheet"),
        "fonts" => Some("Font"),
        "media" => Some("Media"),
        "scripts" => Some("Script"),
        _ => None,
    }
}

pub(crate) fn resource_type_url_patterns(resource_type: &str) -> Vec<String> {
    match resource_type {
        "Image" => vec![
            "*.png".to_string(),
            "*.jpg".to_string(),
            "*.jpeg".to_string(),
            "*.gif".to_string(),
            "*.webp".to_string(),
            "*.svg".to_string(),
            "data:image/*".to_string(),
        ],
        "Stylesheet" => vec!["*.css".to_string()],
        "Font" => vec![
            "*.woff".to_string(),
            "*.woff2".to_string(),
            "*.ttf".to_string(),
            "*.otf".to_string(),
        ],
        "Media" => vec![
            "*.mp3".to_string(),
            "*.mp4".to_string(),
            "*.webm".to_string(),
            "*.m3u8".to_string(),
        ],
        "Script" => vec!["*.js".to_string()],
        _ => Vec::new(),
    }
}

pub(crate) fn print_frame_tree(buf: &mut String, node: &Value, depth: usize) {
    if node.is_null() {
        return;
    }
    let indent = "  ".repeat(depth);
    let frame = node.get("frame").cloned().unwrap_or(Value::Null);
    let id = frame.get("id").and_then(Value::as_str).unwrap_or("");
    let name = frame.get("name").and_then(Value::as_str).unwrap_or("");
    let url = frame.get("url").and_then(Value::as_str).unwrap_or("");
    if name.is_empty() {
        let _ = writeln!(buf, "{}[{}] {}", indent, id, url);
    } else {
        let _ = writeln!(buf, "{}[{}] name=\"{}\" {}", indent, id, name, url);
    }
    for child in node
        .get("childFrames")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
    {
        print_frame_tree(buf, &child, depth + 1);
    }
}

pub(crate) fn find_frame_in_tree(node: &Value, id_or_name: &str) -> Option<(String, String)> {
    if node.is_null() {
        return None;
    }
    let frame = node.get("frame")?;
    let id = frame.get("id").and_then(Value::as_str).unwrap_or("");
    let name = frame.get("name").and_then(Value::as_str).unwrap_or("");
    let url = frame.get("url").and_then(Value::as_str).unwrap_or("");
    if id == id_or_name || name == id_or_name {
        return Some((id.to_string(), url.to_string()));
    }
    for child in node
        .get("childFrames")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
    {
        if let Some(found) = find_frame_in_tree(&child, id_or_name) {
            return Some(found);
        }
    }
    None
}

pub(crate) fn find_frame_by_url(node: &Value, target_url: &str) -> Option<(String, String)> {
    if node.is_null() {
        return None;
    }
    let frame = node.get("frame")?;
    let id = frame.get("id").and_then(Value::as_str).unwrap_or("");
    let url = frame.get("url").and_then(Value::as_str).unwrap_or("");
    if url == target_url {
        return Some((id.to_string(), url.to_string()));
    }
    for child in node
        .get("childFrames")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
    {
        if let Some(found) = find_frame_by_url(&child, target_url) {
            return Some(found);
        }
    }
    None
}

pub(crate) fn epoch_to_date(epoch_seconds: i64) -> String {
    epoch_seconds.to_string()
}

pub(crate) fn human_size(size: u64) -> String {
    if size > 1_048_576 {
        format!("{:.1}MB", size as f64 / 1_048_576.0)
    } else if size > 1024 {
        format!("{}KB", (size as f64 / 1024.0).round() as u64)
    } else {
        format!("{}B", size)
    }
}

pub(crate) fn activate_browser(browser_name: &str) -> Result<()> {
    if cfg!(target_os = "macos") {
        let script = format!(
            "tell application \"{}\" to activate\ntell application \"{}\" to set miniaturized of window 1 to false",
            browser_name, browser_name
        );
        let status = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .status()
            .context("failed to run osascript")?;
        if !status.success() {
            bail!("osascript failed");
        }
    }
    Ok(())
}

pub(crate) fn minimize_browser(browser_name: &str) -> Result<()> {
    if cfg!(target_os = "macos") {
        let script = format!(
            "tell application \"{}\" to set miniaturized of every window to true",
            browser_name
        );
        let status = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .status()
            .context("failed to run osascript")?;
        if !status.success() {
            bail!("osascript failed");
        }
    }
    Ok(())
}

pub(crate) async fn human_click(cdp: &mut CdpClient, x: f64, y: f64) -> Result<()> {
    let start_x = x + (rand::random::<f64>() - 0.5) * 200.0 + 50.0;
    let start_y = y + (rand::random::<f64>() - 0.5) * 200.0 + 50.0;
    cdp.send(
        "Input.dispatchMouseEvent",
        json!({ "type": "mouseMoved", "x": start_x, "y": start_y }),
    )
    .await?;
    human_mouse_move(cdp, start_x, start_y, x, y).await?;
    sleep(Duration::from_millis(
        (50.0 + rand::random::<f64>() * 150.0) as u64,
    ))
    .await;
    cdp.send(
        "Input.dispatchMouseEvent",
        json!({ "type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 1 }),
    )
    .await?;
    sleep(Duration::from_millis(
        (30.0 + rand::random::<f64>() * 90.0) as u64,
    ))
    .await;
    let release_x = x + (rand::random::<f64>() - 0.5) * 2.0;
    let release_y = y + (rand::random::<f64>() - 0.5) * 2.0;
    cdp.send(
        "Input.dispatchMouseEvent",
        json!({ "type": "mouseReleased", "x": release_x, "y": release_y, "button": "left", "clickCount": 1 }),
    )
    .await?;
    Ok(())
}

pub(crate) async fn human_mouse_move(
    cdp: &mut CdpClient,
    from_x: f64,
    from_y: f64,
    to_x: f64,
    to_y: f64,
) -> Result<()> {
    let distance = ((to_x - from_x).powi(2) + (to_y - from_y).powi(2)).sqrt();
    let duration = 100.0 + (distance / 2000.0) * 200.0 + rand::random::<f64>() * 100.0;
    let steps = (duration / 20.0).round().clamp(5.0, 30.0) as usize;

    let cp1_x = from_x + (to_x - from_x) * 0.25 + (rand::random::<f64>() - 0.5) * 50.0;
    let cp1_y = from_y + (to_y - from_y) * 0.25 + (rand::random::<f64>() - 0.5) * 50.0;
    let cp2_x = from_x + (to_x - from_x) * 0.75 + (rand::random::<f64>() - 0.5) * 50.0;
    let cp2_y = from_y + (to_y - from_y) * 0.75 + (rand::random::<f64>() - 0.5) * 50.0;

    for i in 0..=steps {
        let t = i as f64 / steps as f64;
        let u = 1.0 - t;
        let x = u.powi(3) * from_x
            + 3.0 * u.powi(2) * t * cp1_x
            + 3.0 * u * t.powi(2) * cp2_x
            + t.powi(3) * to_x
            + (rand::random::<f64>() - 0.5) * 2.0;
        let y = u.powi(3) * from_y
            + 3.0 * u.powi(2) * t * cp1_y
            + 3.0 * u * t.powi(2) * cp2_y
            + t.powi(3) * to_y
            + (rand::random::<f64>() - 0.5) * 2.0;
        cdp.send(
            "Input.dispatchMouseEvent",
            json!({ "type": "mouseMoved", "x": x, "y": y }),
        )
        .await?;
        sleep(Duration::from_millis(
            (16.0 + rand::random::<f64>() * 8.0) as u64,
        ))
        .await;
    }
    Ok(())
}

pub(crate) async fn human_type_text(cdp: &mut CdpClient, text: &str, fast: bool) -> Result<()> {
    let base_delay = if fast { 40.0 } else { 80.0 };
    let chars = text.chars().collect::<Vec<_>>();
    for (i, ch) in chars.iter().enumerate() {
        let c = ch.to_string();
        cdp.send(
            "Input.dispatchKeyEvent",
            json!({ "type": "keyDown", "text": c, "unmodifiedText": ch.to_string() }),
        )
        .await?;
        cdp.send(
            "Input.dispatchKeyEvent",
            json!({ "type": "keyUp", "text": ch.to_string(), "unmodifiedText": ch.to_string() }),
        )
        .await?;
        let mut delay = base_delay + rand::random::<f64>() * (base_delay / 2.0);
        if rand::random::<f64>() < 0.05 {
            delay += rand::random::<f64>() * 500.0;
        }
        if i > 0 && chars[i - 1] == *ch {
            delay /= 2.0;
        }
        if rand::random::<f64>() < 0.03 && i < chars.len() - 1 {
            let wrong_char = ((b'a' + (rand::random::<u8>() % 26)) as char).to_string();
            cdp.send(
                "Input.dispatchKeyEvent",
                json!({ "type": "keyDown", "text": wrong_char, "unmodifiedText": wrong_char }),
            )
            .await?;
            cdp.send(
                "Input.dispatchKeyEvent",
                json!({ "type": "keyUp", "text": wrong_char, "unmodifiedText": wrong_char }),
            )
            .await?;
            sleep(Duration::from_millis(
                (50.0 + rand::random::<f64>() * 100.0) as u64,
            ))
            .await;
            cdp.send(
                "Input.dispatchKeyEvent",
                json!({
                    "type": "keyDown",
                    "key": "Backspace",
                    "code": "Backspace",
                    "keyCode": 8,
                    "windowsVirtualKeyCode": 8
                }),
            )
            .await?;
            cdp.send(
                "Input.dispatchKeyEvent",
                json!({
                    "type": "keyUp",
                    "key": "Backspace",
                    "code": "Backspace",
                    "keyCode": 8,
                    "windowsVirtualKeyCode": 8
                }),
            )
            .await?;
            sleep(Duration::from_millis(
                (30.0 + rand::random::<f64>() * 70.0) as u64,
            ))
            .await;
        }
        sleep(Duration::from_millis(delay as u64)).await;
    }
    Ok(())
}

pub(crate) fn build_dom_extract_script(selector: Option<&str>) -> Result<String> {
    let root = match selector {
        Some(sel) => format!("document.querySelector({})", serde_json::to_string(sel)?),
        None => "document.body".to_string(),
    };
    let selector_suffix = match selector {
        Some(sel) => format!("' for selector: ' + {}", serde_json::to_string(sel)?),
        None => "''".to_string(),
    };

    Ok(DOM_EXTRACT_TEMPLATE
        .replace("__WEBACT_ROOT__", &root)
        .replace("__WEBACT_SELECTOR_SUFFIX__", &selector_suffix))
}

pub(crate) fn parse_key_combo(combo: &str) -> (KeyModifiers, String) {
    let mut modifiers = KeyModifiers {
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
    };
    let mut key = String::new();

    for part in combo.split('+') {
        match part.to_lowercase().as_str() {
            "ctrl" | "control" => modifiers.ctrl = true,
            "alt" | "option" => modifiers.alt = true,
            "shift" => modifiers.shift = true,
            "meta" | "cmd" | "command" => modifiers.meta = true,
            _ => key = part.to_string(),
        }
    }

    (modifiers, key)
}

pub(crate) fn key_mapping(input: &str) -> KeyMapping {
    let key = input.to_string();
    match input.to_lowercase().as_str() {
        "enter" => KeyMapping {
            key: "Enter".to_string(),
            code: "Enter".to_string(),
            key_code: 13,
        },
        "tab" => KeyMapping {
            key: "Tab".to_string(),
            code: "Tab".to_string(),
            key_code: 9,
        },
        "escape" => KeyMapping {
            key: "Escape".to_string(),
            code: "Escape".to_string(),
            key_code: 27,
        },
        "backspace" => KeyMapping {
            key: "Backspace".to_string(),
            code: "Backspace".to_string(),
            key_code: 8,
        },
        "delete" => KeyMapping {
            key: "Delete".to_string(),
            code: "Delete".to_string(),
            key_code: 46,
        },
        "arrowup" => KeyMapping {
            key: "ArrowUp".to_string(),
            code: "ArrowUp".to_string(),
            key_code: 38,
        },
        "arrowdown" => KeyMapping {
            key: "ArrowDown".to_string(),
            code: "ArrowDown".to_string(),
            key_code: 40,
        },
        "arrowleft" => KeyMapping {
            key: "ArrowLeft".to_string(),
            code: "ArrowLeft".to_string(),
            key_code: 37,
        },
        "arrowright" => KeyMapping {
            key: "ArrowRight".to_string(),
            code: "ArrowRight".to_string(),
            key_code: 39,
        },
        "space" => KeyMapping {
            key: " ".to_string(),
            code: "Space".to_string(),
            key_code: 32,
        },
        "home" => KeyMapping {
            key: "Home".to_string(),
            code: "Home".to_string(),
            key_code: 36,
        },
        "end" => KeyMapping {
            key: "End".to_string(),
            code: "End".to_string(),
            key_code: 35,
        },
        "pageup" => KeyMapping {
            key: "PageUp".to_string(),
            code: "PageUp".to_string(),
            key_code: 33,
        },
        "pagedown" => KeyMapping {
            key: "PageDown".to_string(),
            code: "PageDown".to_string(),
            key_code: 34,
        },
        _ => {
            if input.chars().count() == 1 {
                let upper = input.to_uppercase();
                let c = upper.chars().next().unwrap_or('A');
                KeyMapping {
                    key,
                    code: format!("Key{}", upper),
                    key_code: c as i64,
                }
            } else {
                KeyMapping {
                    key,
                    code: input.to_string(),
                    key_code: 0,
                }
            }
        }
    }
}

pub(crate) fn find_free_port() -> Result<u16> {
    let listener =
        TcpListener::bind((DEFAULT_CDP_HOST, 0)).context("failed to allocate free port")?;
    let port = listener
        .local_addr()
        .context("failed reading free port")?
        .port();
    drop(listener);
    Ok(port)
}

pub(crate) fn find_browser() -> Option<BrowserCandidate> {
    if let Ok(chrome_path) = env::var("CHROME_PATH") {
        if Path::new(&chrome_path).exists() {
            let name = Path::new(&chrome_path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "chrome".to_string());
            return Some(BrowserCandidate {
                path: chrome_path,
                name,
            });
        }
    }

    let home = env::var("HOME").unwrap_or_default();
    let mut candidates: Vec<(String, String)> = Vec::new();

    if cfg!(target_os = "macos") {
        for (name, rel) in [
            (
                "Google Chrome",
                "Google Chrome.app/Contents/MacOS/Google Chrome",
            ),
            (
                "Google Chrome Canary",
                "Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
            ),
            (
                "Microsoft Edge",
                "Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            ),
            (
                "Brave Browser",
                "Brave Browser.app/Contents/MacOS/Brave Browser",
            ),
            ("Arc", "Arc.app/Contents/MacOS/Arc"),
            ("Vivaldi", "Vivaldi.app/Contents/MacOS/Vivaldi"),
            ("Opera", "Opera.app/Contents/MacOS/Opera"),
            ("Chromium", "Chromium.app/Contents/MacOS/Chromium"),
        ] {
            candidates.push((format!("/Applications/{rel}"), name.to_string()));
            candidates.push((format!("{home}/Applications/{rel}"), name.to_string()));
        }
    } else if cfg!(target_os = "linux") {
        candidates.extend(
            [
                ("/usr/bin/google-chrome-stable", "Google Chrome"),
                ("/usr/bin/google-chrome", "Google Chrome"),
                ("/usr/local/bin/google-chrome-stable", "Google Chrome"),
                ("/usr/local/bin/google-chrome", "Google Chrome"),
                ("/usr/bin/microsoft-edge-stable", "Microsoft Edge"),
                ("/usr/bin/microsoft-edge", "Microsoft Edge"),
                ("/usr/bin/brave-browser", "Brave Browser"),
                ("/usr/bin/brave-browser-stable", "Brave Browser"),
                ("/usr/bin/vivaldi-stable", "Vivaldi"),
                ("/usr/bin/vivaldi", "Vivaldi"),
                ("/usr/bin/opera", "Opera"),
                ("/usr/bin/chromium-browser", "Chromium"),
                ("/usr/bin/chromium", "Chromium"),
                ("/usr/local/bin/chromium-browser", "Chromium"),
                ("/usr/local/bin/chromium", "Chromium"),
                ("/snap/bin/chromium", "Chromium (snap)"),
            ]
            .into_iter()
            .map(|(p, n)| (p.to_string(), n.to_string())),
        );
    } else if cfg!(target_os = "windows") {
        let pf = env::var("PROGRAMFILES").unwrap_or_else(|_| "C:\\Program Files".to_string());
        let pf86 =
            env::var("PROGRAMFILES(X86)").unwrap_or_else(|_| "C:\\Program Files (x86)".to_string());
        let local = env::var("LOCALAPPDATA").unwrap_or_default();

        candidates.extend([
            (
                format!("{pf}\\Google\\Chrome\\Application\\chrome.exe"),
                "Google Chrome".to_string(),
            ),
            (
                format!("{pf86}\\Google\\Chrome\\Application\\chrome.exe"),
                "Google Chrome".to_string(),
            ),
            (
                format!("{local}\\Google\\Chrome\\Application\\chrome.exe"),
                "Google Chrome".to_string(),
            ),
            (
                format!("{pf}\\Microsoft\\Edge\\Application\\msedge.exe"),
                "Microsoft Edge".to_string(),
            ),
            (
                format!("{pf86}\\Microsoft\\Edge\\Application\\msedge.exe"),
                "Microsoft Edge".to_string(),
            ),
            (
                format!("{pf}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
                "Brave Browser".to_string(),
            ),
        ]);
    }

    for (path, name) in candidates {
        if Path::new(&path).exists() {
            return Some(BrowserCandidate { path, name });
        }
    }

    if !cfg!(target_os = "windows") {
        for (bin, name) in [
            ("google-chrome-stable", "Google Chrome"),
            ("google-chrome", "Google Chrome"),
            ("chromium-browser", "Chromium"),
            ("chromium", "Chromium"),
            ("microsoft-edge-stable", "Microsoft Edge"),
            ("brave-browser", "Brave Browser"),
        ] {
            if let Some(path) = which_bin(bin) {
                return Some(BrowserCandidate {
                    path,
                    name: name.to_string(),
                });
            }
        }
    }

    None
}

pub(crate) fn which_bin(bin: &str) -> Option<String> {
    let output = Command::new("which").arg(bin).output().ok()?;
    if !output.status.success() {
        return None;
    }

    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() { None } else { Some(path) }
}

pub(crate) fn truncate(input: &str, max_chars: usize) -> String {
    if input.chars().count() <= max_chars {
        return input.to_string();
    }
    let clipped = input.chars().take(max_chars).collect::<String>();
    format!("{clipped}...")
}

pub(crate) fn json_value_to_arg(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Null => "null".to_string(),
        _ => v.to_string(),
    }
}

pub(crate) fn now_epoch_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_else(|_| Duration::from_secs(0))
        .as_millis() as i64
}

pub(crate) fn new_session_id() -> String {
    let mut bytes = [0u8; 4];
    rand::rng().fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect::<String>()
}
