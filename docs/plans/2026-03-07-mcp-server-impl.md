# MCP Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add stdio MCP servers (Node.js + Rust) so webact works with Claude Desktop, ChatGPT Desktop, and other MCP clients.

**Architecture:** Both servers read JSON-RPC from stdin, dispatch to embedded webact commands with stdout captured to a buffer, and write JSON-RPC responses to stdout. Each webact command is exposed as an individual MCP tool with full JSON schema. Screenshot returns image content; all others return text.

**Tech Stack:** Node.js (readline, JSON), Rust (tokio, serde_json). No MCP SDK — minimal JSON-RPC over stdio.

---

## Task 1: Shared tool definitions data file

Both Node.js and Rust servers need the same tool definitions (name, description, JSON schema). Define them once in a shared JSON file so they stay in sync.

**Files:**
- Create: `skills/webact/tools.json`

**Step 1: Create tool definitions**

Create `skills/webact/tools.json` containing an array of tool objects. Each has `name`, `description`, and `inputSchema` (JSON Schema). This file is the single source of truth for both servers.

```json
[
  {
    "name": "webact_launch",
    "description": "Launch Chrome and create a browser session. Run this first before any other command.",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "required": []
    }
  },
  {
    "name": "webact_navigate",
    "description": "Navigate to a URL. Auto-prints a compact page summary showing URL, title, inputs, buttons, and links.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "url": { "type": "string", "description": "URL to navigate to (https:// prefix added if missing)" }
      },
      "required": ["url"]
    }
  },
  {
    "name": "webact_dom",
    "description": "Get compact DOM of the page. Scripts, styles, SVGs, and hidden elements are stripped. Use selector to scope, max_tokens to limit output size.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "selector": { "type": "string", "description": "CSS selector to scope DOM extraction" },
        "max_tokens": { "type": "integer", "description": "Approximate token limit for output" }
      },
      "required": []
    }
  },
  {
    "name": "webact_axtree",
    "description": "Get accessibility tree. Use interactive=true for a flat numbered list of actionable elements (most compact). After running with interactive=true, use ref numbers as selectors in click/type/etc. Use diff=true to show changes since last snapshot.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "interactive": { "type": "boolean", "description": "Show only interactive elements with ref numbers" },
        "diff": { "type": "boolean", "description": "Show only changes since last snapshot" },
        "selector": { "type": "string", "description": "CSS selector to scope the tree" },
        "max_tokens": { "type": "integer", "description": "Approximate token limit for output" }
      },
      "required": []
    }
  },
  {
    "name": "webact_observe",
    "description": "Show interactive elements as ready-to-use commands (e.g., 'click 1', 'type 3 <text>'). Generates ref map as side effect.",
    "inputSchema": { "type": "object", "properties": {}, "required": [] }
  },
  {
    "name": "webact_find",
    "description": "Find an element by natural language description (e.g., 'login button', 'search input').",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": { "type": "string", "description": "Description of the element to find" }
      },
      "required": ["query"]
    }
  },
  {
    "name": "webact_screenshot",
    "description": "Capture a screenshot of the current page. Returns the image directly.",
    "inputSchema": { "type": "object", "properties": {}, "required": [] }
  },
  {
    "name": "webact_pdf",
    "description": "Save the current page as a PDF file.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "Output file path (default: temp directory)" }
      },
      "required": []
    }
  },
  {
    "name": "webact_click",
    "description": "Click an element. Waits up to 5s for it to appear, scrolls into view, then clicks. Accepts a CSS selector, coordinates (e.g., '550,197'), ref number from axtree -i, or use --text prefix to find by visible text.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "target": { "type": "string", "description": "CSS selector, 'x,y' coordinates, ref number, or '--text Some Text'" }
      },
      "required": ["target"]
    }
  },
  {
    "name": "webact_doubleclick",
    "description": "Double-click an element. Same targeting as click.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "target": { "type": "string", "description": "CSS selector, 'x,y' coordinates, ref number, or '--text Some Text'" }
      },
      "required": ["target"]
    }
  },
  {
    "name": "webact_rightclick",
    "description": "Right-click an element. Same targeting as click.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "target": { "type": "string", "description": "CSS selector, 'x,y' coordinates, ref number, or '--text Some Text'" }
      },
      "required": ["target"]
    }
  },
  {
    "name": "webact_hover",
    "description": "Hover over an element. Same targeting as click.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "target": { "type": "string", "description": "CSS selector, 'x,y' coordinates, ref number, or '--text Some Text'" }
      },
      "required": ["target"]
    }
  },
  {
    "name": "webact_focus",
    "description": "Focus an element without clicking it.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "selector": { "type": "string", "description": "CSS selector or ref number" }
      },
      "required": ["selector"]
    }
  },
  {
    "name": "webact_clear",
    "description": "Clear an input field or contenteditable element.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "selector": { "type": "string", "description": "CSS selector or ref number" }
      },
      "required": ["selector"]
    }
  },
  {
    "name": "webact_type",
    "description": "Focus a specific input element and type text into it. Use 'keyboard' instead for typing at the current caret position (rich editors like Slack, Google Docs).",
    "inputSchema": {
      "type": "object",
      "properties": {
        "selector": { "type": "string", "description": "CSS selector or ref number of the input element" },
        "text": { "type": "string", "description": "Text to type" }
      },
      "required": ["selector", "text"]
    }
  },
  {
    "name": "webact_keyboard",
    "description": "Type text at the current caret position without changing focus. Essential for rich text editors (Slack, Google Docs, Notion) where 'type' would reset the cursor.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "text": { "type": "string", "description": "Text to type at current caret" }
      },
      "required": ["text"]
    }
  },
  {
    "name": "webact_paste",
    "description": "Paste text via ClipboardEvent. Works with apps that intercept paste (Google Docs, Notion). Faster than keyboard for large text.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "text": { "type": "string", "description": "Text to paste" }
      },
      "required": ["text"]
    }
  },
  {
    "name": "webact_press",
    "description": "Press a key or key combo. Examples: Enter, Tab, Escape, Ctrl+A, Meta+C, Shift+Enter. On macOS, use Meta (not Ctrl) for app shortcuts.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "key": { "type": "string", "description": "Key name or combo (e.g., 'Enter', 'Ctrl+A', 'Meta+V')" }
      },
      "required": ["key"]
    }
  },
  {
    "name": "webact_select",
    "description": "Select option(s) from a <select> dropdown by value or label text.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "selector": { "type": "string", "description": "CSS selector or ref number of the <select> element" },
        "values": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Value(s) or label(s) to select"
        }
      },
      "required": ["selector", "values"]
    }
  },
  {
    "name": "webact_upload",
    "description": "Upload file(s) to a file input element.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "selector": { "type": "string", "description": "CSS selector or ref number of the file input" },
        "files": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Absolute file path(s) to upload"
        }
      },
      "required": ["selector", "files"]
    }
  },
  {
    "name": "webact_drag",
    "description": "Drag from one element to another.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "from": { "type": "string", "description": "CSS selector or ref number of the source element" },
        "to": { "type": "string", "description": "CSS selector or ref number of the target element" }
      },
      "required": ["from", "to"]
    }
  },
  {
    "name": "webact_scroll",
    "description": "Scroll the page or an element. Directions: up, down, top, bottom. Can scope to a container element for apps with custom scroll areas.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "target": { "type": "string", "description": "Direction (up/down/top/bottom), CSS selector to scroll into view, or selector followed by direction" },
        "pixels": { "type": "integer", "description": "Pixels to scroll (default 400)" }
      },
      "required": ["target"]
    }
  },
  {
    "name": "webact_eval",
    "description": "Evaluate a JavaScript expression in the page context and return the result.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "expression": { "type": "string", "description": "JavaScript expression to evaluate" }
      },
      "required": ["expression"]
    }
  },
  {
    "name": "webact_dialog",
    "description": "Set a one-shot handler for the next JavaScript dialog (alert/confirm/prompt). Run BEFORE the action that triggers the dialog.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "action": { "type": "string", "enum": ["accept", "dismiss"], "description": "Accept or dismiss the dialog" },
        "text": { "type": "string", "description": "Text to enter for prompt dialogs" }
      },
      "required": ["action"]
    }
  },
  {
    "name": "webact_waitfor",
    "description": "Wait for an element to appear on the page.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "selector": { "type": "string", "description": "CSS selector to wait for" },
        "timeout": { "type": "integer", "description": "Timeout in milliseconds (default 5000)" }
      },
      "required": ["selector"]
    }
  },
  {
    "name": "webact_waitfornav",
    "description": "Wait for page navigation to complete (readyState=complete).",
    "inputSchema": {
      "type": "object",
      "properties": {
        "timeout": { "type": "integer", "description": "Timeout in milliseconds (default 10000)" }
      },
      "required": []
    }
  },
  {
    "name": "webact_cookies",
    "description": "Manage browser cookies. Actions: get (list all), set (name value [domain]), clear (all), delete (name [domain]).",
    "inputSchema": {
      "type": "object",
      "properties": {
        "action": { "type": "string", "enum": ["get", "set", "clear", "delete"], "description": "Cookie action" },
        "name": { "type": "string", "description": "Cookie name (for set/delete)" },
        "value": { "type": "string", "description": "Cookie value (for set)" },
        "domain": { "type": "string", "description": "Cookie domain (optional, defaults to current hostname)" }
      },
      "required": []
    }
  },
  {
    "name": "webact_console",
    "description": "View browser console output. Actions: show (recent logs), errors (errors only), listen (stream live).",
    "inputSchema": {
      "type": "object",
      "properties": {
        "action": { "type": "string", "enum": ["show", "errors", "listen"], "description": "Console action (default: show)" }
      },
      "required": []
    }
  },
  {
    "name": "webact_network",
    "description": "Capture or show network requests. 'capture [seconds] [filter]' records traffic. 'show [filter]' displays last capture.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "action": { "type": "string", "enum": ["capture", "show"], "description": "Network action (default: capture)" },
        "duration": { "type": "integer", "description": "Capture duration in seconds (default 10)" },
        "filter": { "type": "string", "description": "URL substring to filter requests" }
      },
      "required": []
    }
  },
  {
    "name": "webact_block",
    "description": "Block network requests by resource type or URL pattern. Types: images, css, fonts, media, scripts. Use '--ads' for ad/tracker blocking. Use 'off' to disable.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "patterns": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Resource types, URL substrings, '--ads', or 'off'"
        }
      },
      "required": ["patterns"]
    }
  },
  {
    "name": "webact_viewport",
    "description": "Set viewport size. Presets: mobile (375x667), iphone (390x844), ipad (820x1180), tablet (768x1024), desktop (1280x800). Or specify width and height.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "preset_or_width": { "type": "string", "description": "Preset name or width in pixels" },
        "height": { "type": "string", "description": "Height in pixels (when using numeric width)" }
      },
      "required": ["preset_or_width"]
    }
  },
  {
    "name": "webact_frames",
    "description": "List all frames and iframes on the page.",
    "inputSchema": { "type": "object", "properties": {}, "required": [] }
  },
  {
    "name": "webact_frame",
    "description": "Switch to a frame by ID, name, or CSS selector. Use 'main' to return to the top frame.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "target": { "type": "string", "description": "Frame ID, name, CSS selector, or 'main'" }
      },
      "required": ["target"]
    }
  },
  {
    "name": "webact_tabs",
    "description": "List all tabs owned by the current session.",
    "inputSchema": { "type": "object", "properties": {}, "required": [] }
  },
  {
    "name": "webact_tab",
    "description": "Switch to a session-owned tab by ID.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": { "type": "string", "description": "Tab ID (from webact_tabs output)" }
      },
      "required": ["id"]
    }
  },
  {
    "name": "webact_newtab",
    "description": "Open a new tab in the current session, optionally navigating to a URL.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "url": { "type": "string", "description": "URL to open in the new tab" }
      },
      "required": []
    }
  },
  {
    "name": "webact_close",
    "description": "Close the current tab.",
    "inputSchema": { "type": "object", "properties": {}, "required": [] }
  },
  {
    "name": "webact_back",
    "description": "Go back in browser history.",
    "inputSchema": { "type": "object", "properties": {}, "required": [] }
  },
  {
    "name": "webact_forward",
    "description": "Go forward in browser history.",
    "inputSchema": { "type": "object", "properties": {}, "required": [] }
  },
  {
    "name": "webact_reload",
    "description": "Reload the current page.",
    "inputSchema": { "type": "object", "properties": {}, "required": [] }
  },
  {
    "name": "webact_activate",
    "description": "Bring the browser window to the front (macOS). Use when the user needs to see or interact with the browser directly.",
    "inputSchema": { "type": "object", "properties": {}, "required": [] }
  },
  {
    "name": "webact_minimize",
    "description": "Minimize the browser window (macOS). Use after the user has finished interacting with the browser directly.",
    "inputSchema": { "type": "object", "properties": {}, "required": [] }
  },
  {
    "name": "webact_humanclick",
    "description": "Click with human-like mouse movement (Bezier curve path, variable timing). Helps avoid bot detection.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "target": { "type": "string", "description": "CSS selector, 'x,y' coordinates, ref number, or '--text Some Text'" }
      },
      "required": ["target"]
    }
  },
  {
    "name": "webact_humantype",
    "description": "Type with human-like variable delays and occasional typo corrections. Helps avoid bot detection.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "selector": { "type": "string", "description": "CSS selector or ref number of the input element" },
        "text": { "type": "string", "description": "Text to type" }
      },
      "required": ["selector", "text"]
    }
  },
  {
    "name": "webact_lock",
    "description": "Lock the active tab for exclusive access by this session.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "seconds": { "type": "integer", "description": "Lock duration in seconds (default 300)" }
      },
      "required": []
    }
  },
  {
    "name": "webact_unlock",
    "description": "Release the tab lock.",
    "inputSchema": { "type": "object", "properties": {}, "required": [] }
  },
  {
    "name": "webact_download",
    "description": "Manage downloads. 'path <dir>' sets download directory. 'list' shows downloaded files.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "action": { "type": "string", "enum": ["path", "list"], "description": "Download action" },
        "path": { "type": "string", "description": "Download directory path (for 'path' action)" }
      },
      "required": []
    }
  }
]
```

**Step 2: Commit**

```bash
git add skills/webact/tools.json
git commit -m "Add shared MCP tool definitions"
```

---

## Task 2: Node.js MCP server — stdio handler + tool dispatch

**Files:**
- Create: `skills/webact/mcp.src.js`
- Modify: `skills/webact/package.json`

**Step 1: Create `mcp.src.js`**

This is the MCP server entry point. It:
1. Reads newline-delimited JSON-RPC from stdin
2. Handles `initialize`, `tools/list`, `tools/call`
3. For `tools/call`, maps tool name to webact command + args, captures console.log output, returns as MCP text content
4. Special-cases `webact_screenshot` to return image content

```javascript
#!/usr/bin/env node
'use strict';

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const TOOLS = require('./tools.json');

// --- Import webact internals (same as webact.src.js) ---
const os = require('os');
const crypto = require('crypto');
const { version: VERSION } = require('./package.json');
const {
  IS_WSL, getWSLHostIP, wslWindowsPath,
  findBrowser: findBrowserRaw,
  minimizeBrowser: minimizeBrowserRaw,
  activateBrowser: activateBrowserRaw,
} = require('./lib/browser');
const createStateStore = require('./lib/state');
const {
  findFreePort, httpGet: httpGetRaw, httpPut: httpPutRaw,
  getDebugTabs: getDebugTabsRaw, createNewTab: createNewTabRaw,
  createCDP: createCDPRaw,
} = require('./lib/cdp');
const { SELECTOR_GEN_SCRIPT, getPageBrief } = require('./lib/page');
const { parseCoordinates, parseKeyCombo, humanClick, humanTypeText } = require('./lib/input');
const {
  getFrameContextId: getFrameContextIdRaw,
  locateElement: locateElementRaw,
  locateElementByText: locateElementByTextRaw,
} = require('./lib/locator');
const createAxCommands = require('./lib/commands/ax');
const createExtendedCommands = require('./lib/commands/extended');
const createBaseCommands = require('./lib/commands/base');
const createInteractionCommands = require('./lib/commands/interactions');

// --- Session state (persistent across tool calls) ---
const TMP = os.tmpdir();
let CDP_PORT = 9222;
let CDP_HOST = '127.0.0.1';
let currentSessionId = null;
let launchBrowserName = null;
const stateStore = createStateStore(TMP);
const LAST_SESSION_FILE = stateStore.lastSessionFile;

// (Copy the same helper functions from webact.src.js:
//  sessionStateFile, loadSessionState, saveSessionState,
//  resolveSelector, loadActionCache, saveActionCache,
//  loadTabLocks, saveTabLocks, checkTabLock,
//  httpGet, httpPut, getDebugTabs, createNewTab,
//  connectToTab, createCDP, getFrameContextId, withCDP,
//  locateElement, locateElementByText,
//  findBrowser, minimizeBrowser, activateBrowser,
//  cmdLaunch, cmdConnect, and all command factories)

// ... (all the same module-level setup from webact.src.js lines 44-507)
// ... (dispatch function from webact.src.js lines 511-718, WITHOUT the process.exit calls)

// --- Output capture ---
function captureOutput(fn) {
  // Replace console.log/error to capture output
  const chunks = [];
  const origLog = console.log;
  const origError = console.error;
  console.log = (...args) => chunks.push(args.map(String).join(' '));
  console.error = (...args) => chunks.push(args.map(String).join(' '));

  return fn().then(() => {
    console.log = origLog;
    console.error = origError;
    return chunks.join('\n');
  }).catch((err) => {
    console.log = origLog;
    console.error = origError;
    throw err;
  });
}

// --- Tool name → command + args mapping ---
function toolToCommandArgs(toolName, params) {
  // Strip 'webact_' prefix to get command name
  const command = toolName.replace(/^webact_/, '');
  const args = [];

  switch (command) {
    case 'navigate': args.push(params.url); break;
    case 'dom':
      if (params.selector) args.push(params.selector);
      if (params.max_tokens) args.push(`--tokens=${params.max_tokens}`);
      break;
    case 'axtree':
      if (params.interactive) args.push('-i');
      if (params.diff) args.push('--diff');
      if (params.selector) args.push(params.selector);
      if (params.max_tokens) args.push(`--tokens=${params.max_tokens}`);
      break;
    case 'find': args.push(params.query); break;
    case 'pdf': if (params.path) args.push(params.path); break;
    case 'click': case 'doubleclick': case 'rightclick':
    case 'hover': case 'humanclick':
      args.push(...params.target.split(' '));
      break;
    case 'focus': case 'clear': args.push(params.selector); break;
    case 'type': case 'humantype':
      args.push(params.selector, params.text);
      break;
    case 'keyboard': case 'paste': args.push(params.text); break;
    case 'press': args.push(params.key); break;
    case 'select':
      args.push(params.selector, ...params.values);
      break;
    case 'upload':
      args.push(params.selector, ...params.files);
      break;
    case 'drag': args.push(params.from, params.to); break;
    case 'scroll':
      args.push(...params.target.split(' '));
      if (params.pixels) args.push(String(params.pixels));
      break;
    case 'eval': args.push(params.expression); break;
    case 'dialog':
      args.push(params.action);
      if (params.text) args.push(params.text);
      break;
    case 'waitfor':
      args.push(params.selector);
      if (params.timeout) args.push(String(params.timeout));
      break;
    case 'waitfornav':
      if (params.timeout) args.push(String(params.timeout));
      break;
    case 'cookies':
      if (params.action) args.push(params.action);
      if (params.name) args.push(params.name);
      if (params.value) args.push(params.value);
      if (params.domain) args.push(params.domain);
      break;
    case 'console':
      if (params.action) args.push(params.action);
      break;
    case 'network':
      if (params.action) args.push(params.action);
      if (params.duration) args.push(String(params.duration));
      if (params.filter) args.push(params.filter);
      break;
    case 'block':
      args.push(...(params.patterns || []));
      break;
    case 'viewport':
      args.push(params.preset_or_width);
      if (params.height) args.push(params.height);
      break;
    case 'frame': args.push(params.target); break;
    case 'tab': args.push(params.id); break;
    case 'newtab': if (params.url) args.push(params.url); break;
    case 'lock': if (params.seconds) args.push(String(params.seconds)); break;
    case 'download':
      if (params.action) args.push(params.action);
      if (params.path) args.push(params.path);
      break;
    // No-arg commands: launch, connect, screenshot, observe, frames, tabs,
    //                  close, back, forward, reload, activate, minimize, unlock
  }
  return { command, args };
}

// --- MCP JSON-RPC handler ---
function sendResponse(id, result) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(msg + '\n');
}

function sendError(id, code, message) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
  process.stdout.write(msg + '\n');
}

async function handleRequest(request) {
  const { id, method, params } = request;

  if (method === 'initialize') {
    return sendResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'webact', version: VERSION },
    });
  }

  if (method === 'notifications/initialized') {
    return; // no response needed
  }

  if (method === 'tools/list') {
    return sendResponse(id, { tools: TOOLS });
  }

  if (method === 'tools/call') {
    const toolName = params.name;
    const toolParams = params.arguments || {};

    // Special case: screenshot returns image
    if (toolName === 'webact_screenshot') {
      try {
        // Auto-discover session if needed
        ensureSession();
        await captureOutput(() => dispatch('screenshot', []));
        // Read the screenshot file
        const sid = currentSessionId || 'default';
        const screenshotPath = path.join(TMP, `webact-screenshot-${sid}.png`);
        const data = fs.readFileSync(screenshotPath);
        return sendResponse(id, {
          content: [{
            type: 'image',
            data: data.toString('base64'),
            mimeType: 'image/png',
          }],
        });
      } catch (err) {
        return sendResponse(id, {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        });
      }
    }

    const { command, args } = toolToCommandArgs(toolName, toolParams);

    try {
      // Auto-discover session for non-launch/connect commands
      if (command !== 'launch' && command !== 'connect') {
        ensureSession();
      }
      const output = await captureOutput(() => dispatch(command, args));
      return sendResponse(id, {
        content: [{ type: 'text', text: output || '(no output)' }],
      });
    } catch (err) {
      return sendResponse(id, {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      });
    }
  }

  sendError(id, -32601, `Method not found: ${method}`);
}

function ensureSession() {
  if (currentSessionId) return;
  try {
    const lastSid = fs.readFileSync(LAST_SESSION_FILE, 'utf8').trim();
    currentSessionId = lastSid;
    const state = loadSessionState();
    if (state.port) CDP_PORT = state.port;
    if (state.host) CDP_HOST = state.host;
  } catch {
    // No session yet — launch will create one
  }
}

// --- Stdio loop ---
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  if (!line.trim()) return;
  try {
    const request = JSON.parse(line);
    await handleRequest(request);
  } catch (err) {
    sendError(null, -32700, `Parse error: ${err.message}`);
  }
});
```

Note: The actual implementation will need to copy/adapt the webact internals. The key structural decision is whether to:
- (a) Import from `webact.src.js` modules (cleaner, requires the lib/ directory)
- (b) Bundle everything into one file via esbuild (matches current pattern)

Use option (b): create `mcp.src.js` that imports from `./lib/*`, then esbuild bundles it into `mcp.js`.

**Step 2: Update `package.json`**

Add to `bin`:
```json
"webact-mcp": "./mcp.js"
```

Add `mcp.js` to `files`:
```json
"files": ["webact.js", "mcp.js", "tools.json", "SKILL.md", "agents/"]
```

Add build script:
```json
"build:mcp": "esbuild mcp.src.js --bundle --platform=node --target=node18 --format=cjs --banner:js='#!/usr/bin/env node' --external:bufferutil --external:utf-8-validate --outfile=mcp.js"
```

**Step 3: Build and verify it starts**

```bash
cd skills/webact && npm run build:mcp
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test"}}}' | node mcp.js
```

Expected: JSON response with `protocolVersion`, `capabilities.tools`, `serverInfo`.

**Step 4: Commit**

```bash
git add skills/webact/mcp.src.js skills/webact/mcp.js skills/webact/package.json
git commit -m "Add Node.js MCP server for webact"
```

---

## Task 3: Rust MCP server — output buffer refactor

Before building the Rust MCP server, refactor `AppContext` to support output capture. Commands currently use `println!()` which writes directly to stdout — but the MCP server needs stdout for JSON-RPC.

**Files:**
- Modify: `skills/webact-rs/src/main.rs`
- Modify: `skills/webact-rs/src/commands/core.rs`
- Modify: `skills/webact-rs/src/commands/data.rs`
- Modify: `skills/webact-rs/src/commands/session.rs`
- Modify: `skills/webact-rs/src/commands/interaction/pointer.rs`
- Modify: `skills/webact-rs/src/commands/interaction/forms.rs`
- Modify: `skills/webact-rs/src/commands/interaction/query.rs`
- Modify: `skills/webact-rs/src/commands/interaction/waiting.rs`
- Modify: `skills/webact-rs/src/utils.rs`

**Step 1: Add output buffer to AppContext**

In `main.rs`, add field to `AppContext`:

```rust
struct AppContext {
    // ... existing fields ...
    output: String,
}
```

Initialize in `AppContext::new()`:
```rust
output: String::new(),
```

Add helper method:
```rust
impl AppContext {
    fn write_out(&mut self, s: &str) {
        self.output.push_str(s);
        self.output.push('\n');
    }

    fn write_out_fmt(&mut self, args: std::fmt::Arguments<'_>) {
        use std::fmt::Write;
        let _ = writeln!(self.output, "{}", args);
    }

    fn drain_output(&mut self) -> String {
        std::mem::take(&mut self.output)
    }
}
```

Add a convenience macro at crate level:
```rust
macro_rules! out {
    ($ctx:expr, $($arg:tt)*) => {
        $ctx.write_out_fmt(format_args!($($arg)*))
    };
}
```

**Step 2: Replace all `println!()` with `out!(ctx, ...)` in command files**

Search all command files for `println!` and replace with `out!(ctx, ...)`. The `ctx` parameter is already passed to every command function. Examples:

```rust
// Before:
println!("Session: {session_id}");
// After:
out!(ctx, "Session: {session_id}");

// Before:
println!("{}", get_page_brief(&mut cdp).await?);
// After:
let brief = get_page_brief(&mut cdp).await?;
out!(ctx, "{brief}");
```

Also replace `eprintln!` in the auto-dialog handler in `CdpClient::send` — that one should stay as `eprintln!` since it's debug output, not command output.

For `print_frame_tree` in `utils.rs`, change signature to accept `&mut AppContext` (or `&mut String`) and write there instead of `println!`.

**Step 3: Keep CLI working**

In the existing `main.rs` `run()` function, after `commands::dispatch()` returns, print the output buffer:

```rust
commands::dispatch(&mut ctx, &command, &args).await?;
let output = ctx.drain_output();
if !output.is_empty() {
    print!("{output}");
}
```

**Step 4: Verify CLI still works**

```bash
cd skills/webact-rs && cargo build
./target/debug/webact-rs --version
./target/debug/webact-rs --help
```

Expected: Same output as before.

**Step 5: Commit**

```bash
git add -A skills/webact-rs/
git commit -m "Refactor webact-rs to buffer output for MCP support"
```

---

## Task 4: Rust MCP server — mcp_main.rs

**Files:**
- Create: `skills/webact-rs/src/mcp_main.rs`
- Modify: `skills/webact-rs/Cargo.toml`

**Step 1: Add binary target to Cargo.toml**

```toml
[[bin]]
name = "webact-rs"
path = "src/main.rs"

[[bin]]
name = "webact-mcp"
path = "src/mcp_main.rs"
```

**Step 2: Create `mcp_main.rs`**

The MCP server reads JSON-RPC from stdin line by line, dispatches to webact commands, and writes responses to stdout.

```rust
use anyhow::Result;
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

// Share the same crate modules
mod commands;
mod scripts;
mod types;
mod utils;

// Re-use AppContext, dispatch, etc. from the main crate
// NOTE: This requires restructuring so main.rs and mcp_main.rs
// share the core logic. Move AppContext, CdpClient, helpers into lib.rs
// and have both binaries use them.

#[tokio::main]
async fn main() {
    let mut ctx = AppContext::new().expect("failed to init");
    let stdin = BufReader::new(tokio::io::stdin());
    let mut stdout = tokio::io::stdout();
    let mut lines = stdin.lines();

    // Load tools.json embedded at compile time
    let tools: Vec<Value> = serde_json::from_str(include_str!("../tools.json"))
        .expect("invalid tools.json");

    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() { continue; }
        let request: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                let err = json!({
                    "jsonrpc": "2.0",
                    "id": null,
                    "error": { "code": -32700, "message": format!("Parse error: {e}") }
                });
                let _ = stdout.write_all(format!("{}\n", err).as_bytes()).await;
                continue;
            }
        };

        let id = request.get("id").cloned().unwrap_or(Value::Null);
        let method = request.get("method").and_then(Value::as_str).unwrap_or("");

        let response = match method {
            "initialize" => json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": { "tools": {} },
                    "serverInfo": { "name": "webact", "version": env!("CARGO_PKG_VERSION") }
                }
            }),
            "notifications/initialized" => continue,
            "tools/list" => json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": { "tools": tools }
            }),
            "tools/call" => {
                handle_tool_call(&mut ctx, &id, &request, &tools).await
            },
            _ => json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32601, "message": format!("Method not found: {method}") }
            }),
        };

        let _ = stdout.write_all(format!("{}\n", response).as_bytes()).await;
        let _ = stdout.flush().await;
    }
}

async fn handle_tool_call(ctx: &mut AppContext, id: &Value, request: &Value, _tools: &[Value]) -> Value {
    let params = request.get("params").cloned().unwrap_or(Value::Null);
    let tool_name = params.get("name").and_then(Value::as_str).unwrap_or("");
    let arguments = params.get("arguments").cloned().unwrap_or(json!({}));

    // Map tool name to command + args
    let (command, args) = tool_to_command_args(tool_name, &arguments);

    // Auto-discover session for non-launch commands
    if command != "launch" && command != "connect" && ctx.current_session_id.is_none() {
        let _ = ctx.auto_discover_last_session();
    }

    // Special case: screenshot returns image
    if command == "screenshot" {
        return handle_screenshot(ctx, id).await;
    }

    match commands::dispatch(ctx, &command, &args).await {
        Ok(()) => {
            let output = ctx.drain_output();
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "content": [{ "type": "text", "text": if output.is_empty() { "(no output)" } else { &output } }]
                }
            })
        }
        Err(e) => json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "content": [{ "type": "text", "text": format!("Error: {e:#}") }],
                "isError": true
            }
        }),
    }
}

async fn handle_screenshot(ctx: &mut AppContext, id: &Value) -> Value {
    match commands::dispatch(ctx, "screenshot", &[]).await {
        Ok(()) => {
            let output = ctx.drain_output();
            // Extract file path from output like "Screenshot saved to /tmp/..."
            let path = output.trim().strip_prefix("Screenshot saved to ").unwrap_or(&output);
            match std::fs::read(path.trim()) {
                Ok(bytes) => {
                    use base64::Engine;
                    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                    json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "result": {
                            "content": [{ "type": "image", "data": b64, "mimeType": "image/png" }]
                        }
                    })
                }
                Err(e) => json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": {
                        "content": [{ "type": "text", "text": format!("Screenshot file error: {e}") }],
                        "isError": true
                    }
                }),
            }
        }
        Err(e) => json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "content": [{ "type": "text", "text": format!("Error: {e:#}") }],
                "isError": true
            }
        }),
    }
}

fn tool_to_command_args(tool_name: &str, params: &Value) -> (String, Vec<String>) {
    let command = tool_name.strip_prefix("webact_").unwrap_or(tool_name).to_string();
    let mut args: Vec<String> = Vec::new();

    match command.as_str() {
        "navigate" => { if let Some(v) = params.get("url").and_then(Value::as_str) { args.push(v.to_string()); } }
        "dom" => {
            if let Some(v) = params.get("selector").and_then(Value::as_str) { args.push(v.to_string()); }
            if let Some(v) = params.get("max_tokens").and_then(Value::as_i64) { args.push(format!("--tokens={v}")); }
        }
        "axtree" => {
            if params.get("interactive").and_then(Value::as_bool).unwrap_or(false) { args.push("-i".to_string()); }
            if params.get("diff").and_then(Value::as_bool).unwrap_or(false) { args.push("--diff".to_string()); }
            if let Some(v) = params.get("selector").and_then(Value::as_str) { args.push(v.to_string()); }
            if let Some(v) = params.get("max_tokens").and_then(Value::as_i64) { args.push(format!("--tokens={v}")); }
        }
        "find" => { if let Some(v) = params.get("query").and_then(Value::as_str) { args.push(v.to_string()); } }
        "pdf" => { if let Some(v) = params.get("path").and_then(Value::as_str) { args.push(v.to_string()); } }
        "click" | "doubleclick" | "rightclick" | "hover" | "humanclick" => {
            if let Some(v) = params.get("target").and_then(Value::as_str) {
                args.extend(v.split_whitespace().map(String::from));
            }
        }
        "focus" | "clear" => { if let Some(v) = params.get("selector").and_then(Value::as_str) { args.push(v.to_string()); } }
        "type" | "humantype" => {
            if let Some(v) = params.get("selector").and_then(Value::as_str) { args.push(v.to_string()); }
            if let Some(v) = params.get("text").and_then(Value::as_str) { args.push(v.to_string()); }
        }
        "keyboard" | "paste" => { if let Some(v) = params.get("text").and_then(Value::as_str) { args.push(v.to_string()); } }
        "press" => { if let Some(v) = params.get("key").and_then(Value::as_str) { args.push(v.to_string()); } }
        "select" => {
            if let Some(v) = params.get("selector").and_then(Value::as_str) { args.push(v.to_string()); }
            if let Some(arr) = params.get("values").and_then(Value::as_array) {
                for v in arr { if let Some(s) = v.as_str() { args.push(s.to_string()); } }
            }
        }
        "upload" => {
            if let Some(v) = params.get("selector").and_then(Value::as_str) { args.push(v.to_string()); }
            if let Some(arr) = params.get("files").and_then(Value::as_array) {
                for v in arr { if let Some(s) = v.as_str() { args.push(s.to_string()); } }
            }
        }
        "drag" => {
            if let Some(v) = params.get("from").and_then(Value::as_str) { args.push(v.to_string()); }
            if let Some(v) = params.get("to").and_then(Value::as_str) { args.push(v.to_string()); }
        }
        "scroll" => {
            if let Some(v) = params.get("target").and_then(Value::as_str) {
                args.extend(v.split_whitespace().map(String::from));
            }
            if let Some(v) = params.get("pixels").and_then(Value::as_i64) { args.push(v.to_string()); }
        }
        "eval" => { if let Some(v) = params.get("expression").and_then(Value::as_str) { args.push(v.to_string()); } }
        "dialog" => {
            if let Some(v) = params.get("action").and_then(Value::as_str) { args.push(v.to_string()); }
            if let Some(v) = params.get("text").and_then(Value::as_str) { args.push(v.to_string()); }
        }
        "waitfor" => {
            if let Some(v) = params.get("selector").and_then(Value::as_str) { args.push(v.to_string()); }
            if let Some(v) = params.get("timeout").and_then(Value::as_i64) { args.push(v.to_string()); }
        }
        "waitfornav" => { if let Some(v) = params.get("timeout").and_then(Value::as_i64) { args.push(v.to_string()); } }
        "cookies" => {
            if let Some(v) = params.get("action").and_then(Value::as_str) { args.push(v.to_string()); }
            if let Some(v) = params.get("name").and_then(Value::as_str) { args.push(v.to_string()); }
            if let Some(v) = params.get("value").and_then(Value::as_str) { args.push(v.to_string()); }
            if let Some(v) = params.get("domain").and_then(Value::as_str) { args.push(v.to_string()); }
        }
        "console" => { if let Some(v) = params.get("action").and_then(Value::as_str) { args.push(v.to_string()); } }
        "network" => {
            if let Some(v) = params.get("action").and_then(Value::as_str) { args.push(v.to_string()); }
            if let Some(v) = params.get("duration").and_then(Value::as_i64) { args.push(v.to_string()); }
            if let Some(v) = params.get("filter").and_then(Value::as_str) { args.push(v.to_string()); }
        }
        "block" => {
            if let Some(arr) = params.get("patterns").and_then(Value::as_array) {
                for v in arr { if let Some(s) = v.as_str() { args.push(s.to_string()); } }
            }
        }
        "viewport" => {
            if let Some(v) = params.get("preset_or_width").and_then(Value::as_str) { args.push(v.to_string()); }
            if let Some(v) = params.get("height").and_then(Value::as_str) { args.push(v.to_string()); }
        }
        "frame" => { if let Some(v) = params.get("target").and_then(Value::as_str) { args.push(v.to_string()); } }
        "tab" => { if let Some(v) = params.get("id").and_then(Value::as_str) { args.push(v.to_string()); } }
        "newtab" => { if let Some(v) = params.get("url").and_then(Value::as_str) { args.push(v.to_string()); } }
        "lock" => { if let Some(v) = params.get("seconds").and_then(Value::as_i64) { args.push(v.to_string()); } }
        "download" => {
            if let Some(v) = params.get("action").and_then(Value::as_str) { args.push(v.to_string()); }
            if let Some(v) = params.get("path").and_then(Value::as_str) { args.push(v.to_string()); }
        }
        _ => {} // No-arg commands
    }

    (command, args)
}
```

**Step 3: Restructure for shared code**

The Rust crate currently has everything in `main.rs` (AppContext, CdpClient, helpers). To share between two binaries, move shared code to `lib.rs`:

- Create `skills/webact-rs/src/lib.rs` — move `AppContext`, `CdpClient`, all helper functions, and re-export `commands`, `scripts`, `types`, `utils` modules
- Slim `main.rs` to just `fn main()` + CLI arg parsing + `run()` that calls into lib
- `mcp_main.rs` imports from lib

```rust
// src/lib.rs
pub mod commands;
pub mod scripts;
pub mod types;
pub mod utils;

// Move AppContext, CdpClient, open_cdp, connect_to_tab,
// runtime_evaluate, locate_element, etc. here
```

**Step 4: Copy `tools.json` into the Rust source tree**

```bash
cp skills/webact/tools.json skills/webact-rs/tools.json
```

The Rust binary embeds it at compile time via `include_str!("../tools.json")`.

**Step 5: Build and verify**

```bash
cd skills/webact-rs && cargo build
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test"}}}' | ./target/debug/webact-mcp
```

Expected: JSON response with capabilities and server info.

Also verify CLI still works:
```bash
./target/debug/webact-rs --version
```

**Step 6: Commit**

```bash
git add -A skills/webact-rs/
git commit -m "Add Rust MCP server for webact"
```

---

## Task 5: End-to-end test with Claude Desktop

**Step 1: Test Node.js server**

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "webact": {
      "command": "node",
      "args": ["/Users/karthik/src/webact/skills/webact/mcp.js"]
    }
  }
}
```

Restart Claude Desktop. Verify webact tools appear in the tool list. Ask Claude to "launch a browser and navigate to example.com".

**Step 2: Test Rust server**

Replace config with:
```json
{
  "mcpServers": {
    "webact": {
      "command": "/Users/karthik/src/webact/skills/webact-rs/target/debug/webact-mcp"
    }
  }
}
```

Restart Claude Desktop. Same test.

**Step 3: Test key flows**

- Launch → navigate → dom
- Navigate → axtree -i → click ref → page brief
- Screenshot → verify image appears in conversation
- Type into a form → press Enter
- Tab management (newtab, tabs, close)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "Fix MCP server issues found in end-to-end testing"
```
