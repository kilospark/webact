# webact (experimental)

`webact` is a side-by-side Rust port of `skills/webact/webact.src.js`.

It is intentionally incremental: both implementations live in this repo so behavior can be compared command-by-command.

## Current command support

Implemented in Rust (CLI parity with JS command surface):

- `launch`
- `connect`
- `run <sessionId>` (inline command or JSON command file)
- `navigate <url>`
- `back`
- `forward`
- `reload`
- `dom [selector] [--tokens=N]`
- `axtree`
- `axtree -i`
- `axtree -i --diff`
- `observe`
- `find`
- `screenshot`
- `pdf [path]`
- `click <selector>`
- `doubleclick <sel|x,y|--text>`
- `rightclick <sel|x,y|--text>`
- `hover <sel|x,y|--text>`
- `focus <selector>`
- `clear <selector>`
- `type <selector> <text>`
- `keyboard <text>`
- `paste <text>`
- `select <selector> <value>`
- `upload <selector> <file>`
- `drag <from> <to>`
- `dialog <accept|dismiss> [text]`
- `waitfor <selector> [ms]`
- `waitfornav [ms]`
- `press <key|combo>`
- `scroll <...>`
- `eval <js>`
- `cookies ...`
- `console ...`
- `network ...`
- `block ...`
- `viewport ...`
- `frames`
- `frame <id|selector>`
- `download ...`
- `tabs`
- `tab <id>`
- `newtab [url]`
- `close`
- `kill`
- `batch <json>`
- `grid [spec]`
- `setup`
- `media ...`
- `animations ...`
- `security ...`
- `storage ...`
- `sw ...`
- `search ...`
- `readurls ...`
- `feedback ...`
- `activate`
- `minimize`
- `humanclick`
- `humantype`
- `lock`
- `unlock`

## Session and file model

The Rust port uses separate temp files from JS so both can run side-by-side:

- Session pointer: `/tmp/webact-last-session`
- Session state: `/tmp/webact-state-<sessionId>.json`
- Command file: `/tmp/webact-command-<sessionId>.json`
- Chrome profile: `/tmp/webact-chrome-profile`

## Build

```bash
cd skills/webact
cargo check
cargo run -- --help
```

## Code layout

- `src/main.rs`: runtime state, CDP client, shared helpers, CLI bootstrap
- `src/commands.rs`: command dispatch and command handler implementations

## Next porting targets

See `PORTING.md` for status notes and known behavior differences.
