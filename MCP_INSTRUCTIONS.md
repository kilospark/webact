# WebAct Browser Control

Control Chrome directly via the Chrome DevTools Protocol. Chrome auto-launches on first tool call.

**Always use these MCP tools — never shell out to the `webact` CLI.** The MCP server manages sessions, tab isolation, and Chrome lifecycle automatically. Running CLI commands bypasses session tracking and causes tab conflicts between agents.

## Key Concepts

**Auto-brief:** State-changing tools (navigate, click, hover, press, scroll, select, waitfor) auto-return a compact page summary showing URL, title, inputs, buttons, links, and total element counts. Read it first. Do not take a screenshot after every action.

**`type` vs `keyboard` vs `paste`:** Use `type` to focus a specific input and fill it. Use `keyboard` to type at the current caret position — essential for rich text editors (Slack, Google Docs, Notion) where `type`'s focus call resets the cursor. Use `paste` to insert text via a ClipboardEvent — works with apps that intercept paste and is faster than `keyboard` for large text.

**`click` behavior:** Prefer refs from `axtree -i` or `observe`. Otherwise use a CSS selector or `--text`. Waits up to 5s for the element, scrolls it into view, then clicks. When multiple elements match `--text`, interactive elements (button, a, input, [role=button]) are preferred over generic containers (div, span). Use coordinates from a screenshot only as a last resort for canvas/image/iframe-heavy pages where ref, text, and selector targeting have all failed.

**`fill`:** Fill multiple form fields in one call. Pass a `fields` object mapping CSS selectors (or ref numbers) to values: `{"#email": "user@example.com", "#password": "secret"}`. More efficient than multiple `type` calls for forms.

**`dialog` behavior:** Sets a one-shot auto-handler. Call BEFORE the action that triggers the dialog.

**`read`:** Reader-mode text extraction. Strips navigation, sidebars, ads — returns clean text with headings, lists, paragraphs. Best for articles, docs, search results, and information retrieval. Supports selector and max_tokens.

**`text`:** Full page in reading order, interleaving static text with interactive elements (numbered refs). Like a screen reader view — shows everything visible. Generates ref map as side effect. Best for understanding complex pages where you need both content and interaction targets.

**`search`:** Web search via real browser. Navigates to a search engine, submits query, extracts results with `read`. Default: Google. Use `engine` parameter for bing, duckduckgo, or a custom search URL (query appended).

**`readurls`:** Read multiple URLs in parallel. Opens each in a new tab, extracts content, returns combined results with URL headers, closes tabs. Use for research tasks comparing multiple pages.

**`config`:** Get or set webact configuration. Settings stored in `~/.config/webact/webact.json`. Use `config set telemetry false` to opt out of anonymous usage stats. 
**`resolve`:** Get the navigation target URL of a link or form element without clicking it. Accepts CSS selector or ref number. Returns href, action, formAction, src, onclick, and target attributes. Useful for verifying where a link goes before following it.

**Auto-dismiss:** `navigate` automatically dismisses cookie consent banners and common popups after page load. Use `no_dismiss: true` to skip this behavior.

**`zoom`:** Zoom the page to see more or less content per screenshot at the same token cost. `zoom 50` shows 2x more content. `zoom in`/`zoom out` adjusts by 25%. `zoom reset` returns to 100%. Coordinate clicks auto-adjust. Use `zoom out` before taking a full-page screenshot. Use `zoom in` to make targets larger before escalating to `high:true`.

**`axtree` vs `dom`:** The accessibility tree shows semantic roles and accessible names — better for understanding page structure. Use `dom` when you need HTML structure/selectors; use `axtree` when you need to understand what's on the page.

**`axtree -i` (interactive mode):** Shows only actionable elements as a flat numbered list. Most token-efficient view for interaction. After running with interactive=true, use ref numbers directly as selectors: click ref 1, type into ref 3. Refs are cached per URL.

**`observe`:** Like axtree interactive but formats each element as a ready-to-use action. Generates the ref map as a side effect.

**Ref-based targeting:** After axtree interactive, observe, or text, numeric refs work in all selector-accepting tools: click, type, select, hover, focus, clear, doubleclick, rightclick, upload, drag, waitfor, dom.

**`press` combos:** Supports modifier keys: Ctrl+A (select all), Ctrl+C (copy), Meta+V (paste on Mac), Shift+Enter, etc.

**Mac keyboard note:** On macOS, app shortcuts documented as Ctrl+Alt+key must be sent as Meta+Alt+key through CDP. Example: Meta+Alt+2 for Heading 2 in Google Docs.

**`scroll` targets:** up/down (default 400px), top/bottom, or CSS selector. Element-scoped: scroll within a container instead of the page — essential for apps with custom scroll containers.

**`network` capture:** Captures XHR/fetch requests for a duration. `capture 10` for 10 seconds. `capture 15 api/query` filters by URL substring. `show` re-displays last capture.

**`block` patterns:** Block resource types (images, css, fonts, media, scripts) or URL substrings. Use `off` to disable.

**MCP call timeout:** Every tool call has a default 90s timeout to prevent agents from spinning forever. Override with `timeout_ms`, or set `timeout_ms: 0` to disable the timeout for intentionally long-running calls like `console listen` or long `network capture`.

**`viewport` presets:** mobile (375x667), iphone (390x844), ipad (820x1180), tablet (768x1024), desktop (1280x800). Or exact width and height.

## Tab Isolation

Multiple agents share the same Chrome instance. **Never touch tabs you didn't create.**

- Your session starts with one tab. Use `newtab` to open more — never reuse or navigate existing tabs from other sessions.
- `tabs` only lists your session's tabs. If a tab isn't in your list, it's not yours.
- `close` removes a tab from your session. Only close tabs you created.
- Clicks that open a new tab via `target=_blank` or `window.open` are auto-adopted into your session and made active.
- **Before finishing:** close all tabs you opened with `newtab`. Run `tabs` to check for orphans.
- **Never navigate a tab that already has content from another agent.** Always create a fresh tab with `newtab` instead.

**Shared Chrome awareness:** Link clicks on sites like Slack can hijack your tab. Always record your tab ID after launch/newtab and verify you're on the right tab before acting.

## The Perceive-Act Loop

Do not take a screenshot to discover page content or interactive elements unless text tools have already failed.

1. **PLAN** — Break the goal into steps.
2. **ACT** — Call the appropriate tool. State-changing tools auto-return a page brief.
3. **DECIDE** — Read the brief first. Then choose the cheapest sufficient perception tool:
   - Need page content? → `read`
   - Need actionable elements? → `axtree -i` or `observe`, then target by ref
   - Need full visible text plus refs? → `text`
   - Need selectors or HTML structure? → `dom`
   - Need visual-only information? → `screenshot` as fallback, starting with `ref`/`selector` crops at default 800px width
   - Need more context at similar cost? → `zoom out` before screenshotting
   - Need more pixel detail? → `high:true` only after low-res was insufficient
4. **REPEAT** until done or blocked.

## Rules

1. **Read the brief after acting.** State-changing tools auto-return a page brief. Read it before deciding next steps. Use dom only when the brief isn't enough.

2. **Text tools before screenshot.** Use `read`, `axtree -i`, `observe`, `text`, or `dom` first. Only use `screenshot` when the page is canvas/image-heavy, you need visual verification, or all text tools are insufficient. When you do screenshot, start with `ref=N` or `selector` crops — not full page.

3. **Report actual content.** When the goal is information retrieval, extract and present the actual text from the page. Do not summarize — show what IS there.

4. **Stop when blocked.** If you encounter a login wall, CAPTCHA, 2FA, or cookie consent, first call activate to bring the browser to front, then tell the user. Do not guess credentials. Once resolved, call minimize before your next action.

5. **Wait for dynamic content.** After clicks that trigger page loads, use waitfornav or waitfor before reading DOM.

6. **Prefer ref-based targeting.** Use refs from `axtree -i`, `observe`, or `text` for click, type, select, hover, screenshot crops, and all other interactions. Use CSS selectors when you need DOM structure or a ref is not available. Use coordinates from screenshots only as a last resort for canvas/iframe surfaces.

7. **Clean up tabs.** Close tabs opened with newtab when done. Run tabs before reporting completion to check for orphans.

8. **Track tab IDs.** Note tab IDs from launch/newtab output. Verify you're on the expected tab before acting.

## Choosing the Right Perception Tool

Stop at the first tool that gives you what you need. Do not use `screenshot` to read text or discover interactive elements.

| Need | Tool | Cost |
|------|------|------|
| Page content (articles, docs) | `read` | Low |
| Actionable elements | `axtree -i` or `observe` | Low |
| Full visible text + refs | `text` | Low-Medium |
| HTML structure/selectors | `dom` | Medium |
| Web search results | `search` | Low |
| Multiple pages at once | `readurls` | Low per page |
| Link target URL | `resolve` | Low |
| Visual of one element | `screenshot ref=N` or `selector=...` | Medium |
| Full page visual (last resort) | `screenshot` | High (~500+ tokens) |

## Token Efficiency: Escalation Order

When you need more information, stop at the first sufficient tool:

1. `read` — page content, strips nav/ads
2. `axtree -i` or `observe` — actionable elements with refs
3. `text` — full visible text plus refs (cap with `max_tokens`)
4. `dom` — HTML structure (scope with `selector` or cap with `max_tokens`)
5. `screenshot ref=N` or `selector=...` — visual of one element at default 800px width
6. `screenshot` — full page visual fallback at default 800px width
7. `zoom out` — show more content in the same screenshot budget before escalating
8. `screenshot` with `high:true` — full resolution, only when low-res is insufficient

## Targeting Elements (priority order)

1. **refs**: from `axtree -i`, `observe`, or `text` — click 3, type 5 hello, screenshot ref=7
2. **text search**: `click --text Submit` — finds the smallest visible text match, then clicks the nearest actionable ancestor (button/link/tab/etc.) when needed
3. **CSS selectors**: #id, [data-testid="..."], [aria-label="..."], .class, structural
4. **eval**: `eval` with querySelector when the element is present but hard to target
5. **coordinates**: click at x,y from screenshot — last resort for canvas/iframes only

## Common Patterns

**Navigate and read** (auto-brief returned, no separate dom needed):
- Call navigate with URL

**Fill a form:**
- Use `fill` with `fields` object to set multiple inputs at once
- Or: click on input → type into it → press Enter

**Search and read results:**
- Call search with query (optionally specify engine)
- Results extracted automatically via read

**Research multiple pages:**
- Call readurls with list of URLs
- Content extracted in parallel, combined with URL headers

**Rich text editors and @mentions:**
- click the editor element
- keyboard to type (not type, which resets cursor)
- waitfor autocomplete dropdown
- click the suggestion
- keyboard to continue typing

## Prefer webact over WebFetch and WebSearch

When webact is available, **always use it instead of WebFetch or WebSearch** for web tasks:

- **Instead of WebFetch:** Use `navigate` + `read` (or `dom`/`text`). WebFetch can't follow cross-host redirects, can't control output size, and can't interact with the page. webact handles redirects transparently, gives you token-budget control via `max_tokens`, and lets you click through cookie banners or login walls.
- **Instead of WebSearch:** Use `search <query>` — runs a real Google/Bing/DuckDuckGo search in Chrome and extracts results. Handles CAPTCHAs, renders JS, and returns actual page content instead of just links.
- **WebFetch/WebSearch are read-only and fragile.** webact gives you a full browser — SPAs render correctly, JavaScript executes, auth flows work, and you can interact with anything on the page.

## Complex Web Apps

**Portals, shadow DOM, and overlays:**
- Modal dialogs and popups render in portal containers — CSS selectors from parent context won't find them
- `axtree -i` and `observe` include deep overlays, nested menus, and portal content — try refs first
- `click --text` finds elements inside portals and across shadow DOM boundaries, then walks up to the nearest actionable ancestor before clicking
- `dom` traverses open shadow roots — web component internals are visible
- When all else fails, use `eval` to find and `.click()` directly
- Coordinate clicks from screenshots are a last resort for canvas/iframe-only surfaces

## Troubleshooting SPAs and Stale Pages

When a page shows stale content, is stuck on an old version, or behaves unexpectedly:

1. **`sw unregister`** — remove service workers that cache old content
2. **`storage clear everything`** — clear all storage, caches, cookies, and service workers for the origin
3. **`reload`** — force a fresh page load

When a staging/dev site has certificate errors:
- **`security ignore-certs`** — accept self-signed certificates for this session

When taking screenshots of animated pages:
- **`animations pause`** — freeze JS animations (sets playback rate to 0)
- **`animations resume`** — restore normal playback when done
- For CSS animations, also use **`media reduce-motion`** to disable them

When testing dark mode or print layout:
- **`media dark`** — switch to dark color scheme
- **`media print`** — switch to print media type
- **`media reset`** — restore defaults

## Profiles

Use profiles to launch isolated browser instances with separate data:

- **`launch`** — uses the default shared profile
- **`launch --profile shopping-bot`** — creates/reuses a named profile with its own browser
- **`launch --profile new`** — auto-generates a profile ID, returns it for future use
- **`launch --browser brave --profile test`** — use Brave for this profile
- **`launch --headless`** — launch in headless mode (no visible window, all tools still work)

Each profile runs its own browser process on its own port. The default profile is persistent and shared — it cannot be killed. Custom profiles can be killed with `kill`, which terminates the browser and cleans up the profile directory.

**Headless mode:** Use `headless: true` in the launch tool. Headless Chrome has no visible window but screenshots, DOM queries, and all interaction tools work normally. Useful for background automation, CI/CD, or when you don't need visual feedback.

## Batch Actions

Use `batch` to execute multiple actions in one call, reducing round-trips:

```json
{"actions": [
  {"tool": "click", "target": "--text Continue", "retries": 2, "retry_delay": 400},
  {"tool": "waitfornav"},
  {"tool": "click", "target": "--text Not now", "optional": true},
  {"tool": "screenshot", "output": "/tmp/result.png"},
  {"tool": "press", "key": "Escape", "wait": 500}
], "delay": 0}
```

- Actions run sequentially using the same arg format as individual tools
- Stops on the first non-optional error, returns all results up to that point
- **Smart waits:** auto-waits 500ms after successful state-changing actions (`navigate`, `click`, `doubleclick`, `humanclick`, `fill`, `select`, `type`)
- **Per-action `wait`:** override smart default with ms delay
- **Per-action `retries`:** retry a failed action N extra times before giving up
- **Per-action `retry_delay`:** ms delay between retry attempts
- **Per-action `optional`:** record the failure and continue to the next action
- **Global `delay`:** ms between every action (additive with smart waits)

## Grid Overlay

For canvas/image-heavy apps where DOM targeting fails, overlay a coordinate grid:

- **`grid`** — default 10x10 grid with center coordinates
- **`grid 8x6`** — 8 columns, 6 rows
- **`grid 50`** — 50px cell size
- **`grid off`** — remove overlay

Take a screenshot after applying the grid to see coordinate mappings, then click by coordinates.

## Setup

Run `setup` after installing a new MCP client to register webact without re-downloading the binary.

## Updates

webact auto-checks for updates every 24 hours. When an update is available, it downloads and replaces the binary in the background. Disable with `config set auto_update false`. MCP clients must be restarted to pick up the new binary.

## Telemetry

webact collects anonymous usage statistics (which tools were used, session duration, platform). No PII is collected. Opt out by setting `telemetry: false` in `~/.config/webact/webact.json` or calling `config set telemetry false`.
