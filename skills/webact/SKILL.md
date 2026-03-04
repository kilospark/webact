---
name: webact
description: Use when the user asks to interact with a website, browse the web, check a site, send a message, read content from a web page, or accomplish any goal that requires controlling a browser
---

# WebAct Browser Control

Control Chrome directly via the Chrome DevTools Protocol. No Playwright, no MCP - raw CDP through a CLI helper.

## How to Run Commands

All commands use the `webact` CLI. First, check if `webact` is on PATH by running `which webact`. If found, use `webact` directly. If not, fall back to `node <base-dir>/webact.js` where `<base-dir>` is this skill's base directory.

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

**Auto-brief:** State-changing commands (navigate, click, hover, press Enter/Tab, scroll, select, waitfor) auto-print a compact page summary showing URL, title, inputs, buttons, links, and total element counts. You usually don't need a separate `dom` call. Use `dom` only when you need the full page structure, `axtree -i` for a quick list of all interactive elements, or `axtree` for the full semantic tree.

### Command Reference

| Command | Example |
|---------|---------|
| `navigate <url>` | `webact navigate https://example.com` |
| `back` | `webact back` |
| `forward` | `webact forward` |
| `reload` | `webact reload` |
| `dom [selector] [--full]` | `webact dom` or `webact dom .results` |
| `axtree [selector] [-i]` | `webact axtree` or `webact axtree -i` |
| `observe` | `webact observe` |
| `screenshot` | `webact screenshot` |
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
| `block <pattern>` | `webact block images css` or `webact block off` |
| `viewport <w> <h>` | `webact viewport mobile` or `webact viewport 1024 768` |
| `frames` | `webact frames` |
| `frame <id\|selector>` | `webact frame main` or `webact frame iframe#embed` |
| `download [path\|list]` | `webact download path /tmp/dl` or `webact download list` |
| `tabs` | `webact tabs` |
| `tab <id>` | `webact tab ABC123` |
| `newtab [url]` | `webact newtab https://example.com` |
| `close` | `webact close` |
| `activate` | `webact activate` |
| `minimize` | `webact minimize` |

**`type` vs `keyboard` vs `paste`:** Use `type` to focus a specific input and fill it. Use `keyboard` to type at the current caret position - essential for rich text editors (Slack, Google Docs, Notion) where `type`'s focus call resets the cursor. Use `paste` to insert text via a ClipboardEvent - works with apps that intercept paste (Google Docs, Notion) and is faster than `keyboard` for large text.

**`click` behavior:** Waits up to 5s for the element, scrolls it into view, then clicks. No manual waits needed for dynamic elements. Fallbacks when CSS selectors fail: `click 550,197` clicks at exact coordinates (from screenshot), `click --text Close` finds and clicks a visible element by text content.

**`dialog` behavior:** Sets a one-shot auto-handler. Run BEFORE the action that triggers the dialog.

**`axtree` vs `dom`:** The accessibility tree shows semantic roles (button, link, heading, textbox) and accessible names - better for understanding page structure. Use `dom` when you need HTML structure/selectors; use `axtree` when you need to understand what's on the page.

**`axtree -i` (interactive mode):** Shows only actionable elements (buttons, links, inputs, etc.) as a flat numbered list. Most token-efficient way to see what you can interact with on a page - typically ~500 tokens vs ~4000 for full `dom`. After running `axtree -i`, use the ref numbers directly as selectors: `click 1`, `type 3 hello`. Refs are cached per URL and reused on revisits.

**`observe`:** Like `axtree -i` but formats each element as a ready-to-use command (e.g. `click 1`, `type 3 <text>`, `select 5 <value>`). Generates the ref map as a side effect.

**Ref-based targeting:** After `axtree -i` or `observe`, numeric refs work in all selector-accepting commands: `click`, `type`, `select`, `hover`, `focus`, `clear`, `doubleclick`, `rightclick`, `upload`, `drag`, `waitfor`, `dom`.

**`press` combos:** Supports modifier keys: `Ctrl+A` (select all), `Ctrl+C` (copy), `Meta+V` (paste on Mac), `Shift+Enter`, etc. Modifiers: Ctrl, Alt, Shift, Meta/Cmd.

**Mac keyboard note:** On macOS, app shortcuts documented as `Ctrl+Alt+<key>` (e.g., Google Docs heading shortcuts `Ctrl+Alt+1` through `Ctrl+Alt+6`) must be sent as `Meta+Alt+<key>` through CDP. Mac's Ctrl key is not the Command key these apps expect. Example: `press Meta+Alt+2` for Heading 2 in Google Docs.

**`scroll` targets:** `up`/`down` (default 400px, or specify pixels), `top`/`bottom`, or a CSS selector to scroll an element into view. **Element-scoped:** `scroll <selector> <up|down|top|bottom> [px]` scrolls within a container element instead of the page — essential for apps with custom scroll containers (Google Docs, Slack).

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

## The Perceive-Act Loop

When given a goal, follow this loop:

1. **PLAN** - Break the goal into steps. Chain predictable sequences (click → type → press Enter) into a single command array.

2. **ACT** - Write command JSON (or array), run `webact run <sessionId>`. Actions auto-print a page brief.

3. **DECIDE** - Read the brief. Expected state? Continue. Login wall / CAPTCHA? Tell user. Need more detail? Use `dom`. Goal complete? Report.

4. **REPEAT** until done or blocked.

## Rules

<HARD-RULES>

1. **Read the brief after acting.** State-changing commands auto-print a page brief. Read it before deciding your next step. Use `dom` only when the brief isn't enough (e.g., you need to find a specific element's selector in a complex page).

2. **DOM before screenshot.** Always try `dom` first. Only use `screenshot` if DOM output is empty/insufficient (canvas apps, image-heavy layouts).

3. **Report actual content.** When the goal is information retrieval, extract and present the actual text from the page. Do not summarize what you think is there - show what IS there.

4. **Stop when blocked.** If you encounter a login wall, CAPTCHA, 2FA prompt, or cookie consent that blocks progress, first run `activate` to bring the browser window to the front so the user can see it, then tell the user. Do not guess credentials or attempt to bypass security. Once the blocker is resolved and you resume automation, run `minimize` before your next action so the browser doesn't steal focus from the user. Minimizing does not affect page focus — the active element and caret position are preserved.

5. **Wait for dynamic content.** After clicks that trigger page loads, use `waitfornav` or `waitfor <selector>` before reading DOM.

6. **Use CSS selectors for targeting.** When you need to click or type into a specific element, identify it from the DOM output using CSS selectors (id, class, aria-label, data-testid, or structural selectors).

7. **Clean up tabs.** When you open a tab with `newtab` for a subtask, `close` it when you're done and switch back to your previous tab. Before reporting a task as complete, run `tabs` to check for any tabs you forgot to close. Don't leave orphaned tabs behind.

</HARD-RULES>

## Getting Started

```bash
# Launch Chrome and get a session ID
webact launch
# Output: Session: a1b2c3d4
#         Command file: /tmp/webact-command-a1b2c3d4.json  (path varies by OS)
```

If Chrome is not running, `launch` starts a new instance automatically and minimizes it (macOS). All subsequent commands auto-discover the session. Use `activate` to bring the browser window to the front when needed.

## Token Efficiency

The `dom` command returns a compact representation:
- Scripts, styles, SVGs, hidden elements are stripped
- Only interactive and structural tags are shown with their attributes
- Whitespace is collapsed
- Output is truncated to ~4000 chars by default

Use `dom <selector>` to scope to a specific part of the page when you know where to look. This saves significant tokens on large pages.

Use `--full` only when you need the complete DOM (rare).

## Finding Elements

Read the DOM output and identify elements by:
1. **id**: `#search-input` - most reliable
2. **data-testid**: `[data-testid="submit-btn"]`
3. **aria-label**: `[aria-label="Search"]`
4. **class**: `.nav-link`
5. **structural**: `form input[type="email"]`
6. **text-based** (via eval): use eval with `document.querySelector('button').textContent`
7. **text search**: `click --text "Close"` — finds smallest visible element containing the text. Works for portals, overlays, and shadow DOM elements where CSS selectors fail.
8. **coordinates** (from screenshot): `click 550,197` — take a screenshot, identify the target's position, click at those pixel coordinates. Last resort for canvas, iframes, or elements with no text.

If a CSS selector doesn't work, use `--text` or coordinates before falling back to `eval`:
```bash
webact eval "[...document.querySelectorAll('a')].find(a => a.textContent.includes('Sign in'))?.getAttribute('href')"
```

## Common Patterns

All examples assume you've already run `webact launch`.

**Navigate and read** (navigate auto-prints brief - no separate dom needed):
```bash
webact navigate https://news.ycombinator.com
```

**Fill a form:**
```bash
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

Some apps have non-standard DOMs that require specific approaches.

**Google Docs:**
- Use `keyboard` (not `type`) — Google Docs has a custom editor, not standard inputs
- Use `paste` for inserting blocks of text — faster and more reliable than `keyboard` for multi-line content
- Heading shortcuts: `press Meta+Alt+1` through `press Meta+Alt+6` (NOT `Ctrl+Alt` — see Mac keyboard note above)
- Scrolling: Use `scroll .kix-appview-editor down 500` — page-level scroll doesn't reach the document content

**Slack:**
- Message composition: Click the message input, then use `keyboard` to type
- Message extraction: Use `eval` to query Slack's virtual DOM — standard CSS selectors are unreliable due to virtual scrolling
- Example: `eval [...document.querySelectorAll('[data-qa="virtual-list-item"]')].map(el => el.textContent).join('\n')`
- `axtree` is a non-starter for Slack content: `-i` only shows chrome-level controls (tabs, search, sidebar slider), and full mode returns empty names for channels (Slack renders names via CSS/virtual DOM, not accessible text). Use `eval` for channel discovery and message reading.
- The `navigate` auto-brief is useful for spotting unread badges (e.g. "DMs2", "Activity1")

**Gmail:**
- Ref-based clicking from `observe`/`axtree -i` doesn't work for Gmail checkboxes — refs point to wrapper divs that don't trigger the actual checkbox state change. Use CSS selectors instead.

**General rich editors (Notion, Quill, ProseMirror, etc.):**
- Prefer `paste` over `keyboard` for multi-line text — many editors handle paste events specially
- Use `keyboard` for short inline text and @mentions
- Use `eval` when you need to extract content from editors with virtual rendering
- If `paste` doesn't work for a specific app, fall back to `eval` with a custom ClipboardEvent

**Portals, shadow DOM, and overlays:**
- Modal dialogs, dropdowns, and popups often render in portal containers outside the main DOM tree — CSS selectors based on the triggering element's context won't find them
- `dom` traverses open shadow roots — elements inside web components (Lit, Shoelace, Atlaskit, etc.) are visible in the output
- `axtree` returns the full accessibility tree without depth limits — deep overlays, nested menus, and complex widget trees are included
- `click --text "Close"` works across shadow DOM boundaries — use it when CSS selectors can't reach shadow DOM elements
- For elements with no distinguishing text, take a `screenshot`, identify the pixel coordinates, then `click 550,197`
