# Site-Specific Tips

Workarounds and patterns for apps with non-standard DOMs. Reference this when automating these sites.

## Google Docs
- Use `keyboard` (not `type`) — Google Docs has a custom editor, not standard inputs
- Use `paste` for inserting blocks of text — faster and more reliable than `keyboard` for multi-line content
- Heading shortcuts: `press Meta+Alt+1` through `press Meta+Alt+6` (NOT `Ctrl+Alt` — on macOS, app shortcuts documented as `Ctrl+Alt+<key>` must be sent as `Meta+Alt+<key>` through CDP)
- Scrolling: Use `scroll .kix-appview-editor down 500` — page-level scroll doesn't reach the document content

## Slack
- **Channel switching:** Use `press Meta+k`, then `keyboard "channel-name"`, then `press Enter`. Sidebar treeitem clicks don't reliably trigger Slack's React router — they register as clicked but don't navigate.
- **Message composition:** Click the message input (`[data-qa="message_input"] [role="textbox"]`), then use `keyboard` to type. For longer messages, use `paste`.
- **Sending messages:** Click the send button directly with `click [data-qa="texty_send_button"]`. Don't rely on `Enter` (may insert newline depending on Slack settings) or on `axtree` disabled state (can report false positives for Slack buttons).
- **Markdown formatting:** After `paste`, Slack may show a "Looks like your content contains markdown" banner. Click "Apply formatting" to convert, then send. The `*bold*` and `_italic_` syntax works.
- **Message extraction:** Use `eval` to query Slack's virtual DOM — standard CSS selectors are unreliable due to virtual scrolling
- Example: `eval [...document.querySelectorAll('[data-qa="virtual-list-item"]')].map(el => el.textContent).join('\n')`
- `axtree` is a non-starter for Slack content: `-i` only shows chrome-level controls (tabs, search, sidebar slider), and full mode returns empty names for channels (Slack renders names via CSS/virtual DOM, not accessible text). Use `eval` for channel discovery and message reading.
- The `navigate` auto-brief is useful for spotting unread badges (e.g. "DMs2", "Activity1")
- Slack link unfurling can hijack navigation — clicking DM list items may navigate your tab to Jira or other integrated services. Always track your tab ID.

## Jira
- Status transition dropdowns render in portals (`position: fixed`). `click --text` works for portal items. If coordinate clicks land on wrong elements, use `eval` to find and `.click()` the transition option directly.
- `dom --full` is very noisy on Jira (walls of CSS class names). Prefer `eval` with targeted queries for reading Jira content.
- Comment editors use ProseMirror — use `keyboard` to type and `press` for shortcuts.

## Gmail
- Ref-based clicking from `observe`/`axtree -i` doesn't work for Gmail checkboxes — refs point to wrapper divs that don't trigger the actual checkbox state change. Use CSS selectors instead.

## Rich Editors (Notion, Quill, ProseMirror, etc.)
- Prefer `paste` over `keyboard` for multi-line text — many editors handle paste events specially
- Use `keyboard` for short inline text and @mentions
- Use `eval` when you need to extract content from editors with virtual rendering
- If `paste` doesn't work for a specific app, fall back to `eval` with a custom ClipboardEvent
