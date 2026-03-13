use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde_json::{Value, json};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Add webact to all detected MCP clients.
pub fn configure_clients() {
    let binary_path = match env::current_exe() {
        Ok(p) => p.to_string_lossy().into_owned(),
        Err(e) => {
            println!("  Error: could not determine binary path: {e}");
            return;
        }
    };

    println!();
    println!("Configuring MCP clients...");

    let mut any = false;

    // -- Type C: CLI-based clients --

    if has_binary("claude") {
        any = true;
        configure_cli_client(
            "Claude Code",
            &["claude", "mcp", "get", "webact"],
            &["claude", "mcp", "add", "-s", "user", "webact", &binary_path, "--", "mcp"],
        );
    }

    if has_binary("codex") {
        any = true;
        configure_cli_client_grep(
            "Codex",
            &["codex", "mcp", "list"],
            "webact",
            &["codex", "mcp", "add", "webact", "--", &binary_path, "mcp"],
        );
    }

    if has_binary("gemini") {
        any = true;
        configure_cli_client_grep(
            "Gemini CLI",
            &["gemini", "mcp", "list"],
            "webact",
            &["gemini", "mcp", "add", "-s", "user", "webact", &binary_path, "mcp"],
        );
    }

    // -- Type A: mcpServers config files --

    for client in file_clients_mcp_servers() {
        let create = match client.create_when {
            CreateWhen::Never => false,
            CreateWhen::BinaryDetected(bin) => has_binary(bin),
        };
        if let Some(status) = upsert_mcp_servers(&client.path, &binary_path, create) {
            any = true;
            println!("  {}: {status}", client.name);
        }
    }

    // -- Type B: Opencode --

    if has_binary("opencode") {
        any = true;
        let path = xdg_config_dir().join("opencode/config.json");
        match upsert_opencode(&path, &binary_path) {
            Some(status) => println!("  Opencode: {status}"),
            None => println!("  Opencode: configured"),
        }
    }

    println!();
    if any {
        println!("Done! Restart your MCP client to start using webact.");
    } else {
        println!("  No MCP clients detected. Add manually to your client config:");
        println!();
        println!(
            "  {{ \"mcpServers\": {{ \"webact\": {{ \"command\": \"{binary_path}\", \"args\": [\"mcp\"] }} }} }}"
        );
    }
}

/// Remove webact from all detected MCP clients.
pub fn remove_clients() {
    println!();
    println!("Removing webact from MCP clients...");

    let mut any = false;

    // -- Type C: CLI-based clients --

    if has_binary("claude") {
        let exists = run_silent(&["claude", "mcp", "get", "webact"]);
        if exists {
            any = true;
            if run_silent(&["claude", "mcp", "remove", "-s", "user", "webact"]) {
                println!("  Claude Code: removed");
            } else {
                println!("  Claude Code: failed to remove (try: claude mcp remove -s user webact)");
            }
        }
    }

    if has_binary("codex") {
        if run_grep(&["codex", "mcp", "list"], "webact") {
            any = true;
            if run_silent(&["codex", "mcp", "remove", "webact"]) {
                println!("  Codex: removed");
            } else {
                println!("  Codex: failed to remove (try: codex mcp remove webact)");
            }
        }
    }

    if has_binary("gemini") {
        if run_grep(&["gemini", "mcp", "list"], "webact") {
            any = true;
            if run_silent(&["gemini", "mcp", "remove", "-s", "user", "webact"]) {
                println!("  Gemini CLI: removed");
            } else {
                println!("  Gemini CLI: failed to remove (try: gemini mcp remove -s user webact)");
            }
        }
    }

    // -- Type A: mcpServers config files --

    for client in file_clients_mcp_servers() {
        if let Some(status) = remove_mcp_servers(&client.path) {
            any = true;
            println!("  {}: {status}", client.name);
        }
    }

    // -- Copilot (always check, no binary detection needed for removal) --
    if let Some(home) = dirs::home_dir() {
        let copilot = home.join(".copilot/mcp-config.json");
        if let Some(status) = remove_mcp_servers(&copilot) {
            any = true;
            println!("  Copilot CLI: {status}");
        }
    }

    // -- Type B: Opencode --

    let opencode_path = xdg_config_dir().join("opencode/config.json");
    if let Some(status) = remove_opencode(&opencode_path) {
        any = true;
        println!("  Opencode: {status}");
    }

    println!();
    if any {
        println!("Done! webact has been removed from MCP clients.");
    } else {
        println!("  No MCP client configs found with webact.");
    }
}

// ---------------------------------------------------------------------------
// Client definitions
// ---------------------------------------------------------------------------

enum CreateWhen {
    Never,
    BinaryDetected(&'static str),
}

struct FileClient {
    name: &'static str,
    path: PathBuf,
    create_when: CreateWhen,
}

/// Returns all Type-A (mcpServers) file-based clients for the current platform.
fn file_clients_mcp_servers() -> Vec<FileClient> {
    let mut clients = Vec::new();
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return clients,
    };

    let is_macos = cfg!(target_os = "macos");

    // Claude Desktop
    if is_macos {
        clients.push(FileClient {
            name: "Claude Desktop",
            path: home.join("Library/Application Support/Claude/claude_desktop_config.json"),
            create_when: CreateWhen::Never,
        });
    } else {
        clients.push(FileClient {
            name: "Claude Desktop",
            path: xdg_config_dir().join("Claude/claude_desktop_config.json"),
            create_when: CreateWhen::Never,
        });
    }

    // ChatGPT Desktop
    if is_macos {
        clients.push(FileClient {
            name: "ChatGPT Desktop",
            path: home.join("Library/Application Support/ChatGPT/mcp.json"),
            create_when: CreateWhen::Never,
        });
    } else {
        clients.push(FileClient {
            name: "ChatGPT Desktop",
            path: xdg_config_dir().join("chatgpt/mcp.json"),
            create_when: CreateWhen::Never,
        });
    }

    // Cursor / Agent
    let cursor_name = if has_binary("agent") {
        "Cursor / Agent"
    } else {
        "Cursor"
    };
    clients.push(FileClient {
        name: cursor_name,
        path: home.join(".cursor/mcp.json"),
        create_when: CreateWhen::BinaryDetected("agent"),
    });

    // Windsurf
    clients.push(FileClient {
        name: "Windsurf",
        path: home.join(".codeium/windsurf/mcp_config.json"),
        create_when: CreateWhen::Never,
    });

    // Cline (VSCode)
    if is_macos {
        clients.push(FileClient {
            name: "Cline (VSCode)",
            path: home.join("Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"),
            create_when: CreateWhen::Never,
        });
    } else {
        clients.push(FileClient {
            name: "Cline (VSCode)",
            path: xdg_config_dir().join("Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"),
            create_when: CreateWhen::Never,
        });
    }

    // Cline (Cursor)
    if is_macos {
        clients.push(FileClient {
            name: "Cline (Cursor)",
            path: home.join("Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"),
            create_when: CreateWhen::Never,
        });
    } else {
        clients.push(FileClient {
            name: "Cline (Cursor)",
            path: xdg_config_dir().join("Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"),
            create_when: CreateWhen::Never,
        });
    }

    // Copilot
    clients.push(FileClient {
        name: "Copilot CLI",
        path: home.join(".copilot/mcp-config.json"),
        create_when: CreateWhen::BinaryDetected("copilot"),
    });

    clients
}

// ---------------------------------------------------------------------------
// Type A: mcpServers config file operations
// ---------------------------------------------------------------------------

/// Returns `None` if the file doesn't exist and shouldn't be created (skip silently).
/// Returns `Some(status_message)` otherwise.
fn upsert_mcp_servers(path: &Path, binary_path: &str, create_if_missing: bool) -> Option<String> {
    if !path.exists() {
        if create_if_missing {
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if fs::write(path, "{}\n").is_err() {
                return Some("failed to create config file".into());
            }
        } else {
            return None;
        }
    }

    let raw = match fs::read_to_string(path) {
        Ok(s) => s,
        Err(_) => return Some("failed to read config".into()),
    };

    let mut data = match parse_json_lenient(&raw) {
        Some(v) => v,
        None => return Some("failed to parse config JSON".into()),
    };

    let obj = match data.as_object_mut() {
        Some(o) => o,
        None => return Some("config is not a JSON object".into()),
    };

    let servers = obj
        .entry("mcpServers")
        .or_insert_with(|| json!({}));

    let servers_map = match servers.as_object_mut() {
        Some(m) => m,
        None => return Some("mcpServers is not an object".into()),
    };

    // Check if already configured with matching command
    if let Some(existing) = servers_map.get("webact") {
        if let Some(cmd) = existing.get("command").and_then(Value::as_str) {
            if cmd == binary_path {
                return Some("already configured".into());
            }
        }
    }

    servers_map.insert(
        "webact".into(),
        json!({"command": binary_path, "args": ["mcp"]}),
    );

    match write_json(path, &data) {
        Ok(()) => Some("configured".into()),
        Err(_) => Some("failed to write config".into()),
    }
}

/// Remove webact from an mcpServers config file.
/// Returns `None` if file doesn't exist or has no webact entry.
fn remove_mcp_servers(path: &Path) -> Option<String> {
    if !path.exists() {
        return None;
    }

    let raw = match fs::read_to_string(path) {
        Ok(s) => s,
        Err(_) => return None,
    };

    if !raw.contains("\"webact\"") {
        return None;
    }

    let mut data = match parse_json_lenient(&raw) {
        Some(v) => v,
        None => return Some("failed to parse config JSON".into()),
    };

    let mut removed = false;

    if let Some(obj) = data.as_object_mut() {
        if let Some(servers) = obj.get_mut("mcpServers") {
            if let Some(m) = servers.as_object_mut() {
                if m.remove("webact").is_some() {
                    removed = true;
                }
            }
        }
    }

    if !removed {
        return None;
    }

    match write_json(path, &data) {
        Ok(()) => Some("removed".into()),
        Err(_) => Some("failed to write config".into()),
    }
}

// ---------------------------------------------------------------------------
// Type B: Opencode config file operations
// ---------------------------------------------------------------------------

fn upsert_opencode(path: &Path, binary_path: &str) -> Option<String> {
    if !path.exists() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if fs::write(path, "{}\n").is_err() {
            return Some("failed to create config file".into());
        }
    }

    let raw = match fs::read_to_string(path) {
        Ok(s) => s,
        Err(_) => return Some("failed to read config".into()),
    };

    let mut data = match parse_json_lenient(&raw) {
        Some(v) => v,
        None => return Some("failed to parse config JSON".into()),
    };

    let obj = match data.as_object_mut() {
        Some(o) => o,
        None => return Some("config is not a JSON object".into()),
    };

    let mcp = obj.entry("mcp").or_insert_with(|| json!({}));
    let mcp_map = match mcp.as_object_mut() {
        Some(m) => m,
        None => return Some("mcp key is not an object".into()),
    };

    if mcp_map.contains_key("webact") {
        return Some("already configured".into());
    }

    mcp_map.insert(
        "webact".into(),
        json!({"type": "local", "command": [binary_path, "mcp"]}),
    );

    match write_json(path, &data) {
        Ok(()) => None, // caller prints "configured"
        Err(_) => Some("failed to write config".into()),
    }
}

fn remove_opencode(path: &Path) -> Option<String> {
    if !path.exists() {
        return None;
    }

    let raw = match fs::read_to_string(path) {
        Ok(s) => s,
        Err(_) => return None,
    };

    if !raw.contains("\"webact\"") {
        return None;
    }

    let mut data = match parse_json_lenient(&raw) {
        Some(v) => v,
        None => return Some("failed to parse config JSON".into()),
    };

    let mut removed = false;

    if let Some(obj) = data.as_object_mut() {
        // Check both "mcp" and "mcpServers" keys
        for key in &["mcp", "mcpServers"] {
            if let Some(section) = obj.get_mut(*key) {
                if let Some(m) = section.as_object_mut() {
                    if m.remove("webact").is_some() {
                        removed = true;
                    }
                }
            }
        }
    }

    if !removed {
        return None;
    }

    match write_json(path, &data) {
        Ok(()) => Some("removed".into()),
        Err(_) => Some("failed to write config".into()),
    }
}

// ---------------------------------------------------------------------------
// Type C: CLI-based client helpers
// ---------------------------------------------------------------------------

/// Configure a CLI client where "check" is a command that succeeds when already configured.
fn configure_cli_client(name: &str, check_args: &[&str], add_args: &[&str]) {
    if run_silent(check_args) {
        println!("  {name}: already configured");
        return;
    }
    if run_silent(add_args) {
        println!("  {name}: configured");
    } else {
        let cmd = add_args.join(" ");
        println!("  {name}: failed to configure (try: {cmd})");
    }
}

/// Configure a CLI client where "check" requires grepping the list output.
fn configure_cli_client_grep(
    name: &str,
    list_args: &[&str],
    grep_pattern: &str,
    add_args: &[&str],
) {
    if run_grep(list_args, grep_pattern) {
        println!("  {name}: already configured");
        return;
    }
    if run_silent(add_args) {
        println!("  {name}: configured");
    } else {
        let cmd = add_args.join(" ");
        println!("  {name}: failed to configure (try: {cmd})");
    }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/// Check if a binary exists on PATH.
fn has_binary(name: &str) -> bool {
    Command::new("which")
        .arg(name)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Run a command silently and return whether it succeeded.
fn run_silent(args: &[&str]) -> bool {
    if args.is_empty() {
        return false;
    }
    Command::new(args[0])
        .args(&args[1..])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Run a command and check if its stdout contains a pattern.
fn run_grep(args: &[&str], pattern: &str) -> bool {
    if args.is_empty() {
        return false;
    }
    Command::new(args[0])
        .args(&args[1..])
        .stderr(Stdio::null())
        .output()
        .map(|o| {
            let stdout = String::from_utf8_lossy(&o.stdout);
            stdout.contains(pattern)
        })
        .unwrap_or(false)
}

/// Get the XDG config directory, defaulting to `~/.config`.
fn xdg_config_dir() -> PathBuf {
    if let Ok(dir) = env::var("XDG_CONFIG_HOME") {
        if !dir.is_empty() {
            return PathBuf::from(dir);
        }
    }
    match dirs::home_dir() {
        Some(h) => h.join(".config"),
        None => PathBuf::from("/tmp"),
    }
}

/// Parse JSON leniently by stripping trailing commas before `}` or `]`.
fn parse_json_lenient(raw: &str) -> Option<Value> {
    // Try strict parse first
    if let Ok(v) = serde_json::from_str::<Value>(raw) {
        return Some(v);
    }
    // Strip trailing commas: `,` followed by optional whitespace then `}` or `]`
    let cleaned = strip_trailing_commas(raw);
    serde_json::from_str::<Value>(&cleaned).ok()
}

/// Remove trailing commas before closing braces/brackets.
fn strip_trailing_commas(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut result = Vec::with_capacity(bytes.len());
    let mut i = 0;

    while i < bytes.len() {
        if bytes[i] == b',' {
            // Look ahead past whitespace for } or ]
            let mut j = i + 1;
            while j < bytes.len() && matches!(bytes[j], b' ' | b'\t' | b'\n' | b'\r') {
                j += 1;
            }
            if j < bytes.len() && matches!(bytes[j], b'}' | b']') {
                // Skip the comma, keep the whitespace
                i += 1;
                continue;
            }
        }
        result.push(bytes[i]);
        i += 1;
    }

    // Safety: we only removed ASCII commas from valid UTF-8
    String::from_utf8(result).unwrap_or_else(|_| s.to_string())
}

/// Write a serde_json Value to a file with pretty-printing and trailing newline.
fn write_json(path: &Path, data: &Value) -> Result<(), std::io::Error> {
    let serialized = serde_json::to_string_pretty(data).map_err(|e| {
        std::io::Error::new(std::io::ErrorKind::Other, e)
    })?;
    fs::write(path, format!("{serialized}\n"))
}
