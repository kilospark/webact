# webact - token-efficient browser control for AI agents

A highly token efficient agent skill that lets you control any Chromium-based browser via the Chrome DevTools Protocol. Works with Claude Code, Cursor, Codex, Windsurf, Cline, Copilot, OpenCode, Goose, and any tool supporting the [Agent Skills](https://agentskills.io) spec. Give the agent a goal - "check my inbox", "top stories on Hacker News", "search for flights" - and it drives the browser to get it done.

No Playwright, no browser automation frameworks. Raw CDP over WebSocket.

## Install

```bash
npx skills add kilospark/webact
```

Already installed? Update to latest:

```bash
npx skills update
```

Works with Claude Code, Cursor, Codex, Windsurf, Cline, Copilot, OpenCode, Goose, and [40+ agents](https://github.com/vercel-labs/skills). Powered by Vercel's [skills](https://github.com/vercel-labs/skills) CLI.

> **Note (Codex):** Codex's sandbox blocks local networking by default. To allow CDP connections, add a rule to allow `node` access to `localhost` on the CDP port (auto-discovered at launch), or run with `--full-auto` mode.

### Manual

```bash
git clone https://github.com/kilospark/webact.git /tmp/webact
cp -r /tmp/webact/skills/webact .agents/skills/webact
```

Any tool supporting the [Agent Skills spec](https://agentskills.io) will auto-discover it from `.agents/skills/`.

## Usage

Just tell your agent what you want:

```
check the top stories on Hacker News
navigate to github.com and show my notifications
search google for "best restaurants near me"
```

Or describe any goal - the agent will figure out the steps.

## How it works

The agent follows a **perceive-act loop**:

1. **Plan** - break the goal into steps
2. **Act** - navigate, click, type via CDP commands
3. **Perceive** - read the DOM to see what happened
4. **Decide** - adapt, continue, or report results
5. **Repeat** - until the goal is done

DOM is read first for token efficiency. Screenshots are a fallback for visual-heavy pages.

## Rust port (experimental)

An incremental side-by-side Rust port lives in [`skills/webact-rs`](skills/webact-rs).

- JS remains the primary implementation in `skills/webact/webact.src.js`
- Rust now implements the full command surface for side-by-side parity testing (see tracker for known behavioral differences)
- Command parity tracker: [`skills/webact-rs/PORTING.md`](skills/webact-rs/PORTING.md)

Current code layout after monolith split:
- JS runtime helpers: `skills/webact/lib/browser.js`, `skills/webact/lib/state.js`, `skills/webact/lib/cdp.js`
- JS command entrypoint: `skills/webact/webact.src.js`
- Rust orchestration/runtime: `skills/webact-rs/src/main.rs`
- Rust command handlers: `skills/webact-rs/src/commands.rs`

## Sessions

Each agent invocation gets its own **session** with isolated tab tracking. On `launch`, a unique session ID is generated and a fresh Chrome tab is created for that session.

- Multiple agents can work side by side in the same Chrome instance
- Each session only sees and controls its own tabs
- Commands are passed via a JSON file, so the bash command stays the same throughout a session (only needs one user approval)

## CLI

The `webact` CLI wraps CDP:

```bash
webact launch                  # Start browser, create session
webact connect                 # Attach to already-running Chrome (no launch)
webact navigate <url>          # Go to a URL
webact back                    # Go back in history
webact forward                 # Go forward in history
webact reload                  # Reload the current page
webact dom                     # Get compact DOM (~4000 chars)
webact dom <selector>          # Get DOM subtree
webact dom --full              # Full DOM without truncation
webact dom --tokens=N          # Truncate DOM to ~N tokens
webact axtree                  # Get accessibility tree (semantic roles + names)
webact axtree -i               # Interactive elements with ref numbers
webact axtree -i --diff        # Show only changes since last snapshot
webact axtree -i --tokens=N    # Truncate output to ~N tokens
webact axtree <selector>       # Get AX tree for a specific element
webact observe                 # Show interactive elements as ready-to-use commands
webact find <query>            # Find element by description (e.g. find "login button")
webact screenshot              # Capture screenshot
webact pdf [path]              # Save page as PDF
webact click <sel|x,y|--text>  # Click by selector, coordinates, or text match
webact doubleclick <sel|x,y|--text>  # Double-click
webact rightclick <sel|x,y|--text>   # Right-click (context menu)
webact hover <sel|x,y|--text>        # Hover (tooltips/menus)
webact focus <selector>        # Focus an element without clicking
webact clear <selector>        # Clear an input field or contenteditable
webact type <selector> <text>  # Type into an input (focuses first)
webact keyboard <text>         # Type at current caret position (no selector)
webact paste <text>            # Paste via clipboard event (for rich editors)
webact select <sel> <value>    # Select option(s) from a <select> dropdown
webact upload <sel> <file>     # Upload file(s) to a file input
webact humanclick <sel|x,y>    # Click with human-like mouse movement + timing
webact humantype <sel> <text>  # Type with variable delays, occasional pauses
webact drag <from> <to>        # Drag from one selector to another
webact dialog accept|dismiss   # Handle alert/confirm/prompt dialogs
webact waitfor <sel> [ms]      # Wait for element to appear (default 5s)
webact waitfornav [ms]         # Wait for navigation to complete (default 10s)
webact press <key>             # Press a key or combo (Enter, Ctrl+A, Meta+C)
webact scroll <target> [px]    # Scroll: up, down, top, bottom, or selector
webact eval <js>               # Run JavaScript in page context
webact cookies                 # List cookies for current page
webact cookies set <n> <v>     # Set a cookie
webact cookies delete <name>   # Delete a cookie
webact cookies clear           # Clear all cookies
webact console                 # Show recent console output
webact console errors          # Show only JS errors
webact console listen          # Real-time console output (until Ctrl+C)
webact block <pattern>         # Block requests: images, css, fonts, media, scripts, or URL
webact block --ads             # Block ads, analytics, and tracking (40+ patterns)
webact block off               # Disable request blocking
webact viewport <preset|w h>   # Set viewport (mobile, tablet, desktop, iphone, ipad)
webact frames                  # List all frames/iframes
webact frame <id|sel>          # Switch to a frame
webact frame main              # Return to main frame
webact download path /tmp/dl   # Set download directory
webact download list           # List downloaded files
webact tabs                    # List this session's tabs
webact tab <id>                # Switch to a session-owned tab
webact newtab [url]            # Open a new tab in this session
webact close                   # Close current tab
webact lock [ttl]              # Lock current tab to this session (default 300s)
webact unlock                  # Unlock current tab
webact activate                # Bring browser window to front (macOS)
webact minimize                # Minimize browser window (macOS)
webact run <sessionId>         # Run command from session command file
```

**Ref-based targeting:** After `axtree -i` or `observe`, use the ref numbers directly as selectors - `click 1`, `type 3 hello`. Cached per URL.

The agent workflow: `launch` prints a session ID and command file path. Write command JSON to that file, then `webact run <sessionId>`.

## Token Stats

Each command is designed to minimize token usage while giving the agent enough context to decide its next step.

| Command | webact output | Playwright equivalent | Savings |
|---------|--------------|----------------------|---------|
| **brief** (auto) | ~200 chars | No equivalent - `page.content()` returns ~50k–500k chars of raw HTML | **~99%** |
| **dom** | ~1k–4k chars (compact, truncated) | `page.content()` ~50k–500k chars (full raw HTML) | **~95%** |
| **dom \<selector\>** | ~200–4k chars (scoped subtree) | `locator.innerHTML()` ~1k–50k chars (raw HTML subtree) | **~80%** |
| **axtree -i** | ~500–1.5k chars (flat numbered list) | `page.accessibility.snapshot()` ~10k–50k chars (full JSON tree) | **~95%** |
| **axtree** | ~2k–6k chars (semantic tree) | `page.accessibility.snapshot()` ~10k–50k chars (full JSON tree) | **~80%** |
| **observe** | ~500–1.5k chars (ready-to-use commands) | No equivalent | - |
| **screenshot** | ~100k+ (base64 PNG) | `page.screenshot()` ~100k+ (same) | same |
| **console** | 200 chars/entry (truncated) | `page.on('console')` unbounded per entry | **~60%** |
| **cookies** | 60 chars/value (truncated) | `context.cookies()` full JSON objects (~200–500 chars/cookie) | **~70%** |
| **eval** | varies | `page.evaluate()` same | same |

**Recommended flow for minimal token usage:**
1. State-changing commands auto-print the **brief** (~200 chars) - often enough to decide next step
2. Need to find a specific element? Use **axtree -i** (~500 tokens) over **dom** (~4,000 chars)
3. Use **dom \<selector\>** to scope to a subtree instead of reading the whole page
4. Reserve **screenshot** for visual-heavy pages where DOM/axtree are insufficient

## vs. Playwright-based tools

Several tools give AI agents browser control on top of Playwright: [agent-browser](https://github.com/vercel-labs/agent-browser) (Vercel), [Playwright MCP](https://github.com/microsoft/playwright-mcp) (Microsoft), [Stagehand](https://github.com/browserbase/stagehand) (Browserbase), and [Browser Use](https://github.com/browser-use/browser-use). They share the same Playwright foundation - bundled Chromium, accessibility tree snapshots, ~200 MB+ install. Comparison measured against agent-browser; output sizes are representative of the family.

|  | **webact** | **Playwright-based tools** |
|--|-----------|--------------------------|
| **What it is** | Browser CLI for agents - raw CDP, single file | CLI / MCP server / SDK wrapping Playwright |
| **Architecture** | CLI connects directly to Chrome via CDP WebSocket | CLI/SDK &rarr; IPC &rarr; Playwright &rarr; bundled Chromium |
| **Install size** | 228 KB on disk (bundled CLI, zero deps) | ~200 MB+ (node_modules + Chromium download) |
| **Setup** | `npm install -g` + skill registration | npm install + browser download |
| **Uses your browser** | Yes - your Chrome, your cookies, your logins | No - launches bundled Chromium with clean state |
| **User agent** | Your real Chrome user agent - no bot fingerprint | Modified Playwright/Chromium UA - detectable by sites |
| **Headed mode** | Always - you see what the agent sees | Headless by default |
| **Auth / logins** | Already signed in - uses your real browser session | Requires auth setup, state persistence, or login flows |

### Token comparison (same pages, measured output)

Tested on the same pages at the same time using agent-browser (representative of Playwright-based output). Chars shown; divide by ~4 for approximate tokens.

| Scenario | **webact** | **Playwright-based*** | Savings | Page |
|----------|-----------|------------------|---------|------|
| **Navigate + see page** | `navigate` = 186 chars | `open` + `snapshot -i` = 7,974 chars | **98%** | Hacker News |
| **Navigate + see page** | `navigate` = 756 chars | `open` + `snapshot -i` = 8,486 chars | **91%** | GitHub repo |
| **Full page read** | `dom` = 4,051 chars | `snapshot` = 46,565 chars | **91%** | Hacker News |
| **Full page read** | `dom` = 4,049 chars | `snapshot` = 104,890 chars | **96%** | GitHub repo |
| **Interactive elements** | `axtree -i` = 5,997 chars | `snapshot -i` = 7,901 chars | **24%** | Hacker News |
| **Interactive elements** | `axtree -i` = 6,019 chars | `snapshot -i` = 8,337 chars | **28%** | GitHub repo |

webact's `navigate` auto-prints a brief with page summary, inputs, links, and element counts - enough to decide the next step in one call. agent-browser's `open` only prints URL and title, so the agent always needs a follow-up `snapshot` to see the page.

For full page reading, webact's `dom` is truncated to ~4k chars by default. agent-browser's `snapshot` returns the full accessibility tree (46k-105k chars). On a GitHub repo page, that's **26x** more tokens.

For interactive elements, both tools offer a flat list with refs. webact's `axtree -i` is ~25-28% smaller than agent-browser's `snapshot -i`.

**When to use webact:** You want zero-setup browser control using your actual logged-in Chrome, with minimal token overhead. One file, no downloads.

**When to use Playwright-based tools:** You need headless Chromium, cloud browser infra, device emulation, network mocking, cross-browser support, or iOS simulator. You're OK with the install size and Playwright dependency.

## MCP Server

webact also ships as an MCP server for Claude Desktop, Claude Code, ChatGPT Desktop, Cursor, Windsurf, Cline, Codex, and other MCP-compatible clients. Each webact command is exposed as an individual tool with full JSON schema.

### Install (Rust binary — no Node.js required)

```bash
curl -fsSL https://raw.githubusercontent.com/kilospark/webact/main/install.sh | sh
```

Downloads the `webact-mcp` binary and auto-configures any detected MCP clients (Claude Desktop, Claude Code, ChatGPT Desktop, Cursor, Windsurf, Cline, Codex).

### Install (Node.js)

If you already have Node.js, add directly to your MCP client config:

```json
{
  "mcpServers": {
    "webact": {
      "command": "npx",
      "args": ["-y", "@kilospark/webact"]
    }
  }
}
```

### Manual config

If you installed via the curl script but need to add to a client manually:

```json
{
  "mcpServers": {
    "webact": {
      "command": "webact-mcp"
    }
  }
}
```

For Claude Code:

```bash
claude mcp add webact webact-mcp
```

## Requirements

- Any Chromium-based browser: Google Chrome, Microsoft Edge, Brave, Arc, Vivaldi, Opera, or Chromium
- Node.js (for agent skill install) or the Rust binary (no runtime dependencies)

Auto-detected on macOS, Linux, Windows, and WSL (finds the Windows host browser automatically). Set `CHROME_PATH` to override.

## License

MIT
