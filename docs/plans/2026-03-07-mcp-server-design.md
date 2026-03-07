# MCP Server Design for webact

## Goal

Add a stdio MCP server so webact can be used with Claude Desktop, ChatGPT Desktop, and other MCP-compatible clients. Two implementations: Node.js (ships via npm) and Rust (standalone binary, no runtime dependency).

## Architecture

Both servers embed webact logic directly — no shelling out to a CLI subprocess.

```
stdin (JSON-RPC) → MCP handler → webact command dispatch → capture output → JSON-RPC response → stdout
```

### Node.js server (`skills/webact/mcp.js`)

- New entry point alongside `webact.js`
- Imports internal modules (`lib/commands/*`, `lib/cdp.js`, etc.) directly
- Captures stdout by replacing `console.log` during tool execution
- New npm binary: `webact-mcp`
- No new dependencies — readline + JSON over stdin/stdout

### Rust server (`skills/webact-rs/src/mcp_main.rs`)

- Second binary target in Cargo.toml: `webact-mcp`
- Calls `commands::dispatch()` directly
- Captures output via `output: String` field on `AppContext` (replace `println!` with writes to buffer)
- No new dependencies — tokio stdin/stdout + serde_json already present

## MCP Protocol

Minimal JSON-RPC implementation, no SDK dependency:

1. Read newline-delimited JSON from stdin
2. `initialize` → return capabilities (`tools`)
3. `tools/list` → return tool definitions with JSON schemas
4. `tools/call` → dispatch to webact, return result
5. Write JSON-RPC response to stdout

## Tool Definitions

Each webact command becomes an individual MCP tool with full JSON schema. ~42 tools total. Individual tools (vs single `webact` tool with command param) so LLMs get full schema and description for each.

| Tool | Inputs | Description |
|------|--------|-------------|
| `webact_launch` | — | Launch Chrome and create session |
| `webact_navigate` | `url` | Navigate to URL |
| `webact_dom` | `selector?`, `max_tokens?` | Get compact DOM |
| `webact_axtree` | `interactive?`, `diff?`, `selector?`, `max_tokens?` | Accessibility tree |
| `webact_observe` | — | Interactive elements as commands |
| `webact_find` | `query` | Find element by description |
| `webact_screenshot` | — | Capture screenshot (returns image) |
| `webact_pdf` | `path?` | Save page as PDF |
| `webact_click` | `target` | Click (selector, x,y, or --text) |
| `webact_doubleclick` | `target` | Double-click |
| `webact_rightclick` | `target` | Right-click |
| `webact_hover` | `target` | Hover |
| `webact_focus` | `selector` | Focus element |
| `webact_clear` | `selector` | Clear input |
| `webact_type` | `selector`, `text` | Type into element |
| `webact_keyboard` | `text` | Type at caret |
| `webact_paste` | `text` | Paste via clipboard event |
| `webact_press` | `key` | Key or combo |
| `webact_select` | `selector`, `values` (array) | Select dropdown option(s) |
| `webact_upload` | `selector`, `files` (array) | Upload file(s) |
| `webact_drag` | `from`, `to` | Drag and drop |
| `webact_scroll` | `target`, `pixels?` | Scroll page or element |
| `webact_eval` | `expression` | Evaluate JavaScript |
| `webact_dialog` | `action`, `text?` | Handle dialog |
| `webact_waitfor` | `selector`, `timeout?` | Wait for element |
| `webact_waitfornav` | `timeout?` | Wait for navigation |
| `webact_cookies` | `action`, `name?`, `value?`, `domain?` | Manage cookies |
| `webact_console` | `action?` | Console output |
| `webact_network` | `action?`, `duration?`, `filter?` | Network capture |
| `webact_block` | `patterns` (array) | Block resources |
| `webact_viewport` | `preset_or_width`, `height?` | Set viewport |
| `webact_frames` | — | List frames |
| `webact_frame` | `target` | Switch frame |
| `webact_tabs` | — | List session tabs |
| `webact_tab` | `id` | Switch tab |
| `webact_newtab` | `url?` | Open new tab |
| `webact_close` | — | Close current tab |
| `webact_back` | — | Go back |
| `webact_forward` | — | Go forward |
| `webact_reload` | — | Reload page |
| `webact_activate` | — | Bring browser to front |
| `webact_minimize` | — | Minimize browser |
| `webact_humanclick` | `target` | Human-like click |
| `webact_humantype` | `selector`, `text` | Human-like typing |
| `webact_lock` | `seconds?` | Lock tab |
| `webact_unlock` | — | Unlock tab |
| `webact_download` | `action?`, `path?` | Manage downloads |

## Special Cases

- **`webact_screenshot`**: Returns `type: "image"` content with base64 PNG + mime type. All other tools return `type: "text"`.
- **Errors**: Command errors become `isError: true` in MCP response with error message as text content. Protocol errors return standard JSON-RPC errors.
- **Session persistence**: `AppContext` lives for the MCP server process lifetime. First `webact_launch` creates session, subsequent calls reuse it.

## Configuration

### Claude Desktop (`claude_desktop_config.json`)

Node.js:
```json
{
  "mcpServers": {
    "webact": {
      "command": "npx",
      "args": ["@kilospark/webact-mcp"]
    }
  }
}
```

Rust (standalone binary):
```json
{
  "mcpServers": {
    "webact": {
      "command": "webact-mcp"
    }
  }
}
```

## Package Changes

### Node.js (`skills/webact/package.json`)
- Add `mcp.js` entry point
- Add `"webact-mcp": "./mcp.js"` to `bin`
- Add `mcp.js` to `files` array

### Rust (`skills/webact-rs/Cargo.toml`)
- Add `[[bin]]` target: `name = "webact-mcp"`, `path = "src/mcp_main.rs"`

## Output Capture

### Node.js
Replace `console.log` with a capture function during tool execution, restore after. Accumulate into a string buffer, return as MCP text content.

### Rust
Add `output: String` field to `AppContext`. Provide a `write_output!` macro or helper method. Commands write to buffer instead of stdout. After dispatch, drain buffer and return as MCP content.
