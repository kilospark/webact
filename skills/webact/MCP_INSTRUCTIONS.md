# WebAct Browser Control

Control Chrome directly via the Chrome DevTools Protocol. Chrome auto-launches on first tool call.

## Key Concepts

**Auto-brief:** State-changing tools (navigate, click, hover, press, scroll, select, waitfor) auto-return a compact page summary showing URL, title, inputs, buttons, links, and total element counts. You usually don't need a separate `dom` call.

**`type` vs `keyboard` vs `paste`:** Use `type` to focus a specific input and fill it. Use `keyboard` to type at the current caret position — essential for rich text editors (Slack, Google Docs, Notion) where `type`'s focus call resets the cursor. Use `paste` to insert text via a ClipboardEvent — works with apps that intercept paste and is faster than `keyboard` for large text.

**`click` behavior:** Waits up to 5s for the element, scrolls it into view, then clicks. Fallbacks when CSS selectors fail: coordinates `550,197` from screenshot, or `--text Close` to find by visible text content.

**`dialog` behavior:** Sets a one-shot auto-handler. Call BEFORE the action that triggers the dialog.

**`axtree` vs `dom`:** The accessibility tree shows semantic roles and accessible names — better for understanding page structure. Use `dom` when you need HTML structure/selectors; use `axtree` when you need to understand what's on the page.

**`axtree -i` (interactive mode):** Shows only actionable elements as a flat numbered list. Most token-efficient view. After running with interactive=true, use ref numbers directly as selectors: click ref 1, type into ref 3. Refs are cached per URL.

**`observe`:** Like axtree interactive but formats each element as a ready-to-use action. Generates the ref map as a side effect.

**Ref-based targeting:** After axtree interactive or observe, numeric refs work in all selector-accepting tools: click, type, select, hover, focus, clear, doubleclick, rightclick, upload, drag, waitfor, dom.

**`press` combos:** Supports modifier keys: Ctrl+A (select all), Ctrl+C (copy), Meta+V (paste on Mac), Shift+Enter, etc.

**Mac keyboard note:** On macOS, app shortcuts documented as Ctrl+Alt+key must be sent as Meta+Alt+key through CDP. Example: Meta+Alt+2 for Heading 2 in Google Docs.

**`scroll` targets:** up/down (default 400px), top/bottom, or CSS selector. Element-scoped: scroll within a container instead of the page — essential for apps with custom scroll containers.

**`network` capture:** Captures XHR/fetch requests for a duration. `capture 10` for 10 seconds. `capture 15 api/query` filters by URL substring. `show` re-displays last capture.

**`block` patterns:** Block resource types (images, css, fonts, media, scripts) or URL substrings. Use `off` to disable.

**`viewport` presets:** mobile (375x667), iphone (390x844), ipad (820x1180), tablet (768x1024), desktop (1280x800). Or exact width and height.

## Tab Isolation

Each session creates and owns its own tabs. Sessions never interfere with each other.

- Launch creates a new blank tab for the session
- newtab opens additional tabs within the session
- tabs only lists session-owned tabs
- close removes the tab from the session

**Shared Chrome awareness:** Link clicks on sites like Slack can hijack your tab. Always record your tab ID after launch/newtab and verify you're on the right tab before acting.

## The Perceive-Act Loop

1. **PLAN** — Break the goal into steps.
2. **ACT** — Call the appropriate tool. State-changing tools auto-return a page brief.
3. **DECIDE** — Read the brief. Expected state? Continue. Login wall/CAPTCHA? Tell user. Need more detail? Use dom. Goal complete? Report.
4. **REPEAT** until done or blocked.

## Rules

1. **Read the brief after acting.** State-changing tools auto-return a page brief. Read it before deciding next steps. Use dom only when the brief isn't enough.

2. **DOM before screenshot.** Always try dom first. Only use screenshot if DOM output is empty/insufficient (canvas apps, image-heavy layouts).

3. **Report actual content.** When the goal is information retrieval, extract and present the actual text from the page. Do not summarize — show what IS there.

4. **Stop when blocked.** If you encounter a login wall, CAPTCHA, 2FA, or cookie consent, first call activate to bring the browser to front, then tell the user. Do not guess credentials. Once resolved, call minimize before your next action.

5. **Wait for dynamic content.** After clicks that trigger page loads, use waitfornav or waitfor before reading DOM.

6. **Use CSS selectors for targeting.** Identify elements from DOM output using CSS selectors (id, class, aria-label, data-testid, structural selectors).

7. **Clean up tabs.** Close tabs opened with newtab when done. Run tabs before reporting completion to check for orphans.

8. **Track tab IDs.** Note tab IDs from launch/newtab output. Verify you're on the expected tab before acting.

## Token Efficiency

dom returns the full compact DOM — scripts, styles, SVGs, and hidden elements stripped. For large SPAs:
- dom with selector — scope to a specific part
- dom with max_tokens — cap output size
- axtree interactive — most compact view

## Finding Elements (priority order)

1. **id**: #search-input
2. **data-testid**: [data-testid="submit-btn"]
3. **aria-label**: [aria-label="Search"]
4. **class**: .nav-link
5. **structural**: form input[type="email"]
6. **text search**: click with --text target — finds smallest visible element containing the text
7. **coordinates**: click at x,y from screenshot — last resort for canvas/iframes

## Common Patterns

**Navigate and read** (auto-brief returned, no separate dom needed):
- Call navigate with URL

**Fill a form:**
- click on input → type into it → press Enter

**Rich text editors and @mentions:**
- click the editor element
- keyboard to type (not type, which resets cursor)
- waitfor autocomplete dropdown
- click the suggestion
- keyboard to continue typing

## Complex Web Apps

**Portals, shadow DOM, and overlays:**
- Modal dialogs and popups render in portal containers — CSS selectors from parent context won't find them
- click --text finds elements inside portals and across shadow DOM boundaries
- dom traverses open shadow roots — web component internals are visible
- axtree includes deep overlays and nested menus
- For elements with no text, use screenshot + coordinate click
- When all else fails, use eval to find and .click() directly
