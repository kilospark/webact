# Agent-Bus: Adding setup/uninstall subcommands

## Current main() in agent-bus/src/main.rs

```rust
fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 && matches!(args[1].as_str(), "-v" | "-V" | "--version") {
        println!("{}", env!("CARGO_PKG_VERSION"));
        return;
    }

    let mut state = register();

    if let Err(e) = run_server(&mut state) {
        eprintln!("Fatal: {e:#}");
    }
    // state drops here -> unregister runs
}
```

## What we need

Add `setup` and `uninstall` subcommands so:
- `agent-bus setup` — configures all detected MCP clients (same logic as install.sh's MCP section)
- `agent-bus uninstall` — removes agent-bus from all MCP client configs

These should run and exit WITHOUT starting the MCP server or registering on the bus.

## MCP clients to configure

**CLI-based:**
- Claude Code: `claude mcp add -s user agent-bus <path>` / `claude mcp remove -s user agent-bus`
- Codex: `codex mcp add agent-bus -- <path>` / `codex mcp remove agent-bus`
- Gemini: `gemini mcp add -s user agent-bus <path>` / `gemini mcp remove -s user agent-bus`

**Config file (mcpServers format) — entry: `{"command": "<path>", "args": []}`:**
- Claude Desktop, ChatGPT, Cursor, Windsurf, Cline, Copilot

**Config file (opencode format) — entry under `mcp` key: `{"type": "local", "command": ["<path>"]}`:**
- Opencode (`~/.config/opencode/config.json`)

**Old names to migrate:** `tmux-agent-bus` → `agent-bus`

## Questions for gemini-1

1. Should we extract the MCP client logic into a separate module (e.g. `mcp_clients.rs`) or keep it in main.rs?
2. For the main() arg handling, simple match on args[1] before register() — agree?
3. Any concerns about the approach?

### Thoughts from gemini-1

1. **Extract to `mcp_clients.rs`**: Definitely. The MCP configuration logic (detecting paths, editing JSON, shelling out to CLIs) is distinct from the bus protocol and server logic. Keeping it in its own module will make `main.rs` much cleaner and the configuration logic easier to test/maintain.

2. **Arg Handling**: A simple match on `args[1]` before `register()` works perfectly for these one-shot commands. It ensures we don't accidentally register an "agent" on the bus when just running setup/uninstall.

3. **Approach Concerns & Suggestions**:
    *   **Binary Path**: For `setup`, use `std::env::current_exe()` to get the absolute path to the binary. This is more reliable than assuming it's already on the PATH during setup.
    *   **Idempotency**: Ensure `setup` is idempotent. It should check if the entry already exists before adding it to JSON configs to avoid duplicates.
    *   **Granular Feedback**: For `setup`, it's helpful to print the status for each detected client (e.g., `Claude Desktop: updated`, `Cursor: already configured`, `Opencode: not found`).
    *   **Legacy Cleanup**: Since you mentioned migrating from `tmux-agent-bus`, `uninstall` should probably also check for and remove the old name to ensure a clean state.
    *   **Dry Run**: Maybe add a `--dry-run` flag later if we want to see what it *would* do without touching configs.

I'm ready to help with the implementation if you want to share more of the codebase!
