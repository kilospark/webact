#!/usr/bin/env node
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// package.json
var require_package = __commonJS({
  "package.json"(exports2, module2) {
    module2.exports = {
      name: "@kilospark/webact",
      version: "2.14.0",
      description: "CLI for browser automation via Chrome DevTools Protocol",
      main: "webact.js",
      bin: {
        webact: "./webact.js",
        "webact-mcp": "./mcp.js"
      },
      files: [
        "webact.js",
        "mcp.js",
        "tools.json",
        "SKILL.md",
        "MCP_INSTRUCTIONS.md",
        "agents/"
      ],
      scripts: {
        build: "esbuild webact.src.js --bundle --platform=node --target=node18 --format=cjs --banner:js='#!/usr/bin/env node' --external:bufferutil --external:utf-8-validate --outfile=webact.js",
        "build:mcp": "esbuild mcp.src.js --bundle --platform=node --target=node18 --format=cjs --banner:js='#!/usr/bin/env node' --external:bufferutil --external:utf-8-validate --outfile=mcp.js",
        test: 'echo "Error: no test specified" && exit 1'
      },
      keywords: [
        "browser",
        "automation",
        "chrome",
        "cdp",
        "cli",
        "agents"
      ],
      author: "",
      license: "ISC",
      type: "commonjs",
      repository: {
        type: "git",
        url: "https://github.com/kilospark/webact.git",
        directory: "skills/webact"
      },
      engines: {
        node: ">=18.0.0"
      },
      devDependencies: {
        esbuild: "^0.24.0",
        ws: "^8.19.0"
      }
    };
  }
});

// tools.json
var require_tools = __commonJS({
  "tools.json"(exports2, module2) {
    module2.exports = [
      {
        name: "webact_launch",
        description: "Launch Chrome and create a browser session. Run this first before any other command.",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "webact_navigate",
        description: "Navigate to a URL. Auto-prints a compact page summary showing URL, title, inputs, buttons, and links.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to navigate to (https:// prefix added if missing)" }
          },
          required: ["url"]
        }
      },
      {
        name: "webact_dom",
        description: "Get compact DOM of the page. Scripts, styles, SVGs, and hidden elements are stripped. Use selector to scope, max_tokens to limit output size.",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector to scope DOM extraction" },
            max_tokens: { type: "integer", description: "Approximate token limit for output" }
          },
          required: []
        }
      },
      {
        name: "webact_axtree",
        description: "Get accessibility tree. Use interactive=true for a flat numbered list of actionable elements (most compact). After running with interactive=true, use ref numbers as selectors in click/type/etc. Use diff=true to show changes since last snapshot.",
        inputSchema: {
          type: "object",
          properties: {
            interactive: { type: "boolean", description: "Show only interactive elements with ref numbers" },
            diff: { type: "boolean", description: "Show only changes since last snapshot" },
            selector: { type: "string", description: "CSS selector to scope the tree" },
            max_tokens: { type: "integer", description: "Approximate token limit for output" }
          },
          required: []
        }
      },
      {
        name: "webact_observe",
        description: "Show interactive elements as ready-to-use commands (e.g., 'click 1', 'type 3 <text>'). Generates ref map as side effect.",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "webact_find",
        description: "Find an element by natural language description (e.g., 'login button', 'search input').",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Description of the element to find" }
          },
          required: ["query"]
        }
      },
      {
        name: "webact_screenshot",
        description: "Capture a screenshot of the current page. Returns the image directly.",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "webact_pdf",
        description: "Save the current page as a PDF file.",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Output file path (default: temp directory)" }
          },
          required: []
        }
      },
      {
        name: "webact_click",
        description: "Click an element. Waits up to 5s for it to appear, scrolls into view, then clicks. Accepts a CSS selector, coordinates (e.g., '550,197'), ref number from axtree -i, or use --text prefix to find by visible text.",
        inputSchema: {
          type: "object",
          properties: {
            target: { type: "string", description: "CSS selector, 'x,y' coordinates, ref number, or '--text Some Text'" }
          },
          required: ["target"]
        }
      },
      {
        name: "webact_doubleclick",
        description: "Double-click an element. Same targeting as click.",
        inputSchema: {
          type: "object",
          properties: {
            target: { type: "string", description: "CSS selector, 'x,y' coordinates, ref number, or '--text Some Text'" }
          },
          required: ["target"]
        }
      },
      {
        name: "webact_rightclick",
        description: "Right-click an element. Same targeting as click.",
        inputSchema: {
          type: "object",
          properties: {
            target: { type: "string", description: "CSS selector, 'x,y' coordinates, ref number, or '--text Some Text'" }
          },
          required: ["target"]
        }
      },
      {
        name: "webact_hover",
        description: "Hover over an element. Same targeting as click.",
        inputSchema: {
          type: "object",
          properties: {
            target: { type: "string", description: "CSS selector, 'x,y' coordinates, ref number, or '--text Some Text'" }
          },
          required: ["target"]
        }
      },
      {
        name: "webact_focus",
        description: "Focus an element without clicking it.",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector or ref number" }
          },
          required: ["selector"]
        }
      },
      {
        name: "webact_clear",
        description: "Clear an input field or contenteditable element.",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector or ref number" }
          },
          required: ["selector"]
        }
      },
      {
        name: "webact_type",
        description: "Focus a specific input element and type text into it. Use 'keyboard' instead for typing at the current caret position (rich editors like Slack, Google Docs).",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector or ref number of the input element" },
            text: { type: "string", description: "Text to type" }
          },
          required: ["selector", "text"]
        }
      },
      {
        name: "webact_keyboard",
        description: "Type text at the current caret position without changing focus. Essential for rich text editors (Slack, Google Docs, Notion) where 'type' would reset the cursor.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Text to type at current caret" }
          },
          required: ["text"]
        }
      },
      {
        name: "webact_paste",
        description: "Paste text via ClipboardEvent. Works with apps that intercept paste (Google Docs, Notion). Faster than keyboard for large text.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Text to paste" }
          },
          required: ["text"]
        }
      },
      {
        name: "webact_press",
        description: "Press a key or key combo. Examples: Enter, Tab, Escape, Ctrl+A, Meta+C, Shift+Enter. On macOS, use Meta (not Ctrl) for app shortcuts.",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string", description: "Key name or combo (e.g., 'Enter', 'Ctrl+A', 'Meta+V')" }
          },
          required: ["key"]
        }
      },
      {
        name: "webact_select",
        description: "Select option(s) from a <select> dropdown by value or label text.",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector or ref number of the <select> element" },
            values: {
              type: "array",
              items: { type: "string" },
              description: "Value(s) or label(s) to select"
            }
          },
          required: ["selector", "values"]
        }
      },
      {
        name: "webact_upload",
        description: "Upload file(s) to a file input element.",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector or ref number of the file input" },
            files: {
              type: "array",
              items: { type: "string" },
              description: "Absolute file path(s) to upload"
            }
          },
          required: ["selector", "files"]
        }
      },
      {
        name: "webact_drag",
        description: "Drag from one element to another.",
        inputSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "CSS selector or ref number of the source element" },
            to: { type: "string", description: "CSS selector or ref number of the target element" }
          },
          required: ["from", "to"]
        }
      },
      {
        name: "webact_scroll",
        description: "Scroll the page or an element. Directions: up, down, top, bottom. Can scope to a container element for apps with custom scroll areas.",
        inputSchema: {
          type: "object",
          properties: {
            target: { type: "string", description: "Direction (up/down/top/bottom), CSS selector to scroll into view, or selector followed by direction" },
            pixels: { type: "integer", description: "Pixels to scroll (default 400)" }
          },
          required: ["target"]
        }
      },
      {
        name: "webact_eval",
        description: "Evaluate a JavaScript expression in the page context and return the result.",
        inputSchema: {
          type: "object",
          properties: {
            expression: { type: "string", description: "JavaScript expression to evaluate" }
          },
          required: ["expression"]
        }
      },
      {
        name: "webact_dialog",
        description: "Set a one-shot handler for the next JavaScript dialog (alert/confirm/prompt). Run BEFORE the action that triggers the dialog.",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["accept", "dismiss"], description: "Accept or dismiss the dialog" },
            text: { type: "string", description: "Text to enter for prompt dialogs" }
          },
          required: ["action"]
        }
      },
      {
        name: "webact_waitfor",
        description: "Wait for an element to appear on the page.",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector to wait for" },
            timeout: { type: "integer", description: "Timeout in milliseconds (default 5000)" }
          },
          required: ["selector"]
        }
      },
      {
        name: "webact_waitfornav",
        description: "Wait for page navigation to complete (readyState=complete).",
        inputSchema: {
          type: "object",
          properties: {
            timeout: { type: "integer", description: "Timeout in milliseconds (default 10000)" }
          },
          required: []
        }
      },
      {
        name: "webact_cookies",
        description: "Manage browser cookies. Actions: get (list all), set (name value [domain]), clear (all), delete (name [domain]).",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["get", "set", "clear", "delete"], description: "Cookie action" },
            name: { type: "string", description: "Cookie name (for set/delete)" },
            value: { type: "string", description: "Cookie value (for set)" },
            domain: { type: "string", description: "Cookie domain (optional, defaults to current hostname)" }
          },
          required: []
        }
      },
      {
        name: "webact_console",
        description: "View browser console output. Actions: show (recent logs), errors (errors only), listen (stream live).",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["show", "errors", "listen"], description: "Console action (default: show)" }
          },
          required: []
        }
      },
      {
        name: "webact_network",
        description: "Capture or show network requests. 'capture [seconds] [filter]' records traffic. 'show [filter]' displays last capture.",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["capture", "show"], description: "Network action (default: capture)" },
            duration: { type: "integer", description: "Capture duration in seconds (default 10)" },
            filter: { type: "string", description: "URL substring to filter requests" }
          },
          required: []
        }
      },
      {
        name: "webact_block",
        description: "Block network requests by resource type or URL pattern. Types: images, css, fonts, media, scripts. Use '--ads' for ad/tracker blocking. Use 'off' to disable.",
        inputSchema: {
          type: "object",
          properties: {
            patterns: {
              type: "array",
              items: { type: "string" },
              description: "Resource types, URL substrings, '--ads', or 'off'"
            }
          },
          required: ["patterns"]
        }
      },
      {
        name: "webact_viewport",
        description: "Set viewport size. Presets: mobile (375x667), iphone (390x844), ipad (820x1180), tablet (768x1024), desktop (1280x800). Or specify width and height.",
        inputSchema: {
          type: "object",
          properties: {
            preset_or_width: { type: "string", description: "Preset name or width in pixels" },
            height: { type: "string", description: "Height in pixels (when using numeric width)" }
          },
          required: ["preset_or_width"]
        }
      },
      {
        name: "webact_frames",
        description: "List all frames and iframes on the page.",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "webact_frame",
        description: "Switch to a frame by ID, name, or CSS selector. Use 'main' to return to the top frame.",
        inputSchema: {
          type: "object",
          properties: {
            target: { type: "string", description: "Frame ID, name, CSS selector, or 'main'" }
          },
          required: ["target"]
        }
      },
      {
        name: "webact_tabs",
        description: "List all tabs owned by the current session.",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "webact_tab",
        description: "Switch to a session-owned tab by ID.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Tab ID (from webact_tabs output)" }
          },
          required: ["id"]
        }
      },
      {
        name: "webact_newtab",
        description: "Open a new tab in the current session, optionally navigating to a URL.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to open in the new tab" }
          },
          required: []
        }
      },
      {
        name: "webact_close",
        description: "Close the current tab.",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "webact_back",
        description: "Go back in browser history.",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "webact_forward",
        description: "Go forward in browser history.",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "webact_reload",
        description: "Reload the current page.",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "webact_activate",
        description: "Bring the browser window to the front (macOS). Use when the user needs to see or interact with the browser directly.",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "webact_minimize",
        description: "Minimize the browser window (macOS). Use after the user has finished interacting with the browser directly.",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "webact_humanclick",
        description: "Click with human-like mouse movement (Bezier curve path, variable timing). Helps avoid bot detection.",
        inputSchema: {
          type: "object",
          properties: {
            target: { type: "string", description: "CSS selector, 'x,y' coordinates, ref number, or '--text Some Text'" }
          },
          required: ["target"]
        }
      },
      {
        name: "webact_humantype",
        description: "Type with human-like variable delays and occasional typo corrections. Helps avoid bot detection.",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector or ref number of the input element" },
            text: { type: "string", description: "Text to type" }
          },
          required: ["selector", "text"]
        }
      },
      {
        name: "webact_lock",
        description: "Lock the active tab for exclusive access by this session.",
        inputSchema: {
          type: "object",
          properties: {
            seconds: { type: "integer", description: "Lock duration in seconds (default 300)" }
          },
          required: []
        }
      },
      {
        name: "webact_unlock",
        description: "Release the tab lock.",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "webact_download",
        description: "Manage downloads. 'path <dir>' sets download directory. 'list' shows downloaded files.",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["path", "list"], description: "Download action" },
            path: { type: "string", description: "Download directory path (for 'path' action)" }
          },
          required: []
        }
      }
    ];
  }
});

// lib/browser.js
var require_browser = __commonJS({
  "lib/browser.js"(exports2, module2) {
    var fs2 = require("fs");
    var path2 = require("path");
    var { execSync } = require("child_process");
    var IS_WSL2 = (() => {
      try {
        return fs2.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft");
      } catch {
        return false;
      }
    })();
    function getWSLHostIP2() {
      try {
        if (process.env.WSL_HOST_IP) return process.env.WSL_HOST_IP;
        const resolv = fs2.readFileSync("/etc/resolv.conf", "utf8");
        const match = resolv.match(/nameserver\s+(\d+\.\d+\.\d+\.\d+)/);
        if (match) return match[1];
      } catch {
      }
      return null;
    }
    function wslWindowsPath2(linuxPath) {
      try {
        return execSync(`wslpath -w "${linuxPath}"`, { encoding: "utf8" }).trim();
      } catch {
        return linuxPath;
      }
    }
    function findBrowser2() {
      if (process.env.CHROME_PATH) {
        if (fs2.existsSync(process.env.CHROME_PATH)) {
          return { path: process.env.CHROME_PATH, name: path2.basename(process.env.CHROME_PATH) };
        }
        console.error(`CHROME_PATH set but not found: ${process.env.CHROME_PATH}`);
        process.exit(1);
      }
      const home = process.env.HOME || "";
      const platform = process.platform;
      const candidates = [];
      if (platform === "darwin") {
        const macApps = [
          ["Google Chrome", "Google Chrome.app/Contents/MacOS/Google Chrome"],
          ["Google Chrome Canary", "Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"],
          ["Microsoft Edge", "Microsoft Edge.app/Contents/MacOS/Microsoft Edge"],
          ["Brave Browser", "Brave Browser.app/Contents/MacOS/Brave Browser"],
          ["Arc", "Arc.app/Contents/MacOS/Arc"],
          ["Vivaldi", "Vivaldi.app/Contents/MacOS/Vivaldi"],
          ["Opera", "Opera.app/Contents/MacOS/Opera"],
          ["Chromium", "Chromium.app/Contents/MacOS/Chromium"]
        ];
        for (const [name, rel] of macApps) {
          candidates.push([`/Applications/${rel}`, name]);
          candidates.push([`${home}/Applications/${rel}`, name]);
        }
      } else if (platform === "linux") {
        candidates.push(
          ["/usr/bin/google-chrome-stable", "Google Chrome"],
          ["/usr/bin/google-chrome", "Google Chrome"],
          ["/usr/local/bin/google-chrome-stable", "Google Chrome"],
          ["/usr/local/bin/google-chrome", "Google Chrome"],
          ["/usr/bin/microsoft-edge-stable", "Microsoft Edge"],
          ["/usr/bin/microsoft-edge", "Microsoft Edge"],
          ["/usr/bin/brave-browser", "Brave Browser"],
          ["/usr/bin/brave-browser-stable", "Brave Browser"],
          ["/usr/bin/vivaldi-stable", "Vivaldi"],
          ["/usr/bin/vivaldi", "Vivaldi"],
          ["/usr/bin/opera", "Opera"],
          ["/usr/bin/chromium-browser", "Chromium"],
          ["/usr/bin/chromium", "Chromium"],
          ["/usr/local/bin/chromium-browser", "Chromium"],
          ["/usr/local/bin/chromium", "Chromium"],
          ["/snap/bin/chromium", "Chromium (snap)"],
          [`${home}/.local/share/flatpak/exports/bin/com.google.Chrome`, "Google Chrome (flatpak)"],
          ["/var/lib/flatpak/exports/bin/com.google.Chrome", "Google Chrome (flatpak)"],
          [`${home}/.local/share/flatpak/exports/bin/org.chromium.Chromium`, "Chromium (flatpak)"],
          ["/var/lib/flatpak/exports/bin/org.chromium.Chromium", "Chromium (flatpak)"],
          [`${home}/.local/share/flatpak/exports/bin/com.brave.Browser`, "Brave Browser (flatpak)"],
          ["/var/lib/flatpak/exports/bin/com.brave.Browser", "Brave Browser (flatpak)"]
        );
        if (IS_WSL2) {
          candidates.push(
            ["/mnt/c/Program Files/Google/Chrome/Application/chrome.exe", "Google Chrome (Windows)"],
            ["/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe", "Google Chrome (Windows)"],
            ["/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe", "Microsoft Edge (Windows)"],
            ["/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "Microsoft Edge (Windows)"],
            ["/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe", "Brave Browser (Windows)"],
            ["/mnt/c/Program Files/Vivaldi/Application/vivaldi.exe", "Vivaldi (Windows)"]
          );
        }
      } else if (platform === "win32") {
        const pf = process.env["PROGRAMFILES"] || "C:\\Program Files";
        const pf86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
        const local = process.env["LOCALAPPDATA"] || "";
        candidates.push(
          [`${pf}\\Google\\Chrome\\Application\\chrome.exe`, "Google Chrome"],
          [`${pf86}\\Google\\Chrome\\Application\\chrome.exe`, "Google Chrome"],
          [`${local}\\Google\\Chrome\\Application\\chrome.exe`, "Google Chrome"],
          [`${pf}\\Microsoft\\Edge\\Application\\msedge.exe`, "Microsoft Edge"],
          [`${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`, "Microsoft Edge"],
          [`${pf}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`, "Brave Browser"],
          [`${local}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`, "Brave Browser"],
          [`${pf}\\Vivaldi\\Application\\vivaldi.exe`, "Vivaldi"],
          [`${local}\\Vivaldi\\Application\\vivaldi.exe`, "Vivaldi"]
        );
      }
      for (const [p, name] of candidates) {
        if (fs2.existsSync(p)) {
          return { path: p, name };
        }
      }
      if (platform !== "win32") {
        const pathNames = [
          ["google-chrome-stable", "Google Chrome"],
          ["google-chrome", "Google Chrome"],
          ["chromium-browser", "Chromium"],
          ["chromium", "Chromium"],
          ["microsoft-edge-stable", "Microsoft Edge"],
          ["brave-browser", "Brave Browser"]
        ];
        for (const [bin, name] of pathNames) {
          try {
            const resolved = execSync(`which ${bin} 2>/dev/null`, { encoding: "utf8" }).trim();
            if (resolved) return { path: resolved, name };
          } catch {
          }
        }
      }
      return null;
    }
    function minimizeBrowser2(browserName) {
      if (process.platform !== "darwin") return;
      try {
        execSync(`osascript -e 'tell application "${browserName}" to set miniaturized of every window to true'`, { stdio: "ignore" });
      } catch {
      }
    }
    function activateBrowser2(browserName) {
      if (process.platform !== "darwin") return;
      try {
        execSync(`osascript -e 'tell application "${browserName}" to activate' -e 'tell application "${browserName}" to set miniaturized of window 1 to false'`, { stdio: "ignore" });
      } catch {
      }
    }
    module2.exports = {
      IS_WSL: IS_WSL2,
      getWSLHostIP: getWSLHostIP2,
      wslWindowsPath: wslWindowsPath2,
      findBrowser: findBrowser2,
      minimizeBrowser: minimizeBrowser2,
      activateBrowser: activateBrowser2
    };
  }
});

// lib/state.js
var require_state = __commonJS({
  "lib/state.js"(exports2, module2) {
    var fs2 = require("fs");
    var path2 = require("path");
    var CACHE_TTL2 = 48 * 60 * 60 * 1e3;
    var CACHE_MAX_ENTRIES = 100;
    function createStateStore2(tmpDir) {
      const lastSessionFile = path2.join(tmpDir, "webact-last-session");
      const actionCacheFile = path2.join(tmpDir, "webact-action-cache.json");
      const tabLocksFile = path2.join(tmpDir, "webact-tab-locks.json");
      function sessionStateFile(sessionId) {
        return path2.join(tmpDir, `webact-state-${sessionId}.json`);
      }
      function loadSessionState2(sessionId) {
        if (!sessionId) return { tabs: [] };
        try {
          return JSON.parse(fs2.readFileSync(sessionStateFile(sessionId), "utf8"));
        } catch {
          return { sessionId, activeTabId: null, tabs: [] };
        }
      }
      function saveSessionState2(sessionId, state) {
        if (!sessionId) return;
        fs2.writeFileSync(sessionStateFile(sessionId), JSON.stringify(state, null, 2));
      }
      function loadActionCache2() {
        try {
          return JSON.parse(fs2.readFileSync(actionCacheFile, "utf8"));
        } catch {
          return {};
        }
      }
      function saveActionCache2(cache) {
        const now = Date.now();
        for (const key of Object.keys(cache)) {
          if (now - cache[key].timestamp > CACHE_TTL2) delete cache[key];
        }
        const entries = Object.entries(cache).sort((a, b) => b[1].timestamp - a[1].timestamp);
        const pruned = entries.length > CACHE_MAX_ENTRIES ? Object.fromEntries(entries.slice(0, CACHE_MAX_ENTRIES)) : cache;
        fs2.writeFileSync(actionCacheFile, JSON.stringify(pruned));
      }
      function loadTabLocks2() {
        try {
          return JSON.parse(fs2.readFileSync(tabLocksFile, "utf8"));
        } catch {
          return {};
        }
      }
      function saveTabLocks2(locks) {
        fs2.writeFileSync(tabLocksFile, JSON.stringify(locks, null, 2));
      }
      function checkTabLock2(tabId) {
        const locks = loadTabLocks2();
        const lock = locks[tabId];
        if (!lock) return null;
        if (Date.now() > lock.expires) {
          delete locks[tabId];
          saveTabLocks2(locks);
          return null;
        }
        return lock;
      }
      return {
        cacheTtl: CACHE_TTL2,
        lastSessionFile,
        sessionStateFile,
        loadSessionState: loadSessionState2,
        saveSessionState: saveSessionState2,
        loadActionCache: loadActionCache2,
        saveActionCache: saveActionCache2,
        loadTabLocks: loadTabLocks2,
        saveTabLocks: saveTabLocks2,
        checkTabLock: checkTabLock2
      };
    }
    module2.exports = createStateStore2;
  }
});

// node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "node_modules/ws/lib/constants.js"(exports2, module2) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module2.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: Symbol("kIsForOnEventAttribute"),
      kListener: Symbol("kListener"),
      kStatusCode: Symbol("status-code"),
      kWebSocket: Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "node_modules/ws/lib/buffer-util.js"(exports2, module2) {
    "use strict";
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module2.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = require("bufferutil");
        module2.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module2.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32) _unmask(buffer, mask);
          else bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "node_modules/ws/lib/limiter.js"(exports2, module2) {
    "use strict";
    var kDone = Symbol("kDone");
    var kRun = Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module2.exports = Limiter;
  }
});

// node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/ws/lib/permessage-deflate.js"(exports2, module2) {
    "use strict";
    var zlib = require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = Symbol("permessage-deflate");
    var kTotalLength = Symbol("total-length");
    var kCallback = Symbol("callback");
    var kBuffers = Symbol("buffers");
    var kError = Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       * @param {Boolean} [isServer=false] Create the instance in either server or
       *     client mode
       * @param {Number} [maxPayload=0] The maximum allowed message length
       */
      constructor(options, isServer, maxPayload) {
        this._maxPayload = maxPayload | 0;
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._isServer = !!isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && !params.client_max_window_bits) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module2.exports = PerMessageDeflate;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "node_modules/ws/lib/validation.js"(exports2, module2) {
    "use strict";
    var { isUtf8 } = require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module2.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module2.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = require("utf-8-validate");
        module2.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "node_modules/ws/lib/receiver.js"(exports2, module2) {
    "use strict";
    var { Writable } = require("stream");
    var PerMessageDeflate = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module2.exports = Receiver;
  }
});

// node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "node_modules/ws/lib/sender.js"(exports2, module2) {
    "use strict";
    var { Duplex } = require("stream");
    var { randomFillSync } = require("crypto");
    var PerMessageDeflate = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) return [target, data];
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (skipMasking) return [target, data];
        if (merge) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else {
            buf.set(data, 2);
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module2.exports = Sender;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "node_modules/ws/lib/event-target.js"(exports2, module2) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = Symbol("kCode");
    var kData = Symbol("kData");
    var kError = Symbol("kError");
    var kMessage = Symbol("kMessage");
    var kReason = Symbol("kReason");
    var kTarget = Symbol("kTarget");
    var kType = Symbol("kType");
    var kWasClean = Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module2.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "node_modules/ws/lib/extension.js"(exports2, module2) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      if (dest[name] === void 0) dest[name] = [elem];
      else dest[name].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension) => {
        let configurations = extensions[extension];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module2.exports = { format, parse };
  }
});

// node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "node_modules/ws/lib/websocket.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events");
    var https = require("https");
    var http = require("http");
    var net = require("net");
    var tls = require("tls");
    var { randomBytes, createHash } = require("crypto");
    var { Duplex, Readable } = require("stream");
    var { URL: URL2 } = require("url");
    var PerMessageDeflate = require_permessage_deflate();
    var Receiver = require_receiver();
    var Sender = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var kAborted = Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            protocols = [];
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              protocols = [];
            } else {
              protocols = [protocols];
            }
          }
          initAsClient(this, address, protocols, options);
        } else {
          this._autoPong = options.autoPong;
          this._closeTimeout = options.closeTimeout;
          this._isServer = true;
        }
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate.extensionName]) {
          this._extensions[PerMessageDeflate.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._readyState = _WebSocket.CLOSING;
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket.prototype.addEventListener = addEventListener;
    WebSocket.prototype.removeEventListener = removeEventListener;
    module2.exports = WebSocket;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      websocket._autoPong = opts.autoPong;
      websocket._closeTimeout = opts.closeTimeout;
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL2) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL2(address);
        } catch (e) {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:") {
        parsedUrl.protocol = "ws:";
      } else if (parsedUrl.protocol === "https:") {
        parsedUrl.protocol = "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes(16).toString("base64");
      const request = isSecure ? https.request : http.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate(
          opts.perMessageDeflate !== true ? opts.perMessageDeflate : {},
          false,
          opts.maxPayload
        );
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
      }
      if (isIpcUrl) {
        const parts = opts.path.split(":");
        opts.socketPath = parts[0];
        opts.path = parts[1];
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL2(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeMessage = reason;
      websocket._closeCode = code;
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
      websocket.emit("ping", data);
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket.CLOSED) return;
      if (websocket.readyState === WebSocket.OPEN) {
        websocket._readyState = WebSocket.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket.CLOSING;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        const chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket.CLOSING;
        this.destroy();
      }
    }
  }
});

// node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "node_modules/ws/lib/stream.js"(exports2, module2) {
    "use strict";
    var WebSocket = require_websocket();
    var { Duplex } = require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream(ws, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws.pause();
      });
      ws.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws.terminate();
      };
      duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._final(callback);
          });
          return;
        }
        if (ws._socket === null) return;
        if (ws._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws._socket.once("finish", function finish() {
            callback();
          });
          ws.close();
        }
      };
      duplex._read = function() {
        if (ws.isPaused) ws.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module2.exports = createWebSocketStream;
  }
});

// node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "node_modules/ws/lib/subprotocol.js"(exports2, module2) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module2.exports = { parse };
  }
});

// node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "node_modules/ws/lib/websocket-server.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events");
    var http = require("http");
    var { Duplex } = require("stream");
    var { createHash } = require("crypto");
    var extension = require_extension();
    var PerMessageDeflate = require_permessage_deflate();
    var subprotocol = require_subprotocol();
    var WebSocket = require_websocket();
    var { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http.createServer((req, res) => {
            const body = http.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate(
            this.options.perMessageDeflate,
            true,
            this.options.maxPayload
          );
          try {
            const offers = extension.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate.extensionName]);
              extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate.extensionName]) {
          const params = extensions[PerMessageDeflate.extensionName].params;
          const value = extension.format({
            [PerMessageDeflate.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws);
          ws.on("close", () => {
            this.clients.delete(ws);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws, req);
      }
    };
    module2.exports = WebSocketServer;
    function addListeners(server, map) {
      for (const event of Object.keys(map)) server.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// node_modules/ws/index.js
var require_ws = __commonJS({
  "node_modules/ws/index.js"(exports2, module2) {
    "use strict";
    var WebSocket = require_websocket();
    WebSocket.createWebSocketStream = require_stream();
    WebSocket.Server = require_websocket_server();
    WebSocket.Receiver = require_receiver();
    WebSocket.Sender = require_sender();
    WebSocket.WebSocket = WebSocket;
    WebSocket.WebSocketServer = WebSocket.Server;
    module2.exports = WebSocket;
  }
});

// lib/cdp.js
var require_cdp = __commonJS({
  "lib/cdp.js"(exports2, module2) {
    var WebSocket = require_ws();
    var http = require("http");
    var net = require("net");
    function findFreePort2() {
      return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.listen(0, "127.0.0.1", () => {
          const port = srv.address().port;
          srv.close(() => resolve(port));
        });
        srv.on("error", reject);
      });
    }
    function httpGet2(url) {
      return new Promise((resolve, reject) => {
        http.get(url, (res) => {
          let data = "";
          res.on("data", (chunk) => data += chunk);
          res.on("end", () => resolve(data));
        }).on("error", reject);
      });
    }
    function httpPut2(url) {
      return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const req = http.request({
          hostname: parsed.hostname,
          port: parsed.port,
          path: parsed.pathname + parsed.search,
          method: "PUT"
        }, (res) => {
          let data = "";
          res.on("data", (chunk) => data += chunk);
          res.on("end", () => resolve(data));
        });
        req.on("error", reject);
        req.end();
      });
    }
    async function getDebugTabs2(host, port) {
      const data = await httpGet2(`http://${host}:${port}/json`);
      try {
        return JSON.parse(data);
      } catch {
        throw new Error("Failed to parse Chrome debug info");
      }
    }
    async function createNewTab2(host, port, url) {
      const endpoint = url ? `http://${host}:${port}/json/new?${url}` : `http://${host}:${port}/json/new`;
      const data = await httpPut2(endpoint);
      try {
        return JSON.parse(data);
      } catch {
        throw new Error("Failed to create new tab");
      }
    }
    function createCDP2(wsUrl) {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        let msgId = 1;
        const pending = /* @__PURE__ */ new Map();
        const eventHandlers = /* @__PURE__ */ new Map();
        ws.on("open", () => {
          const cdp = {
            send(method, params = {}) {
              return new Promise((res, rej) => {
                const id = msgId++;
                pending.set(id, { resolve: res, reject: rej });
                ws.send(JSON.stringify({ id, method, params }));
              });
            },
            on(event, handler) {
              eventHandlers.set(event, handler);
            },
            close() {
              ws.close();
            }
          };
          resolve(cdp);
        });
        ws.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.id && pending.has(msg.id)) {
            const { resolve: resolve2, reject: reject2 } = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) {
              reject2(new Error(`${msg.error.message} (${msg.error.code})`));
            } else {
              resolve2(msg.result);
            }
          } else if (msg.method && eventHandlers.has(msg.method)) {
            eventHandlers.get(msg.method)(msg.params);
          }
        });
        ws.on("error", reject);
        ws.on("close", () => {
          for (const { reject: reject2 } of pending.values()) {
            reject2(new Error("WebSocket closed"));
          }
          pending.clear();
        });
      });
    }
    module2.exports = {
      findFreePort: findFreePort2,
      httpGet: httpGet2,
      httpPut: httpPut2,
      getDebugTabs: getDebugTabs2,
      createNewTab: createNewTab2,
      createCDP: createCDP2
    };
  }
});

// lib/page.js
var require_page = __commonJS({
  "lib/page.js"(exports2, module2) {
    var SELECTOR_GEN_SCRIPT2 = `if (!window.__webactGenSelector) {
  window.__webactGenSelector = function(el) {
    if (el.id) {
      try {
        var sel = '#' + CSS.escape(el.id);
        if (document.querySelectorAll(sel).length === 1) return sel;
      } catch(e) {}
    }
    var tid = el.getAttribute('data-testid');
    if (tid && tid.indexOf('"') < 0 && tid.indexOf(']') < 0) {
      var sel = '[data-testid="' + tid + '"]';
      try { if (document.querySelectorAll(sel).length === 1) return sel; } catch(e) {}
    }
    var al = el.getAttribute('aria-label');
    if (al && al.indexOf('"') < 0 && al.indexOf(']') < 0) {
      var sel = '[aria-label="' + al + '"]';
      try { if (document.querySelectorAll(sel).length === 1) return sel; } catch(e) {}
    }
    var parts = [];
    var cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      var tag = cur.tagName.toLowerCase();
      var parent = cur.parentElement;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function(c) { return c.tagName === cur.tagName; });
        if (siblings.length > 1) tag += ':nth-of-type(' + (siblings.indexOf(cur) + 1) + ')';
      }
      parts.unshift(tag);
      cur = parent;
    }
    return parts.join(' > ');
  };
}`;
    var PAGE_BRIEF_SCRIPT = `(function() {
  function qsa(sel) {
    const results = [...document.querySelectorAll(sel)];
    (function walk(root) {
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) {
          results.push(...el.shadowRoot.querySelectorAll(sel));
          walk(el.shadowRoot);
        }
      }
    })(document);
    return results;
  }
  const t = document.title, u = location.href;
  const seen = new Set();
  const inputs = [], buttons = [], links = [];
  qsa('input:not([type=hidden]),textarea,select').forEach(el => {
    if (!el.offsetParent && getComputedStyle(el).display === 'none') return;
    if (inputs.length >= 5) return;
    const key = el.name || el.id || el.type;
    if (seen.has(key)) return;
    seen.add(key);
    const a = [el.tagName.toLowerCase()];
    if (el.name) a.push('name=' + el.name);
    if (el.type && el.type !== 'text') a.push('type=' + el.type);
    if (el.placeholder) a.push(JSON.stringify(el.placeholder.substring(0, 40)));
    inputs.push('[' + a.join(' ') + ']');
  });
  qsa('button,[role=button],input[type=submit]').forEach(el => {
    if (!el.offsetParent && getComputedStyle(el).display === 'none') return;
    if (buttons.length >= 5) return;
    const txt = (el.textContent || el.value || '').trim().substring(0, 30);
    if (!txt || txt.includes('{') || seen.has(txt)) return;
    seen.add(txt);
    buttons.push('[button ' + JSON.stringify(txt) + ']');
  });
  qsa('a[href]').forEach(el => {
    if (!el.offsetParent) return;
    if (links.length >= 8) return;
    const txt = el.textContent.trim().substring(0, 25);
    if (txt && !seen.has(txt)) { seen.add(txt); links.push(txt); }
  });
  const totalInputs = qsa('input:not([type=hidden]),textarea,select').length;
  const totalButtons = qsa('button,[role=button],input[type=submit]').length;
  const totalLinks = qsa('a[href]').length;
  const short = u.length > 80 ? u.substring(0, 80) + '...' : u;
  let r = '--- ' + short + ' | ' + t + ' ---';
  if (inputs.length) r += '\\n' + inputs.join(' ');
  if (buttons.length) r += '\\n' + buttons.join(' ');
  if (links.length) r += '\\nLinks: ' + links.join(', ');
  const counts = [];
  if (totalInputs > inputs.length) counts.push(totalInputs + ' inputs');
  if (totalButtons > buttons.length) counts.push(totalButtons + ' buttons');
  if (totalLinks > links.length) counts.push(totalLinks + ' links');
  if (counts.length) r += '\\n(' + counts.join(', ') + ' total \u2014 use dom or axtree for full list)';
  return r;
})()`;
    async function getPageBrief2(cdp) {
      try {
        const result = await cdp.send("Runtime.evaluate", {
          expression: PAGE_BRIEF_SCRIPT,
          returnByValue: true
        });
        return result.result.value || "";
      } catch {
        return "";
      }
    }
    module2.exports = {
      SELECTOR_GEN_SCRIPT: SELECTOR_GEN_SCRIPT2,
      PAGE_BRIEF_SCRIPT,
      getPageBrief: getPageBrief2
    };
  }
});

// lib/input.js
var require_input = __commonJS({
  "lib/input.js"(exports2, module2) {
    function parseCoordinates2(args) {
      if (args.length === 1 && /^\d+(\.\d+)?,\d+(\.\d+)?$/.test(args[0])) {
        const [x, y] = args[0].split(",").map(Number);
        return { x, y };
      }
      if (args.length === 2 && /^\d+(\.\d+)?$/.test(args[0]) && /^\d+(\.\d+)?$/.test(args[1])) {
        return { x: Number(args[0]), y: Number(args[1]) };
      }
      return null;
    }
    function parseKeyCombo2(combo) {
      const parts = combo.split("+");
      const modifiers = { ctrl: false, alt: false, shift: false, meta: false };
      let key = "";
      for (const part of parts) {
        const lower = part.toLowerCase();
        if (lower === "ctrl" || lower === "control") modifiers.ctrl = true;
        else if (lower === "alt" || lower === "option") modifiers.alt = true;
        else if (lower === "shift") modifiers.shift = true;
        else if (lower === "meta" || lower === "cmd" || lower === "command") modifiers.meta = true;
        else key = part;
      }
      return { modifiers, key };
    }
    async function humanMouseMove(cdp, fromX, fromY, toX, toY) {
      const distance = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
      const duration = 100 + distance / 2e3 * 200 + Math.random() * 100;
      const steps = Math.max(5, Math.min(30, Math.round(duration / 20)));
      const cp1X = fromX + (toX - fromX) * 0.25 + (Math.random() - 0.5) * 50;
      const cp1Y = fromY + (toY - fromY) * 0.25 + (Math.random() - 0.5) * 50;
      const cp2X = fromX + (toX - fromX) * 0.75 + (Math.random() - 0.5) * 50;
      const cp2Y = fromY + (toY - fromY) * 0.75 + (Math.random() - 0.5) * 50;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        const x = u * u * u * fromX + 3 * u * u * t * cp1X + 3 * u * t * t * cp2X + t * t * t * toX + (Math.random() - 0.5) * 2;
        const y = u * u * u * fromY + 3 * u * u * t * cp1Y + 3 * u * t * t * cp2Y + t * t * t * toY + (Math.random() - 0.5) * 2;
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
        await new Promise((r) => setTimeout(r, 16 + Math.random() * 8));
      }
    }
    async function humanClick2(cdp, x, y) {
      const startX = x + (Math.random() - 0.5) * 200 + 50;
      const startY = y + (Math.random() - 0.5) * 200 + 50;
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: startX, y: startY });
      await humanMouseMove(cdp, startX, startY, x, y);
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 150));
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 90));
      const releaseX = x + (Math.random() - 0.5) * 2;
      const releaseY = y + (Math.random() - 0.5) * 2;
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: releaseX, y: releaseY, button: "left", clickCount: 1 });
    }
    async function humanTypeText2(cdp, text, fast) {
      const baseDelay = fast ? 40 : 80;
      const chars = [...text];
      for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", text: char, unmodifiedText: char });
        await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", text: char, unmodifiedText: char });
        let delay = baseDelay + Math.random() * (baseDelay / 2);
        if (Math.random() < 0.05) delay += Math.random() * 500;
        if (i > 0 && chars[i - 1] === char) delay /= 2;
        if (Math.random() < 0.03 && i < chars.length - 1) {
          const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
          await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", text: wrongChar, unmodifiedText: wrongChar });
          await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", text: wrongChar, unmodifiedText: wrongChar });
          await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
          await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace", keyCode: 8, windowsVirtualKeyCode: 8 });
          await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", keyCode: 8, windowsVirtualKeyCode: 8 });
          await new Promise((r) => setTimeout(r, 30 + Math.random() * 70));
        }
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    module2.exports = {
      parseCoordinates: parseCoordinates2,
      parseKeyCombo: parseKeyCombo2,
      humanMouseMove,
      humanClick: humanClick2,
      humanTypeText: humanTypeText2
    };
  }
});

// lib/locator.js
var require_locator = __commonJS({
  "lib/locator.js"(exports2, module2) {
    async function getFrameContextId2(cdp, activeFrameId) {
      if (!activeFrameId) return void 0;
      const contexts = [];
      cdp.on("Runtime.executionContextCreated", (params) => {
        contexts.push(params.context);
      });
      await cdp.send("Runtime.enable");
      await new Promise((resolve) => setTimeout(resolve, 30));
      const ctx = contexts.find((context) => context.auxData && context.auxData.frameId === activeFrameId && context.auxData.isDefault);
      if (!ctx) {
        throw new Error(
          `Could not find execution context for frame ${activeFrameId}. Try "webact.js frames" to verify the frame still exists.`
        );
      }
      return ctx.id;
    }
    async function locateElement2(cdp, selector, contextId) {
      const evalOpts = {
        expression: `
      (async function() {
        const sel = ${JSON.stringify(selector)};
        let el;
        try {
          for (let i = 0; i < 50; i++) {
            el = document.querySelector(sel);
            if (el) break;
            await new Promise(r => setTimeout(r, 100));
          }
        } catch (e) {
          return { error: 'Invalid CSS selector: ' + sel + '. Use CSS selectors (#id, .class, tag). For text search: click --text "text"' };
        }
        if (!el) return { error: 'Element not found after 5s: ' + sel + '. Try: click --text "text" or screenshot then click x,y' };
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        await new Promise(r => setTimeout(r, 50));
        const rect = el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
                 tag: el.tagName, text: (el.textContent || '').substring(0, 50).trim() };
      })()
    `,
        returnByValue: true,
        awaitPromise: true
      };
      if (contextId !== void 0) evalOpts.contextId = contextId;
      const result = await cdp.send("Runtime.evaluate", evalOpts);
      const loc = result.result.value;
      if (loc.error) throw new Error(loc.error);
      return loc;
    }
    async function locateElementByText2(cdp, text, contextId) {
      const evalOpts = {
        expression: `
      (function() {
        const target = ${JSON.stringify(text)};
        const lower = target.toLowerCase();
        let best = null;
        let bestLen = Infinity;
        function* allElements(root) {
          for (const el of root.querySelectorAll('*')) {
            yield el;
            if (el.shadowRoot) yield* allElements(el.shadowRoot);
          }
        }
        for (const el of allElements(document)) {
          if (el.offsetParent === null && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
            const s = getComputedStyle(el);
            if (s.display === 'none' || (s.position !== 'fixed' && s.position !== 'sticky')) continue;
          }
          const t = (el.textContent || '').trim();
          if (!t) continue;
          const tl = t.toLowerCase();
          const exact = tl === lower;
          const has = tl.includes(lower);
          if (!exact && !has) continue;
          const len = t.length;
          if (exact && (!best || !best.exact || len < bestLen)) { best = { el, exact: true }; bestLen = len; }
          else if (has && !best?.exact && len < bestLen) { best = { el, exact: false }; bestLen = len; }
        }
        if (!best) return { error: 'No visible element with text: ' + target };
        const el = best.el;
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        const rect = el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
                 tag: el.tagName, text: (el.textContent || '').substring(0, 50).trim() };
      })()
    `,
        returnByValue: true
      };
      if (contextId !== void 0) evalOpts.contextId = contextId;
      const result = await cdp.send("Runtime.evaluate", evalOpts);
      const loc = result.result.value;
      if (loc.error) throw new Error(loc.error);
      return loc;
    }
    module2.exports = {
      getFrameContextId: getFrameContextId2,
      locateElement: locateElement2,
      locateElementByText: locateElementByText2
    };
  }
});

// lib/commands/ax.js
var require_ax = __commonJS({
  "lib/commands/ax.js"(exports2, module2) {
    function createAxCommands2({
      withCDP: withCDP2,
      loadSessionState: loadSessionState2,
      saveSessionState: saveSessionState2,
      loadActionCache: loadActionCache2,
      saveActionCache: saveActionCache2,
      CACHE_TTL: CACHE_TTL2,
      SELECTOR_GEN_SCRIPT: SELECTOR_GEN_SCRIPT2
    }) {
      async function resolveTextContent(cdp, entries) {
        if (entries.length === 0) return /* @__PURE__ */ new Map();
        const capped = entries.slice(0, 200);
        const results = /* @__PURE__ */ new Map();
        await Promise.all(capped.map(async ({ backendDOMNodeId, idx }) => {
          try {
            const resolved = await cdp.send("DOM.resolveNode", { backendNodeId: backendDOMNodeId });
            if (!resolved.object?.objectId) return;
            const r = await cdp.send("Runtime.callFunctionOn", {
              objectId: resolved.object.objectId,
              functionDeclaration: 'function() { var t = (this.textContent || "").trim(); if (!t) t = this.getAttribute("aria-label") || ""; return t.trim().substring(0, 80); }',
              returnByValue: true
            });
            const text = r.result?.value;
            if (text) results.set(idx, text);
          } catch {
          }
        }));
        return results;
      }
      async function fetchInteractiveElements(cdp) {
        const INTERACTIVE_ROLES = /* @__PURE__ */ new Set([
          "button",
          "link",
          "textbox",
          "searchbox",
          "combobox",
          "checkbox",
          "radio",
          "switch",
          "slider",
          "spinbutton",
          "tab",
          "menuitem",
          "menuitemcheckbox",
          "menuitemradio",
          "option",
          "listbox",
          "tree",
          "treeitem"
        ]);
        const urlResult = await cdp.send("Runtime.evaluate", {
          expression: "location.href",
          returnByValue: true
        });
        const currentUrl = urlResult.result.value;
        let cacheKey;
        try {
          const u = new URL(currentUrl);
          cacheKey = u.hostname + u.pathname;
        } catch {
          cacheKey = currentUrl;
        }
        const actionCache = loadActionCache2();
        const cached = actionCache[cacheKey];
        if (cached && Date.now() - cached.timestamp < CACHE_TTL2) {
          const refs = Object.entries(cached.refMap);
          const checkRefs = refs.slice(0, Math.min(3, refs.length));
          let valid = checkRefs.length > 0;
          for (const [, sel] of checkRefs) {
            try {
              const check = await cdp.send("Runtime.evaluate", {
                expression: `!!document.querySelector(${JSON.stringify(sel)})`,
                returnByValue: true
              });
              if (!check.result?.value) {
                valid = false;
                break;
              }
            } catch {
              valid = false;
              break;
            }
          }
          if (valid) {
            const state2 = loadSessionState2();
            state2.refMap = cached.refMap;
            state2.refMapUrl = currentUrl;
            state2.refMapTimestamp = cached.timestamp;
            saveSessionState2(state2);
            return { elements: cached.elements, refMap: cached.refMap, output: cached.output };
          }
        }
        await cdp.send("Accessibility.enable");
        const axResult = await cdp.send("Accessibility.getFullAXTree");
        const nodes = axResult.nodes;
        const nodeMap = /* @__PURE__ */ new Map();
        for (const n of nodes) nodeMap.set(n.nodeId, n);
        const interactiveNodes = [];
        function walk(node) {
          const role = node.role?.value || "";
          if (INTERACTIVE_ROLES.has(role)) interactiveNodes.push(node);
          for (const cid of node.childIds || []) {
            const child = nodeMap.get(cid);
            if (child) walk(child);
          }
        }
        if (nodes[0]) walk(nodes[0]);
        const elements = [];
        const outputLines = [];
        const namelessIndices = /* @__PURE__ */ new Set();
        for (let i = 0; i < interactiveNodes.length; i++) {
          const node = interactiveNodes[i];
          const role = node.role?.value || "";
          const name = String(node.name?.value ?? "");
          const value = String(node.value?.value ?? "");
          let line = `[${i + 1}] ${role}`;
          if (name) line += ` "${name.substring(0, 80)}"`;
          if (value) line += ` val="${value.substring(0, 40)}"`;
          const props = {};
          for (const p of node.properties || []) {
            if (p.name === "disabled" && p.value?.value) props.disabled = true;
            if (p.name === "checked") props.checked = p.value?.value;
            if (p.name === "expanded") props.expanded = p.value?.value;
            if (p.name === "selected" && p.value?.value) props.selected = true;
          }
          const propStr = Object.entries(props).map(([k, v]) => `${k}=${v}`).join(" ");
          if (propStr) line += ` [${propStr}]`;
          outputLines.push(line);
          elements.push({ role, name, value });
          if (!name) namelessIndices.add(i);
        }
        await cdp.send("Runtime.evaluate", { expression: SELECTOR_GEN_SCRIPT2 });
        await cdp.send("DOM.enable");
        const refMap = {};
        await Promise.all(interactiveNodes.map(async (node, i) => {
          try {
            if (!node.backendDOMNodeId) return;
            const resolved = await cdp.send("DOM.resolveNode", { backendNodeId: node.backendDOMNodeId });
            if (!resolved.object?.objectId) return;
            if (namelessIndices.has(i)) {
              const sResult = await cdp.send("Runtime.callFunctionOn", {
                objectId: resolved.object.objectId,
                functionDeclaration: 'function() { var s = window.__webactGenSelector(this); var t = (this.textContent || "").trim(); if (!t) t = this.getAttribute("aria-label") || ""; return { selector: s, textContent: t.trim().substring(0, 80) }; }',
                returnByValue: true
              });
              const val = sResult.result?.value;
              if (val?.selector) refMap[i + 1] = val.selector;
              if (val?.textContent) {
                elements[i].name = val.textContent;
                const rolePrefix = `[${i + 1}] ${elements[i].role}`;
                outputLines[i] = rolePrefix + ` "${val.textContent}"` + outputLines[i].substring(rolePrefix.length);
              }
            } else {
              const sResult = await cdp.send("Runtime.callFunctionOn", {
                objectId: resolved.object.objectId,
                functionDeclaration: "function() { return window.__webactGenSelector(this); }",
                returnByValue: true
              });
              if (sResult.result?.value) refMap[i + 1] = sResult.result.value;
            }
          } catch {
          }
        }));
        let output = outputLines.join("\n") + (outputLines.length ? "\n" : "");
        if (output.length > 6e3) {
          output = output.substring(0, 6e3) + "\n... (truncated)";
        }
        await cdp.send("Accessibility.disable");
        const state = loadSessionState2();
        state.prevElements = state.currentElements || null;
        state.currentElements = elements.map((el, i) => ({ ref: i + 1, ...el }));
        state.refMap = refMap;
        state.refMapUrl = currentUrl;
        state.refMapTimestamp = Date.now();
        saveSessionState2(state);
        actionCache[cacheKey] = { refMap, elements, output, timestamp: Date.now() };
        saveActionCache2(actionCache);
        return { elements, refMap, output };
      }
      function diffElements(prev, curr) {
        if (!prev) return null;
        const prevMap = new Map(prev.map((e) => [e.ref, e]));
        const currMap = new Map(curr.map((e) => [e.ref, e]));
        const added = [], removed = [], changed = [];
        for (const [ref, el] of currMap) {
          const old = prevMap.get(ref);
          if (!old) {
            added.push(el);
          } else if (old.role !== el.role || old.name !== el.name || old.value !== el.value) {
            changed.push({ ref, from: old, to: el });
          }
        }
        for (const [ref, el] of prevMap) {
          if (!currMap.has(ref)) removed.push(el);
        }
        return { added, removed, changed };
      }
      async function cmdAxtree2(selector, interactiveOnly, showDiff, maxTokens) {
        await withCDP2(async (cdp) => {
          if (interactiveOnly && !selector) {
            const data = await fetchInteractiveElements(cdp);
            if (showDiff) {
              const state = loadSessionState2();
              const diff = diffElements(state.prevElements, state.currentElements);
              if (!diff) {
                console.log("(no previous snapshot to diff against)");
                console.log(data.output || "(no interactive elements found)");
              } else if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
                console.log("(no changes since last snapshot)");
              } else {
                let out = "";
                if (diff.added.length) out += "ADDED:\n" + diff.added.map((e) => `  + [${e.ref}] ${e.role} "${e.name}"`).join("\n") + "\n";
                if (diff.removed.length) out += "REMOVED:\n" + diff.removed.map((e) => `  - [${e.ref}] ${e.role} "${e.name}"`).join("\n") + "\n";
                if (diff.changed.length) out += "CHANGED:\n" + diff.changed.map((c) => `  ~ [${c.ref}] ${c.to.role} "${c.to.name}" (was: "${c.from.name}")`).join("\n") + "\n";
                out += `(${diff.added.length} added, ${diff.removed.length} removed, ${diff.changed.length} changed)`;
                console.log(out);
              }
              return;
            }
            let output = data.output || "(no interactive elements found)";
            if (maxTokens > 0) {
              const charBudget = maxTokens * 4;
              if (output.length > charBudget) {
                output = output.substring(0, charBudget) + "\n... (truncated to ~" + maxTokens + " tokens)";
              }
            }
            console.log(output);
            return;
          }
          await cdp.send("Accessibility.enable");
          let nodes;
          if (selector) {
            const objResult = await cdp.send("Runtime.evaluate", {
              expression: `document.querySelector(${JSON.stringify(selector)})`
            });
            if (!objResult.result.objectId) {
              console.error(`Element not found: ${selector}`);
              process.exit(1);
            }
            const result = await cdp.send("Accessibility.queryAXTree", {
              objectId: objResult.result.objectId
            });
            nodes = result.nodes;
          } else {
            const result = await cdp.send("Accessibility.getFullAXTree");
            nodes = result.nodes;
          }
          const SKIP_ROLES = /* @__PURE__ */ new Set(["InlineTextBox", "LineBreak"]);
          const PASS_THROUGH_ROLES = /* @__PURE__ */ new Set(["none", "generic"]);
          const INTERACTIVE_ROLES = /* @__PURE__ */ new Set([
            "button",
            "link",
            "textbox",
            "searchbox",
            "combobox",
            "checkbox",
            "radio",
            "switch",
            "slider",
            "spinbutton",
            "tab",
            "menuitem",
            "menuitemcheckbox",
            "menuitemradio",
            "option",
            "listbox",
            "tree",
            "treeitem"
          ]);
          const nodeMap = /* @__PURE__ */ new Map();
          for (const n of nodes) nodeMap.set(n.nodeId, n);
          if (interactiveOnly) {
            let collectInteractive2 = function(node) {
              const role = node.role?.value || "";
              if (INTERACTIVE_ROLES.has(role)) {
                const name = String(node.name?.value ?? "");
                const value = String(node.value?.value ?? "");
                let line = `[${idx}] ${role}`;
                if (name) line += ` "${name.substring(0, 80)}"`;
                if (value) line += ` val="${value.substring(0, 40)}"`;
                const props = {};
                for (const p of node.properties || []) {
                  if (p.name === "disabled" && p.value?.value) props.disabled = true;
                  if (p.name === "checked") props.checked = p.value?.value;
                  if (p.name === "expanded") props.expanded = p.value?.value;
                  if (p.name === "selected" && p.value?.value) props.selected = true;
                }
                const propStr = Object.entries(props).map(([k, v]) => `${k}=${v}`).join(" ");
                if (propStr) line += ` [${propStr}]`;
                const lineIdx = outputLines.length;
                outputLines.push(line);
                if (!name && node.backendDOMNodeId) {
                  namelessEntries.push({ backendDOMNodeId: node.backendDOMNodeId, idx: lineIdx, refIdx: idx, role });
                }
                idx++;
              }
              for (const cid of node.childIds || []) {
                const child = nodeMap.get(cid);
                if (child) collectInteractive2(child);
              }
            };
            var collectInteractive = collectInteractive2;
            let idx = 1;
            const outputLines = [];
            const namelessEntries = [];
            if (nodes[0]) collectInteractive2(nodes[0]);
            if (namelessEntries.length > 0) {
              await cdp.send("DOM.enable");
              const resolved = await resolveTextContent(cdp, namelessEntries);
              for (const entry of namelessEntries) {
                const text = resolved.get(entry.idx);
                if (text) {
                  const rolePrefix = `[${entry.refIdx}] ${entry.role}`;
                  outputLines[entry.idx] = rolePrefix + ` "${text}"` + outputLines[entry.idx].substring(rolePrefix.length);
                }
              }
            }
            let output = outputLines.join("\n") + (outputLines.length ? "\n" : "");
            if (output.length > 6e3) {
              output = output.substring(0, 6e3) + "\n... (truncated)";
            }
            console.log(output || "(no interactive elements found)");
          } else {
            let formatNode2 = function(node, depth) {
              const role = node.role?.value || "";
              if (SKIP_ROLES.has(role)) return "";
              const name = String(node.name?.value ?? "");
              const value = String(node.value?.value ?? "");
              const isPassThrough = PASS_THROUGH_ROLES.has(role) && !name;
              let out = "";
              if (!isPassThrough) {
                if (role === "StaticText") {
                  const indent2 = "  ".repeat(Math.min(depth, 6));
                  if (name.length > 80) {
                    out += `${indent2}- text "${name.substring(0, 80)}..."
`;
                  }
                  return out;
                }
                const indent = "  ".repeat(Math.min(depth, 6));
                let line = `${indent}- ${role}`;
                if (name) {
                  line += ` "${name.substring(0, 80)}"`;
                } else if (RESOLVE_ROLES.has(role) && node.backendDOMNodeId) {
                  const placeholder = `__WEBACT_NL_${namelessNodes.length}__`;
                  namelessNodes.push({ backendDOMNodeId: node.backendDOMNodeId, idx: namelessNodes.length, placeholder });
                  line += ` ${placeholder}`;
                }
                if (value) line += ` value="${value.substring(0, 60)}"`;
                const props = {};
                for (const p of node.properties || []) {
                  if (p.name === "disabled" && p.value?.value) props.disabled = true;
                  if (p.name === "required" && p.value?.value) props.required = true;
                  if (p.name === "checked") props.checked = p.value?.value;
                  if (p.name === "expanded") props.expanded = p.value?.value;
                  if (p.name === "selected" && p.value?.value) props.selected = true;
                }
                const propStr = Object.entries(props).map(([k, v]) => `${k}=${v}`).join(" ");
                if (propStr) line += ` [${propStr}]`;
                out += line + "\n";
              }
              const childIds = node.childIds || [];
              for (const cid of childIds) {
                const child = nodeMap.get(cid);
                if (child) out += formatNode2(child, isPassThrough ? depth : depth + 1);
              }
              return out;
            };
            var formatNode = formatNode2;
            const RESOLVE_ROLES = /* @__PURE__ */ new Set([...INTERACTIVE_ROLES, "heading", "img", "cell", "columnheader", "rowheader"]);
            const namelessNodes = [];
            const root = nodes[0];
            let output = "";
            if (root) {
              output = formatNode2(root, 0);
            }
            if (namelessNodes.length > 0) {
              await cdp.send("DOM.enable");
              const resolved = await resolveTextContent(cdp, namelessNodes);
              for (const entry of namelessNodes) {
                const text = resolved.get(entry.idx);
                if (text) {
                  output = output.replace(entry.placeholder, `"${text}"`);
                } else {
                  output = output.replace(` ${entry.placeholder}`, "");
                }
              }
            }
            if (output.length > 6e3) {
              output = output.substring(0, 6e3) + "\n... (truncated)";
            }
            console.log(output || "(empty accessibility tree)");
          }
          await cdp.send("Accessibility.disable");
        });
      }
      async function cmdObserve2() {
        await withCDP2(async (cdp) => {
          const data = await fetchInteractiveElements(cdp);
          if (data.elements.length === 0) {
            console.log("(no interactive elements found)");
            return;
          }
          let output = "";
          for (let i = 0; i < data.elements.length; i++) {
            const el = data.elements[i];
            const ref = i + 1;
            const desc = `${el.role}${el.name ? ' "' + el.name.substring(0, 60) + '"' : ""}`;
            let cmd;
            switch (el.role) {
              case "textbox":
              case "searchbox":
                cmd = `type ${ref} <text>`;
                break;
              case "combobox":
              case "listbox":
                cmd = `select ${ref} <value>`;
                break;
              case "slider":
              case "spinbutton":
                cmd = `type ${ref} <value>`;
                break;
              default:
                cmd = `click ${ref}`;
            }
            output += `[${ref}] ${cmd}  \u2014 ${desc}
`;
          }
          console.log(output.trimEnd());
        });
      }
      async function cmdFind2(query) {
        if (!query) {
          console.error('Usage: webact find <query>\nExample: webact find "login button"');
          process.exit(1);
        }
        await withCDP2(async (cdp) => {
          const data = await fetchInteractiveElements(cdp);
          if (data.elements.length === 0) {
            console.error("No interactive elements found. Navigate to a page first.");
            process.exit(1);
          }
          const STOPWORDS = /* @__PURE__ */ new Set(["the", "a", "an", "to", "for", "of", "in", "on", "is", "it", "and", "or", "this", "that"]);
          function tokenize(str) {
            return str.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 1 && !STOPWORDS.has(t));
          }
          const queryTokens = new Set(tokenize(query));
          if (queryTokens.size === 0) {
            console.error('Query too vague. Use descriptive terms like "search input" or "submit button".');
            process.exit(1);
          }
          const scored = [];
          for (let i = 0; i < data.elements.length; i++) {
            const el = data.elements[i];
            const elText = `${el.role} ${el.name} ${el.value}`;
            const elTokens = new Set(tokenize(elText));
            if (elTokens.size === 0) continue;
            let intersection = 0;
            for (const t of queryTokens) {
              if (elTokens.has(t)) intersection++;
              else {
                for (const et of elTokens) {
                  if (et.includes(t) || t.includes(et)) {
                    intersection += 0.5;
                    break;
                  }
                }
              }
            }
            const union = (/* @__PURE__ */ new Set([...queryTokens, ...elTokens])).size;
            const score = intersection / union;
            if (score > 0) scored.push({ ref: i + 1, score, el });
          }
          scored.sort((a, b) => b.score - a.score);
          const topK = scored.slice(0, 5);
          if (topK.length === 0) {
            console.error(`No elements match "${query}". Try: axtree -i to see available elements.`);
            process.exit(1);
          }
          const best = topK[0];
          const confidence = best.score >= 0.5 ? "high" : best.score >= 0.25 ? "medium" : "low";
          console.log(`Best: [${best.ref}] ${best.el.role} "${best.el.name}" (${confidence} confidence, score:${best.score.toFixed(2)})`);
          if (topK.length > 1) {
            const others = topK.slice(1).map((m) => `  [${m.ref}] ${m.el.role} "${m.el.name}" (${m.score.toFixed(2)})`);
            console.log("Also:\n" + others.join("\n"));
          }
        });
      }
      return {
        cmdAxtree: cmdAxtree2,
        cmdObserve: cmdObserve2,
        cmdFind: cmdFind2
      };
    }
    module2.exports = createAxCommands2;
  }
});

// lib/commands/extended/cookies.js
var require_cookies = __commonJS({
  "lib/commands/extended/cookies.js"(exports2, module2) {
    function createCookieCommands({ withCDP: withCDP2 }) {
      async function cmdCookies2(action, ...args) {
        if (!action) {
          action = "get";
        }
        switch (action.toLowerCase()) {
          case "get": {
            await withCDP2(async (cdp) => {
              const result = await cdp.send("Network.getCookies");
              if (result.cookies.length === 0) {
                console.log("No cookies.");
                return;
              }
              for (const c of result.cookies) {
                const flags = [];
                if (c.httpOnly) flags.push("httpOnly");
                if (c.secure) flags.push("secure");
                if (c.session) flags.push("session");
                const exp = c.expires > 0 ? new Date(c.expires * 1e3).toISOString().split("T")[0] : "";
                console.log(`${c.name}=${c.value.substring(0, 60)}${c.value.length > 60 ? "..." : ""} (${c.domain}${exp ? " exp:" + exp : ""} ${flags.join(" ")})`);
              }
            });
            break;
          }
          case "set": {
            if (args.length < 2) {
              console.error("Usage: webact.js cookies set <name> <value> [domain]");
              process.exit(1);
            }
            const [name, value, domain] = args;
            await withCDP2(async (cdp) => {
              const cookieDomain = domain || await cdp.send("Runtime.evaluate", {
                expression: "location.hostname",
                returnByValue: true
              }).then((r) => r.result.value);
              await cdp.send("Network.setCookie", {
                name,
                value,
                domain: cookieDomain,
                path: "/"
              });
              console.log(`Cookie set: ${name}=${value.substring(0, 40)} (${cookieDomain})`);
            });
            break;
          }
          case "clear": {
            await withCDP2(async (cdp) => {
              await cdp.send("Network.clearBrowserCookies");
              console.log("All cookies cleared.");
            });
            break;
          }
          case "delete": {
            if (!args[0]) {
              console.error("Usage: webact.js cookies delete <name> [domain]");
              process.exit(1);
            }
            await withCDP2(async (cdp) => {
              const domain = args[1] || await cdp.send("Runtime.evaluate", {
                expression: "location.hostname",
                returnByValue: true
              }).then((r) => r.result.value);
              await cdp.send("Network.deleteCookies", { name: args[0], domain });
              console.log(`Deleted cookie: ${args[0]} (${domain})`);
            });
            break;
          }
          default:
            console.error("Usage: webact.js cookies [get|set|clear|delete] [args]");
            process.exit(1);
        }
      }
      return { cmdCookies: cmdCookies2 };
    }
    module2.exports = createCookieCommands;
  }
});

// lib/commands/extended/navigation.js
var require_navigation = __commonJS({
  "lib/commands/extended/navigation.js"(exports2, module2) {
    function createNavigationCommands({
      withCDP: withCDP2,
      getPageBrief: getPageBrief2,
      locateElement: locateElement2,
      fs: fs2,
      path: path2,
      TMP: TMP2,
      getCurrentSessionId
    }) {
      async function cmdBack2() {
        await withCDP2(async (cdp) => {
          const nav = await cdp.send("Page.getNavigationHistory");
          if (nav.currentIndex <= 0) {
            console.error("No previous page in history.");
            process.exit(1);
          }
          const entry = nav.entries[nav.currentIndex - 1];
          await cdp.send("Page.navigateToHistoryEntry", { entryId: entry.id });
          await new Promise((r) => setTimeout(r, 500));
          console.log(await getPageBrief2(cdp));
        });
      }
      async function cmdForward2() {
        await withCDP2(async (cdp) => {
          const nav = await cdp.send("Page.getNavigationHistory");
          if (nav.currentIndex >= nav.entries.length - 1) {
            console.error("No next page in history.");
            process.exit(1);
          }
          const entry = nav.entries[nav.currentIndex + 1];
          await cdp.send("Page.navigateToHistoryEntry", { entryId: entry.id });
          await new Promise((r) => setTimeout(r, 500));
          console.log(await getPageBrief2(cdp));
        });
      }
      async function cmdReload2() {
        await withCDP2(async (cdp) => {
          await cdp.send("Page.reload");
          const start = Date.now();
          while (Date.now() - start < 15e3) {
            await new Promise((r) => setTimeout(r, 300));
            const result = await cdp.send("Runtime.evaluate", {
              expression: "document.readyState"
            });
            if (result.result && result.result.value === "complete") break;
          }
          console.log(await getPageBrief2(cdp));
        });
      }
      async function cmdRightClick2(selector) {
        if (!selector) {
          console.error("Usage: webact.js rightclick <selector>");
          process.exit(1);
        }
        await withCDP2(async (cdp) => {
          const loc = await locateElement2(cdp, selector);
          await cdp.send("Input.dispatchMouseEvent", {
            type: "mousePressed",
            x: loc.x,
            y: loc.y,
            button: "right",
            clickCount: 1
          });
          await cdp.send("Input.dispatchMouseEvent", {
            type: "mouseReleased",
            x: loc.x,
            y: loc.y,
            button: "right",
            clickCount: 1
          });
          console.log(`Right-clicked ${loc.tag.toLowerCase()} "${loc.text}"`);
          await new Promise((r) => setTimeout(r, 150));
          console.log(await getPageBrief2(cdp));
        });
      }
      async function cmdClear2(selector) {
        if (!selector) {
          console.error("Usage: webact.js clear <selector>");
          process.exit(1);
        }
        await withCDP2(async (cdp) => {
          const result = await cdp.send("Runtime.evaluate", {
            expression: `
        (async function() {
          const sel = ${JSON.stringify(selector)};
          let el;
          for (let i = 0; i < 50; i++) {
            el = document.querySelector(sel);
            if (el) break;
            await new Promise(r => setTimeout(r, 100));
          }
          if (!el) return { error: 'Element not found after 5s: ' + sel };
          el.focus();
          if ('value' in el) {
            el.value = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (el.isContentEditable) {
            el.textContent = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
          return { tag: el.tagName };
        })()
      `,
            returnByValue: true,
            awaitPromise: true
          });
          const val = result.result.value;
          if (val.error) {
            console.error(val.error);
            process.exit(1);
          }
          console.log(`Cleared ${val.tag.toLowerCase()} ${selector}`);
        });
      }
      async function cmdPdf2(outputPath) {
        const outFile = outputPath || path2.join(TMP2, `webact-page-${getCurrentSessionId() || "default"}.pdf`);
        await withCDP2(async (cdp) => {
          const result = await cdp.send("Page.printToPDF", {
            printBackground: true,
            preferCSSPageSize: true
          });
          fs2.writeFileSync(outFile, Buffer.from(result.data, "base64"));
          console.log(`PDF saved to ${outFile}`);
        });
      }
      return {
        cmdBack: cmdBack2,
        cmdForward: cmdForward2,
        cmdReload: cmdReload2,
        cmdRightClick: cmdRightClick2,
        cmdClear: cmdClear2,
        cmdPdf: cmdPdf2
      };
    }
    module2.exports = createNavigationCommands;
  }
});

// lib/commands/extended/diagnostics.js
var require_diagnostics = __commonJS({
  "lib/commands/extended/diagnostics.js"(exports2, module2) {
    var ADBLOCK_PATTERNS = [
      "google-analytics.com",
      "googletagmanager.com",
      "googletagservices.com",
      "googlesyndication.com",
      "googleadservices.com",
      "doubleclick.net",
      "facebook.com/tr",
      "connect.facebook.net",
      "fbevents.js",
      "analytics.twitter.com",
      "ads-twitter.com",
      "segment.io",
      "segment.com",
      "mixpanel.com",
      "amplitude.com",
      "hotjar.com",
      "fullstory.com",
      "heapanalytics.com",
      "mouseflow.com",
      "crazyegg.com",
      "newrelic.com",
      "nr-data.net",
      "adnxs.com",
      "openx.net",
      "pubmatic.com",
      "rubiconproject.com",
      "amazon-adsystem.com",
      "criteo.com",
      "criteo.net",
      "taboola.com",
      "outbrain.com",
      "revcontent.com",
      "marketo.com",
      "marketo.net",
      "pardot.com",
      "cookielaw.org",
      "cookiebot.com",
      "onetrust.com",
      "trustarc.com",
      "scorecardresearch.com",
      "quantserve.com",
      "chartbeat.com",
      "optimizely.com",
      "demdex.net",
      "addthis.com",
      "sharethis.com"
    ];
    function createDiagnosticsCommands({
      withCDP: withCDP2,
      loadSessionState: loadSessionState2,
      saveSessionState: saveSessionState2,
      fs: fs2,
      path: path2,
      TMP: TMP2,
      getCurrentSessionId
    }) {
      async function cmdConsole2(action) {
        if (!action) action = "show";
        if (action === "show" || action === "errors") {
          await withCDP2(async (cdp) => {
            await cdp.send("Runtime.enable");
            const logs = [];
            let collecting = true;
            cdp.on("Runtime.consoleAPICalled", (params) => {
              if (!collecting) return;
              const type = params.type;
              if (action === "errors" && type !== "error") return;
              const text = params.args.map((a) => a.value || a.description || "").join(" ");
              logs.push(`[${type}] ${text.substring(0, 200)}`);
            });
            cdp.on("Runtime.exceptionThrown", (params) => {
              if (!collecting) return;
              const desc = params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || "Unknown error";
              logs.push(`[exception] ${desc.substring(0, 200)}`);
            });
            await new Promise((r) => setTimeout(r, 1e3));
            collecting = false;
            if (logs.length === 0) {
              console.log("No console output captured (listened for 1s).");
            } else {
              console.log(logs.join("\n"));
            }
          });
        } else if (action === "listen") {
          await withCDP2(async (cdp) => {
            await cdp.send("Runtime.enable");
            console.log("Listening for console output (Ctrl+C to stop)...");
            cdp.on("Runtime.consoleAPICalled", (params) => {
              const type = params.type;
              const text = params.args.map((a) => a.value || a.description || "").join(" ");
              console.log(`[${type}] ${text.substring(0, 500)}`);
            });
            cdp.on("Runtime.exceptionThrown", (params) => {
              const desc = params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || "Unknown error";
              console.log(`[exception] ${desc.substring(0, 500)}`);
            });
            await new Promise(() => {
            });
          });
        } else {
          console.error("Usage: webact.js console [show|errors|listen]");
          process.exit(1);
        }
      }
      async function cmdNetwork2(action, ...args) {
        if (!action) action = "capture";
        const logFile = path2.join(TMP2, `webact-network-${getCurrentSessionId() || "default"}.json`);
        switch (action) {
          case "capture": {
            const duration = parseInt(args[0], 10) || 10;
            const filter = args[1] || null;
            await withCDP2(async (cdp) => {
              await cdp.send("Network.enable");
              const requests = [];
              const startTime = Date.now();
              cdp.on("Network.requestWillBeSent", (params) => {
                if (filter && !params.request.url.includes(filter)) return;
                requests.push({
                  id: params.requestId,
                  method: params.request.method,
                  url: params.request.url,
                  type: params.type || "",
                  time: Date.now() - startTime,
                  postData: params.request.postData ? params.request.postData.substring(0, 2e3) : void 0
                });
              });
              cdp.on("Network.responseReceived", (params) => {
                const req = requests.find((r) => r.id === params.requestId);
                if (req) {
                  req.status = params.response.status;
                  req.statusText = params.response.statusText;
                  req.mimeType = params.response.mimeType;
                }
              });
              console.log(`Capturing network for ${duration}s${filter ? ` (filter: "${filter}")` : ""}...`);
              await new Promise((r) => setTimeout(r, duration * 1e3));
              for (const r of requests) {
                const status = r.status ? ` [${r.status}]` : " [pending]";
                console.log(`${r.method} ${r.url.substring(0, 150)}${status} (${r.type || "?"}) +${r.time}ms`);
                if (r.postData) console.log(`  body: ${r.postData.substring(0, 200)}`);
              }
              console.log(`
${requests.length} requests captured`);
              fs2.writeFileSync(logFile, JSON.stringify(requests, null, 2));
            });
            break;
          }
          case "show": {
            if (!fs2.existsSync(logFile)) {
              console.error('No captured requests. Run "network capture" first.');
              process.exit(1);
            }
            const requests = JSON.parse(fs2.readFileSync(logFile, "utf-8"));
            const filter = args[0] || null;
            const filtered = filter ? requests.filter((r) => r.url.includes(filter)) : requests;
            for (const r of filtered) {
              const status = r.status ? ` [${r.status}]` : " [pending]";
              console.log(`${r.method} ${r.url.substring(0, 150)}${status} (${r.type || "?"}) +${r.time}ms`);
              if (r.postData) console.log(`  body: ${r.postData.substring(0, 200)}`);
            }
            console.log(`
${filtered.length} requests${filter ? ` matching "${filter}"` : ""}`);
            break;
          }
          default:
            console.error("Usage: webact network [capture [seconds] [filter]|show [filter]]");
            process.exit(1);
        }
      }
      async function cmdBlock2(...patterns) {
        if (patterns.length === 0) {
          console.error('Usage: webact.js block <pattern> [pattern2...]\nPatterns: images, css, fonts, media, scripts, or URL substring\nUse "block off" to disable blocking.');
          process.exit(1);
        }
        const state = loadSessionState2();
        if (patterns[0] === "off") {
          delete state.blockPatterns;
          saveSessionState2(state);
          console.log("Request blocking disabled.");
          return;
        }
        if (patterns.includes("--ads") || patterns.includes("ads")) {
          const otherPatterns = patterns.filter((p) => p !== "--ads" && p !== "ads");
          const RESOURCE_TYPES2 = { "images": "Image", "css": "Stylesheet", "fonts": "Font", "media": "Media", "scripts": "Script" };
          const allUrlPatterns = [...ADBLOCK_PATTERNS];
          const resourceTypes2 = [];
          for (const p of otherPatterns) {
            if (RESOURCE_TYPES2[p.toLowerCase()]) {
              resourceTypes2.push(RESOURCE_TYPES2[p.toLowerCase()]);
            } else {
              allUrlPatterns.push(p);
            }
          }
          state.blockPatterns = { resourceTypes: resourceTypes2, urlPatterns: allUrlPatterns };
          saveSessionState2(state);
          console.log(`Blocking: ads/trackers (${ADBLOCK_PATTERNS.length} patterns)${otherPatterns.length ? " + " + otherPatterns.join(", ") : ""}. Takes effect on next page load.`);
          return;
        }
        const RESOURCE_TYPES = {
          "images": "Image",
          "css": "Stylesheet",
          "fonts": "Font",
          "media": "Media",
          "scripts": "Script"
        };
        const resourceTypes = [];
        const urlPatterns = [];
        for (const p of patterns) {
          if (RESOURCE_TYPES[p.toLowerCase()]) {
            resourceTypes.push(RESOURCE_TYPES[p.toLowerCase()]);
          } else {
            urlPatterns.push(p);
          }
        }
        state.blockPatterns = { resourceTypes, urlPatterns };
        saveSessionState2(state);
        console.log(`Blocking: ${patterns.join(", ")}. Takes effect on next page load.`);
      }
      return {
        cmdConsole: cmdConsole2,
        cmdNetwork: cmdNetwork2,
        cmdBlock: cmdBlock2
      };
    }
    module2.exports = createDiagnosticsCommands;
  }
});

// lib/commands/extended/frames.js
var require_frames = __commonJS({
  "lib/commands/extended/frames.js"(exports2, module2) {
    function createFrameCommands({
      withCDP: withCDP2,
      loadSessionState: loadSessionState2,
      saveSessionState: saveSessionState2
    }) {
      async function cmdViewport2(width, height) {
        if (!width) {
          console.error("Usage: webact.js viewport <width> <height>\nPresets: mobile (375x667), tablet (768x1024), desktop (1280x800)");
          process.exit(1);
        }
        const presets = {
          "mobile": { w: 375, h: 667, dpr: 2, mobile: true },
          "iphone": { w: 390, h: 844, dpr: 3, mobile: true },
          "ipad": { w: 820, h: 1180, dpr: 2, mobile: true },
          "tablet": { w: 768, h: 1024, dpr: 2, mobile: true },
          "desktop": { w: 1280, h: 800, dpr: 1, mobile: false }
        };
        let w, h, dpr = 1, mobile = false;
        const preset = presets[width.toLowerCase()];
        if (preset) {
          w = preset.w;
          h = preset.h;
          dpr = preset.dpr;
          mobile = preset.mobile;
        } else {
          w = parseInt(width, 10);
          h = parseInt(height, 10) || Math.round(w * 0.625);
          if (isNaN(w)) {
            console.error("Invalid width. Use a number or preset: mobile, tablet, desktop");
            process.exit(1);
          }
        }
        await withCDP2(async (cdp) => {
          await cdp.send("Emulation.setDeviceMetricsOverride", {
            width: w,
            height: h,
            deviceScaleFactor: dpr,
            mobile
          });
          console.log(`Viewport set to ${w}x${h} (dpr:${dpr}${mobile ? " mobile" : ""})`);
        });
      }
      async function cmdFrames2() {
        await withCDP2(async (cdp) => {
          const tree = await cdp.send("Page.getFrameTree");
          function printFrame(frame, depth) {
            const indent = "  ".repeat(depth);
            const name = frame.frame.name ? ` name="${frame.frame.name}"` : "";
            const id = frame.frame.id;
            console.log(`${indent}[${id}]${name} ${frame.frame.url}`);
            for (const child of frame.childFrames || []) {
              printFrame(child, depth + 1);
            }
          }
          await cdp.send("Page.enable");
          printFrame(tree.frameTree, 0);
        });
      }
      async function cmdFrame2(frameIdOrSelector) {
        if (!frameIdOrSelector) {
          console.error('Usage: webact.js frame <frameId|selector>\nUse "webact.js frames" to list available frames.\nUse "webact.js frame main" to return to main frame.');
          process.exit(1);
        }
        const state = loadSessionState2();
        if (frameIdOrSelector === "main" || frameIdOrSelector === "top") {
          delete state.activeFrameId;
          saveSessionState2(state);
          console.log("Switched to main frame.");
          return;
        }
        await withCDP2(async (cdp) => {
          await cdp.send("Page.enable");
          const tree = await cdp.send("Page.getFrameTree");
          function findFrame(node) {
            if (node.frame.id === frameIdOrSelector || node.frame.name === frameIdOrSelector) {
              return node.frame;
            }
            for (const child of node.childFrames || []) {
              const found = findFrame(child);
              if (found) return found;
            }
            return null;
          }
          let frame = findFrame(tree.frameTree);
          if (!frame) {
            const result = await cdp.send("Runtime.evaluate", {
              expression: `
          (function() {
            const el = document.querySelector(${JSON.stringify(frameIdOrSelector)});
            if (!el || (el.tagName !== 'IFRAME' && el.tagName !== 'FRAME')) return null;
            return { name: el.getAttribute('name') || null, id: el.id || null, src: el.src || null };
          })()
        `,
              returnByValue: true
            });
            const info = result.result.value;
            if (info) {
              if (info.name || info.id) {
                let findFrameByNameOrId2 = function(node) {
                  if (node.frame.id === nameOrId || node.frame.name === nameOrId) return node.frame;
                  for (const child of node.childFrames || []) {
                    const found = findFrameByNameOrId2(child);
                    if (found) return found;
                  }
                  return null;
                };
                var findFrameByNameOrId = findFrameByNameOrId2;
                const nameOrId = info.name || info.id;
                frame = findFrameByNameOrId2(tree.frameTree);
              }
              if (!frame && info.src) {
                let findFrameByUrl2 = function(node, url) {
                  if (node.frame.url === url) return node.frame;
                  for (const child of node.childFrames || []) {
                    const found = findFrameByUrl2(child, url);
                    if (found) return found;
                  }
                  return null;
                };
                var findFrameByUrl = findFrameByUrl2;
                frame = findFrameByUrl2(tree.frameTree, info.src);
              }
            }
          }
          if (!frame) {
            console.error(`Frame not found: ${frameIdOrSelector}`);
            process.exit(1);
          }
          state.activeFrameId = frame.id;
          saveSessionState2(state);
          console.log(`Switched to frame: [${frame.id}] ${frame.url}`);
        });
      }
      return {
        cmdViewport: cmdViewport2,
        cmdFrames: cmdFrames2,
        cmdFrame: cmdFrame2
      };
    }
    module2.exports = createFrameCommands;
  }
});

// lib/commands/extended/session.js
var require_session = __commonJS({
  "lib/commands/extended/session.js"(exports2, module2) {
    function createSessionCommands({
      withCDP: withCDP2,
      loadSessionState: loadSessionState2,
      saveSessionState: saveSessionState2,
      checkTabLock: checkTabLock2,
      loadTabLocks: loadTabLocks2,
      saveTabLocks: saveTabLocks2,
      findBrowser: findBrowser2,
      activateBrowser: activateBrowser2,
      minimizeBrowser: minimizeBrowser2,
      fs: fs2,
      path: path2,
      TMP: TMP2,
      getCurrentSessionId
    }) {
      async function cmdDownload2(action, ...args) {
        if (!action) action = "path";
        const state = loadSessionState2();
        const downloadDir = state.downloadDir || path2.join(TMP2, "webact-downloads");
        switch (action.toLowerCase()) {
          case "path": {
            const dir = args[0] || downloadDir;
            if (!fs2.existsSync(dir)) {
              fs2.mkdirSync(dir, { recursive: true });
            }
            state.downloadDir = dir;
            saveSessionState2(state);
            await withCDP2(async (cdp) => {
              await cdp.send("Browser.setDownloadBehavior", {
                behavior: "allow",
                downloadPath: dir
              });
            });
            console.log(`Downloads will be saved to: ${dir}`);
            break;
          }
          case "list": {
            if (!fs2.existsSync(downloadDir)) {
              console.log("No downloads directory.");
              return;
            }
            const files = fs2.readdirSync(downloadDir);
            if (files.length === 0) {
              console.log("No downloaded files.");
            } else {
              for (const f of files) {
                const stat = fs2.statSync(path2.join(downloadDir, f));
                const size = stat.size > 1048576 ? `${(stat.size / 1048576).toFixed(1)}MB` : stat.size > 1024 ? `${(stat.size / 1024).toFixed(0)}KB` : `${stat.size}B`;
                console.log(`${f} (${size})`);
              }
            }
            break;
          }
          default:
            console.error("Usage: webact.js download [path <dir>|list]");
            process.exit(1);
        }
      }
      async function cmdActivate2() {
        const state = loadSessionState2();
        const browserName = state.browserName || findBrowser2()?.name;
        if (!browserName) {
          console.error("Cannot determine browser.");
          return;
        }
        activateBrowser2(browserName);
        console.log(`Brought ${browserName} to front.`);
      }
      async function cmdMinimize2() {
        const state = loadSessionState2();
        const browserName = state.browserName || findBrowser2()?.name;
        if (!browserName) {
          console.error("Cannot determine browser.");
          return;
        }
        minimizeBrowser2(browserName);
        console.log(`Minimized ${browserName}.`);
      }
      async function cmdLock2(ttlSeconds) {
        const ttl = parseInt(ttlSeconds, 10) || 300;
        const state = loadSessionState2();
        if (!state.activeTabId) {
          console.error("No active tab");
          process.exit(1);
        }
        const lock = checkTabLock2(state.activeTabId);
        if (lock && lock.sessionId !== getCurrentSessionId()) {
          console.error(`Tab already locked by session ${lock.sessionId} (expires in ${Math.round((lock.expires - Date.now()) / 1e3)}s)`);
          process.exit(1);
        }
        const locks = loadTabLocks2();
        locks[state.activeTabId] = {
          sessionId: getCurrentSessionId(),
          expires: Date.now() + ttl * 1e3
        };
        saveTabLocks2(locks);
        console.log(`Tab ${state.activeTabId} locked for ${ttl}s by session ${getCurrentSessionId()}`);
      }
      async function cmdUnlock2() {
        const state = loadSessionState2();
        if (!state.activeTabId) {
          console.error("No active tab");
          process.exit(1);
        }
        const locks = loadTabLocks2();
        const lock = locks[state.activeTabId];
        if (!lock) {
          console.log("Tab is not locked.");
          return;
        }
        if (lock.sessionId !== getCurrentSessionId()) {
          console.error(`Tab is locked by session ${lock.sessionId}, not yours.`);
          process.exit(1);
        }
        delete locks[state.activeTabId];
        saveTabLocks2(locks);
        console.log(`Tab ${state.activeTabId} unlocked.`);
      }
      return {
        cmdDownload: cmdDownload2,
        cmdActivate: cmdActivate2,
        cmdMinimize: cmdMinimize2,
        cmdLock: cmdLock2,
        cmdUnlock: cmdUnlock2
      };
    }
    module2.exports = createSessionCommands;
  }
});

// lib/commands/extended.js
var require_extended = __commonJS({
  "lib/commands/extended.js"(exports2, module2) {
    var createCookieCommands = require_cookies();
    var createNavigationCommands = require_navigation();
    var createDiagnosticsCommands = require_diagnostics();
    var createFrameCommands = require_frames();
    var createSessionCommands = require_session();
    function createExtendedCommands2(deps) {
      return {
        ...createCookieCommands(deps),
        ...createNavigationCommands(deps),
        ...createDiagnosticsCommands(deps),
        ...createFrameCommands(deps),
        ...createSessionCommands(deps)
      };
    }
    module2.exports = createExtendedCommands2;
  }
});

// lib/commands/base.js
var require_base = __commonJS({
  "lib/commands/base.js"(exports2, module2) {
    function createBaseCommands2({
      withCDP: withCDP2,
      getFrameContextId: getFrameContextId2,
      loadSessionState: loadSessionState2,
      saveSessionState: saveSessionState2,
      getPageBrief: getPageBrief2,
      getCurrentSessionId,
      getDebugTabs: getDebugTabs2,
      createNewTab: createNewTab2,
      httpPut: httpPut2,
      getCDPHost,
      getCDPPort,
      fs: fs2,
      path: path2,
      TMP: TMP2
    }) {
      async function cmdNavigate2(url) {
        if (!url) {
          console.error("Usage: webact.js navigate <url>");
          process.exit(1);
        }
        if (!url.startsWith("http")) url = "https://" + url;
        const state = loadSessionState2();
        if (state.refMap) {
          delete state.refMap;
          delete state.refMapUrl;
          delete state.refMapTimestamp;
          saveSessionState2(state);
        }
        await withCDP2(async (cdp) => {
          await cdp.send("Page.enable");
          await cdp.send("Page.navigate", { url });
          const start = Date.now();
          while (Date.now() - start < 15e3) {
            await new Promise((r) => setTimeout(r, 300));
            const result = await cdp.send("Runtime.evaluate", {
              expression: "document.readyState"
            });
            if (result.result && result.result.value === "complete") break;
          }
          console.log(await getPageBrief2(cdp));
        });
      }
      async function cmdDom2(selector, maxTokens) {
        const extractScript = `
    (function() {
      const SKIP_TAGS = new Set(['SCRIPT','STYLE','SVG','NOSCRIPT','LINK','META','HEAD']);
      const INTERACTIVE = new Set(['A','BUTTON','INPUT','TEXTAREA','SELECT','DETAILS','SUMMARY']);
      const KEEP_ATTRS = ['id','class','href','placeholder','aria-label','type','name','value','role','title','alt','for','action','data-testid'];
      function isVisible(el) {
        if (el.offsetParent === null && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          if (style.position !== 'fixed' && style.position !== 'sticky') return false;
        }
        return true;
      }

      function extract(node, depth) {
        if (!node) return '';
        if (node.nodeType === 3) {
          const text = node.textContent.replace(/\\s+/g, ' ').trim();
          return text ? text + ' ' : '';
        }
        if (node.nodeType !== 1) return '';
        const tag = node.tagName;
        if (SKIP_TAGS.has(tag)) return '';
        if (!isVisible(node)) return '';

        let out = '';
        const isInteractive = INTERACTIVE.has(tag);
        const attrs = [];
        for (const a of KEEP_ATTRS) {
          const v = node.getAttribute(a);
          if (v) attrs.push(a + '="' + v.substring(0, 80) + '"');
        }

        const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
        const indent = '  '.repeat(Math.min(depth, 6));

        // Only show tags that are interactive or structural
        const showTag = isInteractive || ['FORM','NAV','MAIN','HEADER','FOOTER','SECTION','ARTICLE','H1','H2','H3','H4','H5','H6','TABLE','TR','TD','TH','UL','OL','LI','LABEL','IMG','IFRAME'].includes(tag);

        if (showTag) {
          out += indent + '<' + tag.toLowerCase() + attrStr + '>';
        }

        let childOut = '';
        for (const child of node.childNodes) {
          childOut += extract(child, depth + (showTag ? 1 : 0));
        }
        if (node.shadowRoot) {
          for (const child of node.shadowRoot.childNodes) {
            childOut += extract(child, depth + (showTag ? 1 : 0));
          }
        }
        out += childOut;

        if (showTag && childOut.includes('\\n')) {
          out += indent + '</' + tag.toLowerCase() + '>\\n';
        } else if (showTag) {
          out += '</' + tag.toLowerCase() + '>\\n';
        }

        return out;
      }

      const root = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : "document.body"};
      if (!root) return 'ERROR: Element not found' + (${selector ? `' for selector: ' + ${JSON.stringify(selector)}` : "''"});
      return extract(root, 0);
    })()
  `;
        await withCDP2(async (cdp) => {
          const contextId = await getFrameContextId2(cdp);
          const evalOpts = { expression: extractScript, returnByValue: true };
          if (contextId !== void 0) evalOpts.contextId = contextId;
          const result = await cdp.send("Runtime.evaluate", evalOpts);
          if (result.exceptionDetails) {
            console.error("DOM extraction error:", result.exceptionDetails.text);
            process.exit(1);
          }
          let output = result.result.value;
          if (maxTokens > 0) {
            const charBudget = maxTokens * 4;
            if (output.length > charBudget) {
              output = output.substring(0, charBudget) + "\n... (truncated to ~" + maxTokens + " tokens)";
            }
          }
          console.log(output);
        });
      }
      async function cmdScreenshot2() {
        await withCDP2(async (cdp) => {
          const result = await cdp.send("Page.captureScreenshot", { format: "png" });
          const outPath = path2.join(TMP2, `webact-screenshot-${getCurrentSessionId() || "default"}.png`);
          fs2.writeFileSync(outPath, Buffer.from(result.data, "base64"));
          console.log(`Screenshot saved to ${outPath}`);
        });
      }
      async function cmdTabs2() {
        const allTabs = await getDebugTabs2();
        const state = loadSessionState2();
        const ownedIds = new Set(state.tabs || []);
        const owned = allTabs.filter((t) => ownedIds.has(t.id));
        if (owned.length === 0) {
          console.log("No tabs owned by this session.");
          return;
        }
        for (const t of owned) {
          const active = t.id === state.activeTabId ? " *" : "";
          console.log(`[${t.id}] ${t.title || "(untitled)"} - ${t.url}${active}`);
        }
      }
      async function cmdTab2(id) {
        if (!id) {
          console.error("Usage: webact.js tab <id>");
          process.exit(1);
        }
        const state = loadSessionState2();
        if (!(state.tabs || []).includes(id)) {
          console.error(`Tab ${id} is not owned by this session.`);
          process.exit(1);
        }
        const allTabs = await getDebugTabs2();
        const tab = allTabs.find((t) => t.id === id);
        if (!tab) {
          console.error(`Tab ${id} not found in Chrome`);
          process.exit(1);
        }
        state.activeTabId = id;
        saveSessionState2(state);
        await httpPut2(`http://${getCDPHost()}:${getCDPPort()}/json/activate/${id}`);
        console.log(`Switched to tab: ${tab.title || tab.url}`);
      }
      async function cmdNewTab2(url) {
        const newTab = await createNewTab2(url);
        const state = loadSessionState2();
        state.tabs.push(newTab.id);
        state.activeTabId = newTab.id;
        saveSessionState2(state);
        console.log(`New tab: [${newTab.id}] ${newTab.url}`);
      }
      async function cmdClose2() {
        const state = loadSessionState2();
        if (!state.activeTabId) {
          console.error("No active tab");
          process.exit(1);
        }
        const tabId = state.activeTabId;
        await httpPut2(`http://${getCDPHost()}:${getCDPPort()}/json/close/${tabId}`);
        state.tabs = (state.tabs || []).filter((id) => id !== tabId);
        state.activeTabId = state.tabs.length > 0 ? state.tabs[state.tabs.length - 1] : null;
        saveSessionState2(state);
        console.log(`Closed tab ${tabId}`);
        if (state.activeTabId) {
          console.log(`Active tab is now: ${state.activeTabId}`);
        } else {
          console.log("No tabs remaining in this session.");
        }
      }
      return {
        cmdNavigate: cmdNavigate2,
        cmdDom: cmdDom2,
        cmdScreenshot: cmdScreenshot2,
        cmdTabs: cmdTabs2,
        cmdTab: cmdTab2,
        cmdNewTab: cmdNewTab2,
        cmdClose: cmdClose2
      };
    }
    module2.exports = createBaseCommands2;
  }
});

// lib/commands/interactions.js
var require_interactions = __commonJS({
  "lib/commands/interactions.js"(exports2, module2) {
    function createInteractionCommands2({
      withCDP: withCDP2,
      locateElement: locateElement2,
      locateElementByText: locateElementByText2,
      getFrameContextId: getFrameContextId2,
      getPageBrief: getPageBrief2,
      parseKeyCombo: parseKeyCombo2,
      humanClick: humanClick2,
      humanTypeText: humanTypeText2,
      loadSessionState: loadSessionState2,
      saveSessionState: saveSessionState2,
      fs: fs2,
      path: path2
    }) {
      async function cmdHumanClick2(selector) {
        if (!selector) {
          console.error("Usage: webact humanclick <selector>");
          process.exit(1);
        }
        await withCDP2(async (cdp) => {
          const loc = await locateElement2(cdp, selector);
          await humanClick2(cdp, loc.x, loc.y);
          console.log(`Human-clicked ${loc.tag.toLowerCase()} "${loc.text}"`);
          await new Promise((r) => setTimeout(r, 150));
          console.log(await getPageBrief2(cdp));
        });
      }
      async function cmdHumanType2(selector, text) {
        if (!selector || !text) {
          console.error("Usage: webact humantype <selector> <text>");
          process.exit(1);
        }
        await withCDP2(async (cdp) => {
          await cdp.send("Runtime.evaluate", {
            expression: `(function() { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Element not found'); el.focus(); if (el.select) el.select(); })()`
          });
          await humanTypeText2(cdp, text);
          console.log(`Human-typed "${text.substring(0, 50)}${text.length > 50 ? "..." : ""}" into ${selector}`);
        });
      }
      async function cmdClick2(selector) {
        if (!selector) {
          console.error("Usage: webact.js click <selector>");
          process.exit(1);
        }
        await withCDP2(async (cdp) => {
          const loc = await locateElement2(cdp, selector);
          await cdp.send("Input.dispatchMouseEvent", {
            type: "mouseMoved",
            x: loc.x,
            y: loc.y
          });
          await new Promise((r) => setTimeout(r, 80));
          await cdp.send("Input.dispatchMouseEvent", {
            type: "mousePressed",
            x: loc.x,
            y: loc.y,
            button: "left",
            clickCount: 1
          });
          await cdp.send("Input.dispatchMouseEvent", {
            type: "mouseReleased",
            x: loc.x,
            y: loc.y,
            button: "left",
            clickCount: 1
          });
          console.log(`Clicked ${loc.tag.toLowerCase()} "${loc.text}"`);
          await new Promise((r) => setTimeout(r, 150));
          console.log(await getPageBrief2(cdp));
        });
      }
      async function cmdDoubleClick2(selector) {
        if (!selector) {
          console.error("Usage: webact.js doubleclick <selector>");
          process.exit(1);
        }
        await withCDP2(async (cdp) => {
          const loc = await locateElement2(cdp, selector);
          await cdp.send("Input.dispatchMouseEvent", {
            type: "mousePressed",
            x: loc.x,
            y: loc.y,
            button: "left",
            clickCount: 1
          });
          await cdp.send("Input.dispatchMouseEvent", {
            type: "mouseReleased",
            x: loc.x,
            y: loc.y,
            button: "left",
            clickCount: 1
          });
          await cdp.send("Input.dispatchMouseEvent", {
            type: "mousePressed",
            x: loc.x,
            y: loc.y,
            button: "left",
            clickCount: 2
          });
          await cdp.send("Input.dispatchMouseEvent", {
            type: "mouseReleased",
            x: loc.x,
            y: loc.y,
            button: "left",
            clickCount: 2
          });
          console.log(`Double-clicked ${loc.tag.toLowerCase()} "${loc.text}"`);
          await new Promise((r) => setTimeout(r, 150));
          console.log(await getPageBrief2(cdp));
        });
      }
      async function cmdHover2(selector) {
        if (!selector) {
          console.error("Usage: webact.js hover <selector>");
          process.exit(1);
        }
        await withCDP2(async (cdp) => {
          const loc = await locateElement2(cdp, selector);
          await cdp.send("Input.dispatchMouseEvent", {
            type: "mouseMoved",
            x: loc.x,
            y: loc.y
          });
          console.log(`Hovered ${loc.tag.toLowerCase()} "${loc.text}"`);
          await new Promise((r) => setTimeout(r, 150));
          console.log(await getPageBrief2(cdp));
        });
      }
      async function cmdFocus2(selector) {
        if (!selector) {
          console.error("Usage: webact.js focus <selector>");
          process.exit(1);
        }
        await withCDP2(async (cdp) => {
          const result = await cdp.send("Runtime.evaluate", {
            expression: `
        (async function() {
          const sel = ${JSON.stringify(selector)};
          let el;
          for (let i = 0; i < 50; i++) {
            el = document.querySelector(sel);
            if (el) break;
            await new Promise(r => setTimeout(r, 100));
          }
          if (!el) return { error: 'Element not found after 5s: ' + sel };
          el.focus();
          return { tag: el.tagName, text: (el.textContent || '').substring(0, 50).trim() };
        })()
      `,
            returnByValue: true,
            awaitPromise: true
          });
          const val = result.result.value;
          if (val.error) {
            console.error(val.error);
            process.exit(1);
          }
          console.log(`Focused <${val.tag.toLowerCase()}> "${val.text}"`);
        });
      }
      async function cmdSelect2(selector, ...values) {
        if (!selector || values.length === 0) {
          console.error("Usage: webact.js select <selector> <value> [value2...]");
          process.exit(1);
        }
        await withCDP2(async (cdp) => {
          const result = await cdp.send("Runtime.evaluate", {
            expression: `
        (async function() {
          const sel = ${JSON.stringify(selector)};
          const vals = ${JSON.stringify(values)};
          let el;
          for (let i = 0; i < 50; i++) {
            el = document.querySelector(sel);
            if (el) break;
            await new Promise(r => setTimeout(r, 100));
          }
          if (!el) return { error: 'Element not found after 5s: ' + sel };
          if (el.tagName !== 'SELECT') return { error: 'Element is not a <select>: ' + sel };
          const matched = [];
          for (const opt of el.options) {
            const match = vals.some(v => opt.value === v || opt.textContent.trim() === v || opt.label === v);
            opt.selected = match;
            if (match) matched.push(opt.textContent.trim() || opt.value);
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          if (matched.length === 0) return { error: 'No options matched: ' + vals.join(', ') };
          return { selected: matched };
        })()
      `,
            returnByValue: true,
            awaitPromise: true
          });
          const val = result.result.value;
          if (val.error) {
            console.error(val.error);
            process.exit(1);
          }
          console.log(`Selected: ${val.selected.join(", ")}`);
          console.log(await getPageBrief2(cdp));
        });
      }
      async function cmdUpload2(selector, ...filePaths) {
        if (!selector || filePaths.length === 0) {
          console.error("Usage: webact.js upload <selector> <file> [file2...]");
          process.exit(1);
        }
        const resolved = filePaths.map((f) => path2.resolve(f));
        for (const f of resolved) {
          if (!fs2.existsSync(f)) {
            console.error(`File not found: ${f}`);
            process.exit(1);
          }
        }
        await withCDP2(async (cdp) => {
          await cdp.send("DOM.enable");
          const doc = await cdp.send("DOM.getDocument");
          const node = await cdp.send("DOM.querySelector", {
            nodeId: doc.root.nodeId,
            selector
          });
          if (!node.nodeId) {
            console.error(`Element not found: ${selector}`);
            process.exit(1);
          }
          await cdp.send("DOM.setFileInputFiles", {
            nodeId: node.nodeId,
            files: resolved
          });
          console.log(`Uploaded ${resolved.length} file(s) to ${selector}: ${resolved.map((f) => path2.basename(f)).join(", ")}`);
        });
      }
      async function cmdDrag2(fromSelector, toSelector) {
        if (!fromSelector || !toSelector) {
          console.error("Usage: webact.js drag <from-selector> <to-selector>");
          process.exit(1);
        }
        await withCDP2(async (cdp) => {
          const from = await locateElement2(cdp, fromSelector);
          const to = await locateElement2(cdp, toSelector);
          await cdp.send("Input.dispatchMouseEvent", {
            type: "mouseMoved",
            x: from.x,
            y: from.y
          });
          await cdp.send("Input.dispatchMouseEvent", {
            type: "mousePressed",
            x: from.x,
            y: from.y,
            button: "left",
            clickCount: 1
          });
          const steps = 5;
          for (let i = 1; i <= steps; i++) {
            const x = from.x + (to.x - from.x) * (i / steps);
            const y = from.y + (to.y - from.y) * (i / steps);
            await cdp.send("Input.dispatchMouseEvent", {
              type: "mouseMoved",
              x,
              y
            });
          }
          await cdp.send("Input.dispatchMouseEvent", {
            type: "mouseReleased",
            x: to.x,
            y: to.y,
            button: "left",
            clickCount: 1
          });
          console.log(`Dragged ${from.tag.toLowerCase()} to ${to.tag.toLowerCase()}`);
          console.log(await getPageBrief2(cdp));
        });
      }
      async function cmdType2(selector, text) {
        if (!selector || !text) {
          console.error("Usage: webact.js type <selector> <text>");
          process.exit(1);
        }
        await withCDP2(async (cdp) => {
          await cdp.send("Runtime.evaluate", {
            expression: `
        (function() {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) throw new Error('Element not found: ${selector}');
          el.focus();
          if (el.select) el.select();
        })()
      `
          });
          for (const char of text) {
            await cdp.send("Input.dispatchKeyEvent", {
              type: "keyDown",
              text: char,
              unmodifiedText: char
            });
            await cdp.send("Input.dispatchKeyEvent", {
              type: "keyUp",
              text: char,
              unmodifiedText: char
            });
          }
          console.log(`Typed "${text.substring(0, 50)}${text.length > 50 ? "..." : ""}" into ${selector}`);
        });
      }
      async function cmdKeyboard2(text) {
        if (!text) {
          console.error("Usage: webact.js keyboard <text>");
          process.exit(1);
        }
        await withCDP2(async (cdp) => {
          for (const char of text) {
            await cdp.send("Input.dispatchKeyEvent", {
              type: "keyDown",
              text: char,
              unmodifiedText: char
            });
            await cdp.send("Input.dispatchKeyEvent", {
              type: "keyUp",
              text: char,
              unmodifiedText: char
            });
          }
          console.log(`OK keyboard "${text.substring(0, 50)}${text.length > 50 ? "..." : ""}"`);
        });
      }
      async function cmdPaste2(text) {
        if (!text) {
          console.error("Usage: webact.js paste <text>");
          process.exit(1);
        }
        await withCDP2(async (cdp) => {
          const result = await cdp.send("Runtime.evaluate", {
            expression: `
        (function() {
          const el = document.activeElement;
          if (!el) return { error: 'No active element to paste into' };
          const dt = new DataTransfer();
          dt.setData('text/plain', ${JSON.stringify(text)});
          const evt = new ClipboardEvent('paste', {
            clipboardData: dt,
            bubbles: true,
            cancelable: true,
          });
          el.dispatchEvent(evt);
          return { ok: true };
        })()
      `,
            returnByValue: true
          });
          const val = result.result.value;
          if (val && val.error) {
            console.error(val.error);
            process.exit(1);
          }
          console.log(`OK pasted "${text.substring(0, 50)}${text.length > 50 ? "..." : ""}"`);
        });
      }
      async function cmdWaitFor2(selector, timeoutMs) {
        if (!selector) {
          console.error("Usage: webact.js waitfor <selector> [timeout_ms]");
          process.exit(1);
        }
        const timeout = parseInt(timeoutMs, 10) || 5e3;
        await withCDP2(async (cdp) => {
          const result = await cdp.send("Runtime.evaluate", {
            expression: `
        (async function() {
          const sel = ${JSON.stringify(selector)};
          const deadline = Date.now() + ${timeout};
          while (Date.now() < deadline) {
            const el = document.querySelector(sel);
            if (el) {
              const text = (el.textContent || '').substring(0, 200).trim();
              const tag = el.tagName.toLowerCase();
              return { found: true, tag, text };
            }
            await new Promise(r => setTimeout(r, 100));
          }
          return { found: false };
        })()
      `,
            returnByValue: true,
            awaitPromise: true
          });
          const val = result.result.value;
          if (!val.found) {
            console.error(`Element not found after ${timeout}ms: ${selector}`);
            process.exit(1);
          }
          console.log(`Found ${val.tag} "${val.text}"`);
          console.log(await getPageBrief2(cdp));
        });
      }
      async function cmdDialog2(action, promptText) {
        const validActions = ["accept", "dismiss"];
        if (!action || !validActions.includes(action.toLowerCase())) {
          console.error("Usage: webact.js dialog <accept|dismiss> [prompt-text]");
          console.error("Sets up auto-handling for the next dialog. Run BEFORE the action that triggers it.");
          process.exit(1);
        }
        const accept = action.toLowerCase() === "accept";
        const state = loadSessionState2();
        state.dialogHandler = { accept, promptText: promptText || "" };
        saveSessionState2(state);
        console.log(`Dialog handler set: will ${accept ? "accept" : "dismiss"} the next dialog${promptText ? ` with text: "${promptText}"` : ""}`);
      }
      async function cmdWaitForNavigation2(timeoutMs) {
        const timeout = parseInt(timeoutMs, 10) || 1e4;
        await withCDP2(async (cdp) => {
          await cdp.send("Page.enable");
          const result = await cdp.send("Runtime.evaluate", {
            expression: `
        (async function() {
          const deadline = Date.now() + ${timeout};
          // Wait for readyState to be complete
          while (Date.now() < deadline) {
            if (document.readyState === 'complete') {
              return { ready: true, url: location.href, title: document.title };
            }
            await new Promise(r => setTimeout(r, 100));
          }
          return { ready: false, url: location.href, readyState: document.readyState };
        })()
      `,
            returnByValue: true,
            awaitPromise: true
          });
          const val = result.result.value;
          if (!val.ready) {
            console.error(`Page not ready after ${timeout}ms (readyState: ${val.readyState})`);
            process.exit(1);
          }
          console.log(await getPageBrief2(cdp));
        });
      }
      async function cmdPress2(key) {
        if (!key) {
          console.error("Usage: webact.js press <key>");
          process.exit(1);
        }
        const keyMap = {
          "enter": { key: "Enter", code: "Enter", keyCode: 13 },
          "tab": { key: "Tab", code: "Tab", keyCode: 9 },
          "escape": { key: "Escape", code: "Escape", keyCode: 27 },
          "backspace": { key: "Backspace", code: "Backspace", keyCode: 8 },
          "delete": { key: "Delete", code: "Delete", keyCode: 46 },
          "arrowup": { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
          "arrowdown": { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
          "arrowleft": { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
          "arrowright": { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
          "space": { key: " ", code: "Space", keyCode: 32 },
          "home": { key: "Home", code: "Home", keyCode: 36 },
          "end": { key: "End", code: "End", keyCode: 35 },
          "pageup": { key: "PageUp", code: "PageUp", keyCode: 33 },
          "pagedown": { key: "PageDown", code: "PageDown", keyCode: 34 }
        };
        if (key.includes("+")) {
          const { modifiers, key: mainKey } = parseKeyCombo2(key);
          const mapped2 = keyMap[mainKey.toLowerCase()] || {
            key: mainKey.length === 1 ? mainKey : mainKey,
            code: mainKey.length === 1 ? `Key${mainKey.toUpperCase()}` : mainKey,
            keyCode: mainKey.length === 1 ? mainKey.toUpperCase().charCodeAt(0) : 0
          };
          const modBits = (modifiers.alt ? 1 : 0) | (modifiers.ctrl ? 2 : 0) | (modifiers.meta ? 4 : 0) | (modifiers.shift ? 8 : 0);
          await withCDP2(async (cdp) => {
            await cdp.send("Input.dispatchKeyEvent", {
              type: "keyDown",
              ...mapped2,
              windowsVirtualKeyCode: mapped2.keyCode,
              nativeVirtualKeyCode: mapped2.keyCode,
              modifiers: modBits
            });
            await cdp.send("Input.dispatchKeyEvent", {
              type: "keyUp",
              ...mapped2,
              windowsVirtualKeyCode: mapped2.keyCode,
              nativeVirtualKeyCode: mapped2.keyCode,
              modifiers: modBits
            });
            console.log(`OK press ${key}`);
            if (["enter", "tab", "escape"].includes(mainKey.toLowerCase())) {
              await new Promise((r) => setTimeout(r, 150));
              console.log(await getPageBrief2(cdp));
            }
          });
          return;
        }
        const mapped = keyMap[key.toLowerCase()] || { key, code: `Key${key.toUpperCase()}`, keyCode: key.charCodeAt(0) };
        await withCDP2(async (cdp) => {
          await cdp.send("Input.dispatchKeyEvent", {
            type: "keyDown",
            ...mapped,
            windowsVirtualKeyCode: mapped.keyCode,
            nativeVirtualKeyCode: mapped.keyCode
          });
          await cdp.send("Input.dispatchKeyEvent", {
            type: "keyUp",
            ...mapped,
            windowsVirtualKeyCode: mapped.keyCode,
            nativeVirtualKeyCode: mapped.keyCode
          });
          console.log(`OK press ${key}`);
          if (["enter", "tab", "escape"].includes(key.toLowerCase())) {
            await new Promise((r) => setTimeout(r, 150));
            console.log(await getPageBrief2(cdp));
          }
        });
      }
      async function cmdScroll2(args) {
        if (!args.length) {
          console.error("Usage: webact.js scroll <up|down|top|bottom|selector> [pixels]\n       webact.js scroll <selector> <up|down|top|bottom> [pixels]");
          process.exit(1);
        }
        const directions = ["up", "down", "top", "bottom"];
        const first = args[0];
        const lower = first.toLowerCase();
        const secondIsDirection = args[1] && directions.includes(args[1].toLowerCase());
        const firstIsDirection = directions.includes(lower);
        await withCDP2(async (cdp) => {
          if (firstIsDirection) {
            if (lower === "top") {
              await cdp.send("Runtime.evaluate", { expression: "window.scrollTo(0, 0)" });
            } else if (lower === "bottom") {
              await cdp.send("Runtime.evaluate", { expression: "window.scrollTo(0, document.body.scrollHeight)" });
            } else {
              const pixels = parseInt(args[1], 10) || 400;
              const deltaY = lower === "up" ? -pixels : pixels;
              await cdp.send("Input.dispatchMouseEvent", {
                type: "mouseWheel",
                x: 200,
                y: 200,
                deltaX: 0,
                deltaY
              });
            }
          } else if (secondIsDirection) {
            const selector = first;
            const dir = args[1].toLowerCase();
            const pixels = parseInt(args[2], 10) || 400;
            const result = await cdp.send("Runtime.evaluate", {
              expression: `
          (function() {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return { error: 'Element not found' };
            const dir = ${JSON.stringify(dir)};
            const pixels = ${pixels};
            if (dir === 'top') el.scrollTop = 0;
            else if (dir === 'bottom') el.scrollTop = el.scrollHeight;
            else el.scrollBy(0, dir === 'up' ? -pixels : pixels);
            return { tag: el.tagName.toLowerCase(), dir };
          })()
        `,
              returnByValue: true
            });
            const val = result.result.value;
            if (val && val.error) {
              console.error(val.error);
              process.exit(1);
            }
            console.log(`Scrolled ${val.dir} within ${val.tag} ${selector}`);
          } else {
            const result = await cdp.send("Runtime.evaluate", {
              expression: `
          (function() {
            const el = document.querySelector(${JSON.stringify(first)});
            if (!el) return { error: 'Element not found: ' + ${JSON.stringify(first)} };
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            return { tag: el.tagName.toLowerCase() };
          })()
        `,
              returnByValue: true
            });
            const val = result.result.value;
            if (val && val.error) {
              console.error(val.error);
              process.exit(1);
            }
            console.log(`Scrolled to ${val.tag} ${first}`);
          }
          await new Promise((r) => setTimeout(r, 100));
          console.log(await getPageBrief2(cdp));
        });
      }
      async function cmdEval2(expression) {
        if (!expression) {
          console.error("Usage: webact.js eval <js-expression>");
          process.exit(1);
        }
        await withCDP2(async (cdp) => {
          const contextId = await getFrameContextId2(cdp);
          const evalOpts = { expression, returnByValue: false, awaitPromise: true };
          if (contextId !== void 0) evalOpts.contextId = contextId;
          const result = await cdp.send("Runtime.evaluate", evalOpts);
          if (result.exceptionDetails) {
            console.error("Error:", result.exceptionDetails.text || result.exceptionDetails.exception?.description);
            process.exit(1);
          }
          const r = result.result;
          if (r.type === "undefined") {
          } else if (r.type === "object" && r.objectId) {
            const serOpts = {
              expression: `JSON.stringify(this, (k, v) => v instanceof HTMLElement ? v.outerHTML.slice(0, 200) : v, 2)`,
              objectId: r.objectId,
              returnByValue: true
            };
            const ser = await cdp.send("Runtime.callFunctionOn", serOpts);
            if (ser.result.value !== void 0) {
              console.log(ser.result.value);
            } else {
              console.log(r.description || `(${r.type})`);
            }
          } else if (r.value !== void 0) {
            console.log(r.value);
          } else {
            console.log(r.description || `(${r.type})`);
          }
        });
      }
      return {
        cmdHumanClick: cmdHumanClick2,
        cmdHumanType: cmdHumanType2,
        cmdClick: cmdClick2,
        cmdDoubleClick: cmdDoubleClick2,
        cmdHover: cmdHover2,
        cmdFocus: cmdFocus2,
        cmdSelect: cmdSelect2,
        cmdUpload: cmdUpload2,
        cmdDrag: cmdDrag2,
        cmdType: cmdType2,
        cmdKeyboard: cmdKeyboard2,
        cmdPaste: cmdPaste2,
        cmdWaitFor: cmdWaitFor2,
        cmdDialog: cmdDialog2,
        cmdWaitForNavigation: cmdWaitForNavigation2,
        cmdPress: cmdPress2,
        cmdScroll: cmdScroll2,
        cmdEval: cmdEval2
      };
    }
    module2.exports = createInteractionCommands2;
  }
});

// mcp.src.js
var { spawn } = require("child_process");
var fs = require("fs");
var path = require("path");
var os = require("os");
var crypto = require("crypto");
var readline = require("readline");
var { version: VERSION } = require_package();
var TOOLS = require_tools();
var MCP_INSTRUCTIONS = "";
try {
  MCP_INSTRUCTIONS = fs.readFileSync(path.join(__dirname, "MCP_INSTRUCTIONS.md"), "utf8");
} catch {
}
var {
  IS_WSL,
  getWSLHostIP,
  wslWindowsPath,
  findBrowser: findBrowserRaw,
  minimizeBrowser: minimizeBrowserRaw,
  activateBrowser: activateBrowserRaw
} = require_browser();
var createStateStore = require_state();
var {
  findFreePort,
  httpGet: httpGetRaw,
  httpPut: httpPutRaw,
  getDebugTabs: getDebugTabsRaw,
  createNewTab: createNewTabRaw,
  createCDP: createCDPRaw
} = require_cdp();
var {
  SELECTOR_GEN_SCRIPT,
  getPageBrief
} = require_page();
var {
  parseCoordinates,
  parseKeyCombo,
  humanClick,
  humanTypeText
} = require_input();
var {
  getFrameContextId: getFrameContextIdRaw,
  locateElement: locateElementRaw,
  locateElementByText: locateElementByTextRaw
} = require_locator();
var createAxCommands = require_ax();
var createExtendedCommands = require_extended();
var createBaseCommands = require_base();
var createInteractionCommands = require_interactions();
var TMP = os.tmpdir();
var CDP_PORT = 9222;
var CDP_HOST = "127.0.0.1";
async function resolveCDPHost() {
  if (!IS_WSL) return;
  try {
    await httpGet(`http://127.0.0.1:${CDP_PORT}/json/version`);
    return;
  } catch {
  }
  const hostIP = getWSLHostIP();
  if (hostIP) {
    try {
      await httpGet(`http://${hostIP}:${CDP_PORT}/json/version`);
      CDP_HOST = hostIP;
      return;
    } catch {
    }
  }
}
var currentSessionId = null;
var stateStore = createStateStore(TMP);
var LAST_SESSION_FILE = stateStore.lastSessionFile;
function loadSessionState() {
  return stateStore.loadSessionState(currentSessionId);
}
function saveSessionState(state) {
  stateStore.saveSessionState(currentSessionId, state);
}
function resolveSelector(input) {
  if (/^\d+$/.test(input)) {
    const state = loadSessionState();
    if (!state.refMap) throw new Error("No ref map. Run: axtree -i");
    const selector = state.refMap[input];
    if (!selector) throw new Error(`Ref ${input} not found. Run: axtree -i to refresh.`);
    return selector;
  }
  return input;
}
var CACHE_TTL = stateStore.cacheTtl;
function loadActionCache() {
  return stateStore.loadActionCache();
}
function saveActionCache(cache) {
  stateStore.saveActionCache(cache);
}
function loadTabLocks() {
  return stateStore.loadTabLocks();
}
function saveTabLocks(locks) {
  stateStore.saveTabLocks(locks);
}
function checkTabLock(tabId) {
  return stateStore.checkTabLock(tabId);
}
function httpGet(url) {
  return httpGetRaw(url);
}
function httpPut(url) {
  return httpPutRaw(url);
}
async function getDebugTabs() {
  return getDebugTabsRaw(CDP_HOST, CDP_PORT);
}
async function createNewTab(url) {
  return createNewTabRaw(CDP_HOST, CDP_PORT, url);
}
async function connectToTab() {
  const state = loadSessionState();
  const tabs = await getDebugTabs();
  let tab;
  if (state.activeTabId) {
    tab = tabs.find((t) => t.id === state.activeTabId);
    if (!tab) {
      for (const ownedId of state.tabs) {
        tab = tabs.find((t) => t.id === ownedId);
        if (tab) break;
      }
    }
  }
  if (!tab || !tab.webSocketDebuggerUrl) {
    throw new Error("No active tab for this session. Navigate to a URL first.");
  }
  state.activeTabId = tab.id;
  saveSessionState(state);
  return tab;
}
function createCDP(wsUrl) {
  return createCDPRaw(wsUrl);
}
async function getFrameContextId(cdp) {
  const state = loadSessionState();
  return await getFrameContextIdRaw(cdp, state.activeFrameId);
}
async function withCDP(fn) {
  const tab = await connectToTab();
  const lock = checkTabLock(tab.id);
  if (lock && lock.sessionId !== currentSessionId) {
    throw new Error(`Tab is locked by session ${lock.sessionId} (expires in ${Math.round((lock.expires - Date.now()) / 1e3)}s). Use a different tab or wait.`);
  }
  let wsUrl = tab.webSocketDebuggerUrl;
  if (IS_WSL && CDP_HOST !== "127.0.0.1") {
    wsUrl = wsUrl.replace("127.0.0.1", CDP_HOST);
  }
  const cdp = await createCDP(wsUrl);
  try {
    const state = loadSessionState();
    if (state.dialogHandler) {
      const { accept, promptText } = state.dialogHandler;
      await cdp.send("Page.enable");
      cdp.on("Page.javascriptDialogOpening", async (params) => {
        try {
          await cdp.send("Page.handleJavaScriptDialog", { accept, promptText });
          console.log(`Auto-${accept ? "accepted" : "dismissed"} ${params.type}: "${params.message}"`);
        } catch {
        }
      });
      delete state.dialogHandler;
      saveSessionState(state);
    }
    if (state.blockPatterns) {
      const { resourceTypes, urlPatterns } = state.blockPatterns;
      await cdp.send("Fetch.enable", {
        patterns: [{ requestStage: "Request" }]
      });
      cdp.on("Fetch.requestPaused", async (params) => {
        try {
          const rt = params.resourceType;
          const url = params.request.url;
          const blocked = resourceTypes.includes(rt) || urlPatterns.some((p) => url.includes(p));
          if (blocked) {
            await cdp.send("Fetch.failRequest", { requestId: params.requestId, errorReason: "BlockedByClient" });
          } else {
            await cdp.send("Fetch.continueRequest", { requestId: params.requestId });
          }
        } catch {
        }
      });
    }
    return await fn(cdp);
  } finally {
    cdp.close();
  }
}
async function locateElement(cdp, selector) {
  const contextId = await getFrameContextId(cdp);
  return await locateElementRaw(cdp, selector, contextId);
}
async function locateElementByText(cdp, text) {
  const contextId = await getFrameContextId(cdp);
  return await locateElementByTextRaw(cdp, text, contextId);
}
function findBrowser() {
  return findBrowserRaw();
}
function minimizeBrowser(browserName) {
  return minimizeBrowserRaw(browserName);
}
function activateBrowser(browserName) {
  return activateBrowserRaw(browserName);
}
var launchBrowserName = null;
async function cmdLaunch() {
  const userDataDir = path.join(TMP, "webact-chrome-profile");
  const portFile = path.join(userDataDir, ".webact-port");
  if (IS_WSL) await resolveCDPHost();
  try {
    const savedPort = parseInt(fs.readFileSync(portFile, "utf8").trim(), 10);
    if (savedPort) {
      CDP_PORT = savedPort;
      await getDebugTabs();
      launchBrowserName = findBrowser()?.name || null;
      console.log(`Browser already running.`);
      return cmdConnect();
    }
  } catch {
    try {
      fs.unlinkSync(portFile);
    } catch {
    }
  }
  if (process.env.CDP_PORT) {
    CDP_PORT = parseInt(process.env.CDP_PORT, 10);
  } else {
    CDP_PORT = await findFreePort();
  }
  const browser = findBrowser();
  if (!browser) {
    throw new Error("No Chromium-based browser found. Install one of: Google Chrome, Microsoft Edge, Brave, Chromium, Arc, Vivaldi, Opera. Or set CHROME_PATH to the browser executable.");
  }
  launchBrowserName = browser.name;
  let launchDataDir = userDataDir;
  const isWindowsBrowser = IS_WSL && browser.path.startsWith("/mnt/");
  if (isWindowsBrowser) {
    launchDataDir = wslWindowsPath(userDataDir);
  }
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  const spawnOpts = { stdio: "ignore" };
  if (process.platform === "win32") {
    spawnOpts.detached = false;
    spawnOpts.shell = true;
  } else {
    spawnOpts.detached = true;
  }
  const child = spawn(browser.path, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${launchDataDir}`,
    "--no-first-run",
    "--no-default-browser-check"
  ], spawnOpts);
  child.unref();
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      if (IS_WSL) await resolveCDPHost();
      await getDebugTabs();
      fs.writeFileSync(portFile, String(CDP_PORT));
      console.log(`${browser.name} launched successfully.`);
      minimizeBrowser(browser.name);
      return cmdConnect();
    } catch {
    }
  }
  throw new Error(`${browser.name} launched but debug port not responding after 15s.`);
}
async function cmdConnect() {
  currentSessionId = crypto.randomBytes(4).toString("hex");
  const newTab = await createNewTab();
  const state = {
    sessionId: currentSessionId,
    activeTabId: newTab.id,
    tabs: [newTab.id],
    port: CDP_PORT,
    host: CDP_HOST,
    browserName: launchBrowserName
  };
  saveSessionState(state);
  fs.writeFileSync(LAST_SESSION_FILE, currentSessionId);
  console.log(`Session: ${currentSessionId}`);
}
var {
  cmdNavigate,
  cmdDom,
  cmdScreenshot,
  cmdTabs,
  cmdTab,
  cmdNewTab,
  cmdClose
} = createBaseCommands({
  withCDP,
  getFrameContextId,
  loadSessionState,
  saveSessionState,
  getPageBrief,
  getCurrentSessionId: () => currentSessionId,
  getDebugTabs,
  createNewTab,
  httpPut,
  getCDPHost: () => CDP_HOST,
  getCDPPort: () => CDP_PORT,
  fs,
  path,
  TMP
});
var {
  cmdHumanClick,
  cmdHumanType,
  cmdClick,
  cmdDoubleClick,
  cmdHover,
  cmdFocus,
  cmdSelect,
  cmdUpload,
  cmdDrag,
  cmdType,
  cmdKeyboard,
  cmdPaste,
  cmdWaitFor,
  cmdDialog,
  cmdWaitForNavigation,
  cmdPress,
  cmdScroll,
  cmdEval
} = createInteractionCommands({
  withCDP,
  locateElement,
  locateElementByText,
  getFrameContextId,
  getPageBrief,
  parseKeyCombo,
  humanClick,
  humanTypeText,
  loadSessionState,
  saveSessionState,
  fs,
  path
});
var {
  cmdAxtree,
  cmdObserve,
  cmdFind
} = createAxCommands({
  withCDP,
  loadSessionState,
  saveSessionState,
  loadActionCache,
  saveActionCache,
  CACHE_TTL,
  SELECTOR_GEN_SCRIPT
});
var {
  cmdCookies,
  cmdBack,
  cmdForward,
  cmdReload,
  cmdRightClick,
  cmdClear,
  cmdPdf,
  cmdConsole,
  cmdNetwork,
  cmdBlock,
  cmdViewport,
  cmdFrames,
  cmdFrame,
  cmdDownload,
  cmdActivate,
  cmdMinimize,
  cmdLock,
  cmdUnlock
} = createExtendedCommands({
  withCDP,
  getPageBrief,
  locateElement,
  loadSessionState,
  saveSessionState,
  checkTabLock,
  loadTabLocks,
  saveTabLocks,
  findBrowser,
  activateBrowser,
  minimizeBrowser,
  fs,
  path,
  TMP,
  getCurrentSessionId: () => currentSessionId
});
async function dispatch(command, args) {
  switch (command) {
    case "launch":
      await cmdLaunch();
      break;
    case "connect":
      await cmdConnect();
      break;
    case "navigate":
      await cmdNavigate(args.join(" "));
      break;
    case "dom": {
      const tokensArg = args.find((a) => a.startsWith("--tokens="));
      const maxTokens = tokensArg ? parseInt(tokensArg.split("=")[1], 10) : 0;
      const selectorArg = args.filter((a) => a !== "--full" && !a.startsWith("--tokens=")).join(" ") || null;
      const selector = selectorArg ? resolveSelector(selectorArg) : null;
      await cmdDom(selector, maxTokens);
      break;
    }
    case "screenshot":
      await cmdScreenshot();
      break;
    case "click": {
      const coords = parseCoordinates(args);
      if (coords) {
        await withCDP(async (cdp) => {
          await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: coords.x, y: coords.y });
          await new Promise((r) => setTimeout(r, 80));
          await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: coords.x, y: coords.y, button: "left", clickCount: 1 });
          await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: coords.x, y: coords.y, button: "left", clickCount: 1 });
          console.log(`Clicked at (${coords.x}, ${coords.y})`);
          await new Promise((r) => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else if (args[0] === "--text") {
        const text = args.slice(1).join(" ");
        if (!text) throw new Error("Usage: click --text <text>");
        await withCDP(async (cdp) => {
          const loc = await locateElementByText(cdp, text);
          await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: loc.x, y: loc.y });
          await new Promise((r) => setTimeout(r, 80));
          await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: loc.x, y: loc.y, button: "left", clickCount: 1 });
          await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: loc.x, y: loc.y, button: "left", clickCount: 1 });
          console.log(`Clicked ${loc.tag.toLowerCase()} "${loc.text}" (text match)`);
          await new Promise((r) => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else {
        await cmdClick(resolveSelector(args.join(" ")));
      }
      break;
    }
    case "doubleclick": {
      const coords = parseCoordinates(args);
      if (coords) {
        await withCDP(async (cdp) => {
          await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: coords.x, y: coords.y, button: "left", clickCount: 1 });
          await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: coords.x, y: coords.y, button: "left", clickCount: 1 });
          await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: coords.x, y: coords.y, button: "left", clickCount: 2 });
          await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: coords.x, y: coords.y, button: "left", clickCount: 2 });
          console.log(`Double-clicked at (${coords.x}, ${coords.y})`);
          await new Promise((r) => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else if (args[0] === "--text") {
        const text = args.slice(1).join(" ");
        if (!text) throw new Error("Usage: doubleclick --text <text>");
        await withCDP(async (cdp) => {
          const loc = await locateElementByText(cdp, text);
          await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: loc.x, y: loc.y, button: "left", clickCount: 1 });
          await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: loc.x, y: loc.y, button: "left", clickCount: 1 });
          await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: loc.x, y: loc.y, button: "left", clickCount: 2 });
          await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: loc.x, y: loc.y, button: "left", clickCount: 2 });
          console.log(`Double-clicked ${loc.tag.toLowerCase()} "${loc.text}" (text match)`);
          await new Promise((r) => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else {
        await cmdDoubleClick(resolveSelector(args.join(" ")));
      }
      break;
    }
    case "hover": {
      const coords = parseCoordinates(args);
      if (coords) {
        await withCDP(async (cdp) => {
          await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: coords.x, y: coords.y });
          console.log(`Hovered at (${coords.x}, ${coords.y})`);
          await new Promise((r) => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else if (args[0] === "--text") {
        const text = args.slice(1).join(" ");
        if (!text) throw new Error("Usage: hover --text <text>");
        await withCDP(async (cdp) => {
          const loc = await locateElementByText(cdp, text);
          await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: loc.x, y: loc.y });
          console.log(`Hovered ${loc.tag.toLowerCase()} "${loc.text}" (text match)`);
          await new Promise((r) => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else {
        await cmdHover(resolveSelector(args.join(" ")));
      }
      break;
    }
    case "focus":
      await cmdFocus(resolveSelector(args.join(" ")));
      break;
    case "type": {
      const selector = resolveSelector(args[0]);
      const text = args.slice(1).join(" ");
      await cmdType(selector, text);
      break;
    }
    case "keyboard":
      await cmdKeyboard(args.join(" "));
      break;
    case "paste":
      await cmdPaste(args.join(" "));
      break;
    case "select":
      await cmdSelect(resolveSelector(args[0]), ...args.slice(1));
      break;
    case "upload":
      await cmdUpload(resolveSelector(args[0]), ...args.slice(1));
      break;
    case "drag":
      await cmdDrag(resolveSelector(args[0]), resolveSelector(args[1]));
      break;
    case "dialog":
      await cmdDialog(args[0], args.slice(1).join(" ") || void 0);
      break;
    case "waitfor":
      await cmdWaitFor(resolveSelector(args[0]), args[1]);
      break;
    case "waitfornav":
      await cmdWaitForNavigation(args[0]);
      break;
    case "press":
      await cmdPress(args[0]);
      break;
    case "scroll":
      await cmdScroll(args);
      break;
    case "eval":
      await cmdEval(args.join(" "));
      break;
    case "tabs":
      await cmdTabs();
      break;
    case "tab":
      await cmdTab(args[0]);
      break;
    case "newtab":
      await cmdNewTab(args.join(" ") || void 0);
      break;
    case "close":
      await cmdClose();
      break;
    case "axtree": {
      const interactive = args.includes("--interactive") || args.includes("-i");
      const diff = args.includes("--diff");
      const tokensArg = args.find((a) => a.startsWith("--tokens="));
      const maxTokens = tokensArg ? parseInt(tokensArg.split("=")[1], 10) : 0;
      const selector = args.filter((a) => !["--interactive", "-i", "--diff"].includes(a) && !a.startsWith("--tokens=")).join(" ") || null;
      await cmdAxtree(selector, interactive, diff, maxTokens);
      break;
    }
    case "cookies":
      await cmdCookies(args[0], ...args.slice(1));
      break;
    case "back":
      await cmdBack();
      break;
    case "forward":
      await cmdForward();
      break;
    case "reload":
      await cmdReload();
      break;
    case "rightclick": {
      const coords = parseCoordinates(args);
      if (coords) {
        await withCDP(async (cdp) => {
          await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: coords.x, y: coords.y, button: "right", clickCount: 1 });
          await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: coords.x, y: coords.y, button: "right", clickCount: 1 });
          console.log(`Right-clicked at (${coords.x}, ${coords.y})`);
          await new Promise((r) => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else if (args[0] === "--text") {
        const text = args.slice(1).join(" ");
        if (!text) throw new Error("Usage: rightclick --text <text>");
        await withCDP(async (cdp) => {
          const loc = await locateElementByText(cdp, text);
          await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: loc.x, y: loc.y, button: "right", clickCount: 1 });
          await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: loc.x, y: loc.y, button: "right", clickCount: 1 });
          console.log(`Right-clicked ${loc.tag.toLowerCase()} "${loc.text}" (text match)`);
          await new Promise((r) => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else {
        await cmdRightClick(resolveSelector(args.join(" ")));
      }
      break;
    }
    case "clear":
      await cmdClear(resolveSelector(args.join(" ")));
      break;
    case "observe":
      await cmdObserve();
      break;
    case "find":
      await cmdFind(args.join(" "));
      break;
    case "pdf":
      await cmdPdf(args[0]);
      break;
    case "console":
      await cmdConsole(args[0]);
      break;
    case "network":
      await cmdNetwork(args[0], ...args.slice(1));
      break;
    case "block":
      await cmdBlock(...args);
      break;
    case "viewport":
      await cmdViewport(args[0], args[1]);
      break;
    case "frames":
      await cmdFrames();
      break;
    case "frame":
      await cmdFrame(args[0]);
      break;
    case "download":
      await cmdDownload(args[0], ...args.slice(1));
      break;
    case "activate":
      await cmdActivate();
      break;
    case "minimize":
      await cmdMinimize();
      break;
    case "humanclick": {
      const coords = parseCoordinates(args);
      if (coords) {
        await withCDP(async (cdp) => {
          await humanClick(cdp, coords.x, coords.y);
          console.log(`Human-clicked at (${coords.x}, ${coords.y})`);
          await new Promise((r) => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else if (args[0] === "--text") {
        const text = args.slice(1).join(" ");
        if (!text) throw new Error("Usage: humanclick --text <text>");
        await withCDP(async (cdp) => {
          const loc = await locateElementByText(cdp, text);
          await humanClick(cdp, loc.x, loc.y);
          console.log(`Human-clicked ${loc.tag.toLowerCase()} "${loc.text}" (text match)`);
          await new Promise((r) => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else {
        await cmdHumanClick(resolveSelector(args.join(" ")));
      }
      break;
    }
    case "humantype": {
      const selector = resolveSelector(args[0]);
      const text = args.slice(1).join(" ");
      await cmdHumanType(selector, text);
      break;
    }
    case "lock":
      await cmdLock(args[0]);
      break;
    case "unlock":
      await cmdUnlock();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}
function mapToolToArgs(toolName, params) {
  const command = toolName.replace(/^webact_/, "");
  let args = [];
  switch (command) {
    case "launch":
    case "screenshot":
    case "observe":
    case "frames":
    case "tabs":
    case "close":
    case "back":
    case "forward":
    case "reload":
    case "activate":
    case "minimize":
    case "unlock":
      args = [];
      break;
    case "navigate":
      args = [params.url];
      break;
    case "dom": {
      const a = [];
      if (params.selector) a.push(params.selector);
      if (params.max_tokens) a.push("--tokens=" + params.max_tokens);
      args = a;
      break;
    }
    case "axtree": {
      const a = [];
      if (params.interactive) a.push("-i");
      if (params.diff) a.push("--diff");
      if (params.selector) a.push(params.selector);
      if (params.max_tokens) a.push("--tokens=" + params.max_tokens);
      args = a;
      break;
    }
    case "click":
    case "doubleclick":
    case "rightclick":
    case "hover":
    case "humanclick":
      args = params.target.split(" ");
      break;
    case "type":
    case "humantype":
      args = [params.selector, params.text];
      break;
    case "keyboard":
    case "paste":
      args = [params.text];
      break;
    case "press":
      args = [params.key];
      break;
    case "select":
      args = [params.selector, ...params.values];
      break;
    case "upload":
      args = [params.selector, ...params.files];
      break;
    case "drag":
      args = [params.from, params.to];
      break;
    case "scroll": {
      const a = params.target.split(" ");
      if (params.pixels) a.push(String(params.pixels));
      args = a;
      break;
    }
    case "eval":
      args = [params.expression];
      break;
    case "dialog": {
      const a = [params.action];
      if (params.text) a.push(params.text);
      args = a;
      break;
    }
    case "waitfor": {
      const a = [params.selector];
      if (params.timeout) a.push(String(params.timeout));
      args = a;
      break;
    }
    case "waitfornav": {
      const a = [];
      if (params.timeout) a.push(String(params.timeout));
      args = a;
      break;
    }
    case "cookies": {
      const a = [];
      if (params.action) a.push(params.action);
      if (params.name) a.push(params.name);
      if (params.value) a.push(params.value);
      if (params.domain) a.push(params.domain);
      args = a;
      break;
    }
    case "console": {
      const a = [];
      if (params.action) a.push(params.action);
      args = a;
      break;
    }
    case "network": {
      const a = [];
      if (params.action) a.push(params.action);
      if (params.duration) a.push(String(params.duration));
      if (params.filter) a.push(params.filter);
      args = a;
      break;
    }
    case "block":
      args = params.patterns;
      break;
    case "viewport": {
      const a = [params.preset_or_width];
      if (params.height) a.push(params.height);
      args = a;
      break;
    }
    case "frame":
      args = [params.target];
      break;
    case "tab":
      args = [params.id];
      break;
    case "newtab": {
      const a = [];
      if (params.url) a.push(params.url);
      args = a;
      break;
    }
    case "lock": {
      const a = [];
      if (params.seconds) a.push(String(params.seconds));
      args = a;
      break;
    }
    case "download": {
      const a = [];
      if (params.action) a.push(params.action);
      if (params.path) a.push(params.path);
      args = a;
      break;
    }
    case "find":
      args = [params.query];
      break;
    case "pdf": {
      const a = [];
      if (params.path) a.push(params.path);
      args = a;
      break;
    }
    case "focus":
      args = [params.selector];
      break;
    case "clear":
      args = [params.selector];
      break;
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
  return { command, args };
}
function captureOutput(fn) {
  const captured = [];
  const origLog = console.log;
  const origError = console.error;
  console.log = (...args) => {
    captured.push(args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" "));
  };
  console.error = (...args) => {
    captured.push(args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" "));
  };
  const restore = () => {
    console.log = origLog;
    console.error = origError;
  };
  return { captured, restore };
}
function extractScreenshotPath(output) {
  for (const line of output) {
    const match = line.match(/^Screenshot saved to (.+\.png)$/);
    if (match) return match[1];
  }
  return null;
}
function ensureSession() {
  if (currentSessionId) return;
  try {
    const lastSid = fs.readFileSync(LAST_SESSION_FILE, "utf8").trim();
    currentSessionId = lastSid;
    const state = loadSessionState();
    if (state.port) CDP_PORT = state.port;
    if (state.host) CDP_HOST = state.host;
  } catch {
    throw new Error("No active session. Call webact_launch first.");
  }
}
function sendResponse(response) {
  const json = JSON.stringify(response);
  process.stdout.write(json + "\n");
}
async function handleRequest(msg) {
  if (msg.id === void 0 || msg.id === null) {
    return;
  }
  const { id, method, params } = msg;
  try {
    switch (method) {
      case "initialize": {
        sendResponse({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2025-11-25",
            capabilities: { tools: {} },
            serverInfo: { name: "webact", version: VERSION },
            instructions: MCP_INSTRUCTIONS
          }
        });
        break;
      }
      case "tools/list": {
        sendResponse({
          jsonrpc: "2.0",
          id,
          result: { tools: TOOLS }
        });
        break;
      }
      case "tools/call": {
        const toolName = params.name;
        const toolParams = params.arguments || {};
        try {
          const { command, args } = mapToolToArgs(toolName, toolParams);
          if (process.env.CDP_PORT) {
            CDP_PORT = parseInt(process.env.CDP_PORT, 10);
          }
          if (command !== "launch" && command !== "connect") {
            try {
              ensureSession();
            } catch {
            }
            let needsLaunch = !currentSessionId;
            if (!needsLaunch) {
              try {
                await getDebugTabs();
              } catch {
                needsLaunch = true;
              }
            }
            if (needsLaunch) {
              process.stderr.write(`Auto-launching browser for ${command}...
`);
              await dispatch("launch", []);
              process.stderr.write(`Auto-launch complete.
`);
            }
          }
          const { captured, restore } = captureOutput();
          try {
            await dispatch(command, args);
          } finally {
            restore();
          }
          if (command === "screenshot") {
            const screenshotPath = extractScreenshotPath(captured);
            if (screenshotPath && fs.existsSync(screenshotPath)) {
              const base64 = fs.readFileSync(screenshotPath, "base64");
              const textLines = captured.filter((l) => !l.startsWith("Screenshot saved to "));
              const content = [];
              if (textLines.length > 0) {
                content.push({ type: "text", text: textLines.join("\n") });
              }
              content.push({ type: "image", data: base64, mimeType: "image/png" });
              sendResponse({
                jsonrpc: "2.0",
                id,
                result: { content }
              });
              return;
            }
          }
          const text = captured.join("\n");
          sendResponse({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: text || "(no output)" }]
            }
          });
        } catch (err) {
          sendResponse({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: `Error: ${err.message}` }],
              isError: true
            }
          });
        }
        break;
      }
      default: {
        sendResponse({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        });
      }
    }
  } catch (err) {
    sendResponse({
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: err.message }
    });
  }
}
var rl = readline.createInterface({
  input: process.stdin,
  terminal: false
});
rl.on("line", async (line) => {
  line = line.trim();
  if (!line) return;
  try {
    const msg = JSON.parse(line);
    await handleRequest(msg);
  } catch (err) {
    sendResponse({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: `Parse error: ${err.message}` }
    });
  }
});
rl.on("close", () => {
  process.exit(0);
});
