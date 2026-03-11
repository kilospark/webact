---
name: webact
description: Use when the user asks to interact with a website, browse the web, check a site, send a message, read content from a web page, or accomplish any goal that requires controlling a browser
---

# WebAct Browser Control

Control Chrome directly via the Chrome DevTools Protocol. Raw CDP through a CLI helper.

**If you have webact MCP tools available (e.g. `webact_navigate`, `webact_click`), stop here and use those instead.** The MCP server handles session management and tab isolation automatically. The rest of this file is for CLI-only environments where MCP tools are not available.

## How to Run Commands

All commands use the `webact` CLI (the `webact` binary). Use the binary on PATH.

### Session Setup (once)

```bash
webact launch
```

This launches Chrome (or connects to an existing instance) and creates a session. All subsequent commands auto-discover the session - no session ID needed.

### Running Commands

Use direct CLI commands. Each is a single bash call:

```bash
webact navigate https://example.com
webact click button.submit
webact keyboard "hello world"
webact press Enter
webact dom
```

**Auto-brief:** State-changing commands (navigate, click, hover, press Enter/Tab, scroll, select, waitfor) auto-print a compact page summary showing URL, title, inputs, buttons, links, and total element counts. Read it first. Do not take a screenshot after every action. Use `axtree -i` or `observe` when you need actionable elements, `read` for content, `dom` only when you need HTML structure.

### Command Reference

| Command | Example |
|---------|---------|
| `navigate <url>` | `webact navigate https://example.com` |
| `back` | `webact back` |
| `forward` | `webact forward` |
| `reload` | `webact reload` |
| `read [selector] [--tokens=N]` | `webact read` or `webact read article` or `webact read --tokens=2000` |
| `text [selector] [--tokens=N]` | `webact text` or `webact text --tokens=2000` |
| `dom [selector] [--tokens=N]` | `webact dom` or `webact dom .results` or `webact dom --tokens=1000` |
| `axtree [selector] [-i]` | `webact axtree` or `webact axtree -i` |
| `observe` | `webact observe` |
| `screenshot [options]` | `webact screenshot` or `webact screenshot --ref=3` or `webact screenshot --selector=.main --high` |
| `fill <sel val ...>` | `webact fill "#email" "user@example.com" "#pass" "secret"` |
| `pdf [path]` | `webact pdf` or `webact pdf /tmp/page.pdf` |
| `click <sel\|x,y\|--text>` | `webact click button.submit` or `click 550,197` or `click --text Close` |
| `doubleclick <sel\|x,y\|--text>` | `webact doubleclick td.cell` or `doubleclick 550,197` |
| `rightclick <sel\|x,y\|--text>` | `webact rightclick .context-target` or `rightclick 550,197` |
| `hover <sel\|x,y\|--text>` | `webact hover .menu-trigger` or `hover --text Settings` |
| `focus <selector>` | `webact focus input[name=q]` |
| `clear <selector>` | `webact clear input[name=q]` |
| `type <selector> <text>` | `webact type input[name=q] search query` |
| `keyboard <text>` | `webact keyboard hello world` |
| `paste <text>` | `webact paste Hello world` |
| `select <selector> <value>` | `webact select select#country US` |
| `upload <selector> <file>` | `webact upload input[type=file] /tmp/photo.png` |
| `drag <from> <to>` | `webact drag .card .dropzone` |
| `dialog <accept\|dismiss> [text]` | `webact dialog accept` |
| `waitfor <selector> [ms]` | `webact waitfor .dropdown 5000` |
| `waitfornav [ms]` | `webact waitfornav` |
| `press <key\|combo>` | `webact press Enter` or `webact press Ctrl+A` |
| `scroll <target> [px]` | `webact scroll down 500` or `webact scroll top` |
| `eval <js>` | `webact eval document.title` |
| `cookies [get\|set\|clear\|delete]` | `webact cookies` or `webact cookies set name val` |
| `console [show\|errors\|listen]` | `webact console` or `webact console errors` |
| `network [capture\|show]` | `webact network capture 10 api` or `webact network show cloudwatch` |
| `block <pattern>` | `webact block images css` or `webact block off` |
| `viewport <w> <h>` | `webact viewport mobile` or `webact viewport 1024 768` |
| `zoom <level>` | `webact zoom 50` or `webact zoom out` or `webact zoom reset` |
| `frames` | `webact frames` |
| `frame <id\|selector>` | `webact frame main` or `webact frame iframe#embed` |
| `download [path\|list]` | `webact download path /tmp/dl` or `webact download list` |
| `tabs` | `webact tabs` |
| `tab <id>` | `webact tab ABC123` |
| `newtab [url]` | `webact newtab https://example.com` |
| `close` | `webact close` |
| `activate` | `webact activate` |
| `minimize` | `webact minimize` |
| `config <get\|set> [key] [value]` | `webact config get` or `webact config set telemetry false` |

**`type` vs `keyboard` vs `paste`:** Use `type` to focus a specific input and fill it. Use `keyboard` to type at the current caret position - essential for rich text editors (Slack, Google Docs, Notion) where `type`'s focus call resets the cursor. Use `paste` to insert text via a ClipboardEvent - works with apps that intercept paste (Google Docs, Notion) and is faster than `keyboard` for large text.

**`click` behavior:** Prefer refs from `axtree -i` or `observe`. Otherwise use a CSS selector or `--text`. Waits up to 5s for the element, scrolls it into view, then clicks. When multiple elements match `--text`, interactive elements (button, a, input, [role=button]) are preferred over generic containers (div, span). Use coordinates from a screenshot only as a last resort for canvas/image/iframe-heavy pages where ref, text, and selector targeting have all failed.

**`fill`:** Fill multiple form fields in one call. Pass alternating selector/value pairs: `fill "#email" "user@example.com" "#password" "secret"`. More efficient than multiple `type` calls. Supports ref numbers from `axtree -i`.

**`screenshot` options:** Expensive (~500+ vision tokens). Defaults to 800px wide JPEG for token efficiency. Use `--ref=N` to crop to a ref number from `axtree -i` (cheapest visual option), `--selector=CSS` to crop to an element, `--high` for full viewport resolution, `--format=png` for lossless, `--quality=N` (1-100), `--pad=N` to control padding around ref/selector crops (default: 48).

**`dialog` behavior:** Sets a one-shot auto-handler. Run BEFORE the action that triggers the dialog.

**`read`:** Reader-mode text extraction. Strips navigation, sidebars, ads, and returns just the main content as clean text with headings, lists, and paragraphs. Best for articles, docs, search results, and information retrieval.

**`text`:** Full page in reading order, interleaving static text with interactive elements (numbered refs). Like a screen reader view. Generates ref map as side effect, so you can use ref numbers in click/type/etc afterward. Best for complex pages where you need both content and interaction targets.

**`axtree` vs `dom`:** The accessibility tree shows semantic roles (button, link, heading, textbox) and accessible names - better for understanding page structure. Use `dom` when you need HTML structure/selectors; use `axtree` when you need to understand what's on the page.

**`axtree -i` (interactive mode):** Shows only actionable elements (buttons, links, inputs, etc.) as a flat numbered list. Most token-efficient way to see what you can interact with on a page. After running `axtree -i`, use the ref numbers directly as selectors: `click 1`, `type 3 hello`. Refs are cached per URL and reused on revisits.

**`observe`:** Like `axtree -i` but formats each element as a ready-to-use command (e.g. `click 1`, `type 3 <text>`, `select 5 <value>`). Generates the ref map as a side effect.

**Ref-based targeting:** After `axtree -i` or `observe`, numeric refs work in all selector-accepting commands: `click`, `type`, `select`, `hover`, `focus`, `clear`, `doubleclick`, `rightclick`, `upload`, `drag`, `waitfor`, `dom`.

**`press` combos:** Supports modifier keys: `Ctrl+A` (select all), `Ctrl+C` (copy), `Meta+V` (paste on Mac), `Shift+Enter`, etc. Modifiers: Ctrl, Alt, Shift, Meta/Cmd.

**Mac keyboard note:** On macOS, app shortcuts documented as `Ctrl+Alt+<key>` (e.g., Google Docs heading shortcuts `Ctrl+Alt+1` through `Ctrl+Alt+6`) must be sent as `Meta+Alt+<key>` through CDP. Mac's Ctrl key is not the Command key these apps expect. Example: `press Meta+Alt+2` for Heading 2 in Google Docs.

**`scroll` targets:** `up`/`down` (default 400px, or specify pixels), `top`/`bottom`, or a CSS selector to scroll an element into view. **Element-scoped:** `scroll <selector> <up|down|top|bottom> [px]` scrolls within a container element instead of the page — essential for apps with custom scroll containers (Google Docs, Slack).

**`network` capture:** Captures XHR/fetch/API requests for a duration. `network capture 10` captures for 10 seconds. `network capture 15 api/query` captures for 15s, filtering to URLs containing "api/query". `network show` re-displays the last capture. `network show cloudwatch` filters saved results. Shows method, URL, status, type, timing, and POST body. Essential for diagnosing API issues in SPAs.

**`block` patterns:** Block resource types (`images`, `css`, `fonts`, `media`, `scripts`) or URL substrings. Speeds up page loads. Use `block off` to disable.

**`viewport` presets:** `mobile` (375x667), `iphone` (390x844), `ipad` (820x1180), `tablet` (768x1024), `desktop` (1280x800). Or specify exact width and height.

**`frames`:** Lists all frames/iframes on the page. Use `frame <id>` to switch context, `frame main` to return to the top frame.

### Tab Isolation

Each session creates and owns its own tabs. Sessions never reuse tabs from other sessions or pre-existing tabs.

- `launch`/`connect` creates a **new blank tab** for the session
- `newtab` opens an additional tab within the session
- `tabs` only lists tabs owned by the current session
- `tab <id>` only switches to session-owned tabs
- `close` removes the tab from the session

This means two agents can work side by side in the same Chrome instance without interfering with each other.

**Shared Chrome awareness:** When multiple agents share Chrome, link clicks on sites like Slack can hijack your tab (e.g. Slack's link unfurling navigates to Jira). Always record your tab ID after `launch`/`newtab` and verify you're on the right tab before acting. If your tab's URL has changed unexpectedly, use `tab <id>` to switch back or `tabs` to audit your session.

## The Perceive-Act Loop

Do not take a screenshot to discover page content or interactive elements unless text tools have already failed.

1. **PLAN** — Break the goal into steps.
2. **ACT** — Run the appropriate command. State-changing commands auto-print a page brief.
3. **DECIDE** — Read the brief first. Then choose the cheapest sufficient perception tool:
   - Need page content? → `read`
   - Need actionable elements? → `axtree -i` or `observe`, then target by ref
   - Need full visible text plus refs? → `text`
   - Need selectors or HTML structure? → `dom`
   - Need visual-only information? → `screenshot` as fallback, starting with `--ref`/`--selector` crops
   - Need more context at similar cost? → `zoom out` before screenshotting
   - Need more pixel detail? → `--high` only after low-res was insufficient
4. **REPEAT** until done or blocked.

## Rules

<HARD-RULES>

1. **Read the brief after acting.** State-changing commands auto-print a page brief. Read it before deciding your next step. Use `dom` only when the brief isn't enough (e.g., you need to find a specific element's selector in a complex page).

2. **Text tools before screenshot.** Use `read`, `axtree -i`, `observe`, `text`, or `dom` first. Only use `screenshot` when the page is canvas/image-heavy, you need visual verification, or all text tools are insufficient. When you do screenshot, start with `--ref=N` or `--selector` crops — not full page.

3. **Report actual content.** When the goal is information retrieval, extract and present the actual text from the page. Do not summarize what you think is there - show what IS there.

4. **Stop when blocked.** If you encounter a login wall, CAPTCHA, 2FA prompt, or cookie consent that blocks progress, first run `activate` to bring the browser window to the front so the user can see it, then tell the user. Do not guess credentials or attempt to bypass security. Once the blocker is resolved and you resume automation, run `minimize` before your next action so the browser doesn't steal focus from the user. Minimizing does not affect page focus — the active element and caret position are preserved.

5. **Wait for dynamic content.** After clicks that trigger page loads, use `waitfornav` or `waitfor <selector>` before reading DOM.

6. **Prefer ref-based targeting.** Use refs from `axtree -i`, `observe`, or `text` for click, type, select, hover, screenshot crops, and all other interactions. Use CSS selectors when you need DOM structure or a ref is not available. Use coordinates from screenshots only as a last resort for canvas/iframe surfaces.

7. **Clean up tabs.** When you open a tab with `newtab` for a subtask, `close` it when you're done and switch back to your previous tab. Before reporting a task as complete, run `tabs` to check for any tabs you forgot to close. Don't leave orphaned tabs behind.

8. **Track your tab IDs.** After `launch` or `newtab`, note the tab ID from the output. Before every action, confirm you're on the expected tab — other agents or link redirects (e.g. Slack unfurling a Jira link) can change what's loaded in your tab. If something looks wrong, run `tabs` to see your session's tabs and `tab <id>` to switch back. Never assume you're still on the same page after a click that could trigger cross-site navigation.

</HARD-RULES>

## Getting Started

```bash
# Launch Chrome and get a session ID
webact launch
# Output: Session: a1b2c3d4
#         Command file: /tmp/webact-command-a1b2c3d4.json  (path varies by OS)
```

If Chrome is not running, `launch` starts a new instance automatically and minimizes it (macOS). All subsequent commands auto-discover the session. Use `activate` to bring the browser window to the front when needed.

## Token Efficiency: Escalation Order

When you need more information, stop at the first sufficient tool:

1. `read` — page content, strips nav/ads
2. `axtree -i` or `observe` — actionable elements with refs
3. `text` — full visible text plus refs (cap with `--tokens=N`)
4. `dom` — HTML structure (scope with selector or cap with `--tokens=N`)
5. `screenshot --ref=N` or `--selector=...` — visual of one element at default 800px width
6. `screenshot` — full page visual fallback at default 800px width
7. `zoom out` — show more content in the same screenshot budget before escalating
8. `screenshot --high` — full resolution, only when low-res is insufficient

## Targeting Elements (priority order)

1. **refs**: from `axtree -i`, `observe`, or `text` — `click 3`, `type 5 hello`, `screenshot --ref=7`
2. **text search**: `click --text Submit` — finds smallest visible interactive element containing the text
3. **CSS selectors**: `#id`, `[data-testid="..."]`, `[aria-label="..."]`, `.class`, structural
4. **eval**: `eval` with querySelector when the element is present but hard to target
5. **coordinates**: `click 550,197` — last resort for canvas/iframes only, after all above have failed

## Common Patterns

All examples assume you've already run `webact launch`.

**Navigate and read** (navigate auto-prints brief - no separate dom needed):
```bash
webact navigate https://news.ycombinator.com
```

**Fill a form:**
```bash
# Multiple fields at once:
webact fill "input[name=q]" "search query"
# Or one at a time:
webact click input[name=q]
webact type input[name=q] search query
webact press Enter
```

**Rich text editors and @mentions:**
```bash
webact click .ql-editor
webact keyboard Hello @alice
webact waitfor [data-qa='tab_complete_ui_item'] 5000
webact click [data-qa='tab_complete_ui_item']
webact keyboard " check this out"
```

## Complex Web Apps

For site-specific tips (Google Docs, Slack, Jira, Gmail, rich editors), see `sites.md` in this skill's directory.

**Portals, shadow DOM, and overlays:**
- Modal dialogs, dropdowns, and popups often render in portal containers — CSS selectors from parent context won't find them
- `axtree -i` and `observe` include deep overlays, nested menus, and portal content — try refs first
- `click --text` finds elements inside portals and across shadow DOM boundaries
- `dom` traverses open shadow roots — web component internals are visible
- When all else fails, use `eval` to find and `.click()` directly
- Coordinate clicks from screenshots are a last resort for canvas/iframe-only surfaces

## Configuration

Settings file: `~/.config/webact/webact.json`

```json
{
  "telemetry": true,
  "feedback": true
}
```

Set `telemetry` to `false` to opt out of anonymous usage statistics (tool counts per session, no PII). Edit the file directly or use `webact config set <key> <true|false>`.
