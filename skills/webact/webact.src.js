const WebSocket = require('ws');
const http = require('http');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');
const crypto = require('crypto');
const { version: VERSION } = require('./package.json');

// --- Temp directory (cross-platform) ---
const TMP = os.tmpdir();

// --- CDP port (resolved at runtime) ---
let CDP_PORT = 9222;

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

// --- WSL detection ---
// When running in WSL with Chrome on the Windows host, we need to:
// 1. Find Chrome at /mnt/c/... paths
// 2. Pass Windows-style paths for --user-data-dir
// 3. Connect to the host IP instead of 127.0.0.1
const IS_WSL = (() => {
  try {
    return fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
  } catch { return false; }
})();

function getWSLHostIP() {
  // Try multiple methods to find the Windows host IP from WSL
  try {
    // Method 1: WSL_HOST_IP env (newer WSL versions)
    if (process.env.WSL_HOST_IP) return process.env.WSL_HOST_IP;
    // Method 2: /etc/resolv.conf nameserver (standard WSL2)
    const resolv = fs.readFileSync('/etc/resolv.conf', 'utf8');
    const match = resolv.match(/nameserver\s+(\d+\.\d+\.\d+\.\d+)/);
    if (match) return match[1];
  } catch {}
  return null;
}

// CDP host: in WSL2, localhost forwarding may or may not work.
// We resolve this at connect time, not startup, so we can probe.
let CDP_HOST = '127.0.0.1';

async function resolveCDPHost() {
  if (!IS_WSL) return;
  // Try localhost first (Win11 22H2+ has localhost forwarding)
  try {
    await httpGet(`http://127.0.0.1:${CDP_PORT}/json/version`);
    return; // localhost works
  } catch {}
  // Fall back to host IP
  const hostIP = getWSLHostIP();
  if (hostIP) {
    try {
      await httpGet(`http://${hostIP}:${CDP_PORT}/json/version`);
      CDP_HOST = hostIP;
      return;
    } catch {}
  }
  // Neither worked — keep localhost, let it fail with a clear error later
}

function wslWindowsPath(linuxPath) {
  // Convert a WSL/Linux path to a Windows path for passing to Windows executables
  try {
    return execSync(`wslpath -w "${linuxPath}"`, { encoding: 'utf8' }).trim();
  } catch {
    return linuxPath;
  }
}

// --- Session state ---
// Each agent session gets its own state file: <tmpdir>/webact-state-<sessionId>.json
// State tracks: { sessionId, activeTabId, tabs: [tabId, ...] }
let currentSessionId = null;

const LAST_SESSION_FILE = path.join(TMP, 'webact-last-session');

function sessionStateFile() {
  return path.join(TMP, `webact-state-${currentSessionId}.json`);
}

function loadSessionState() {
  if (!currentSessionId) return { tabs: [] };
  try {
    return JSON.parse(fs.readFileSync(sessionStateFile(), 'utf8'));
  } catch {
    return { sessionId: currentSessionId, activeTabId: null, tabs: [] };
  }
}

function saveSessionState(state) {
  if (!currentSessionId) return;
  fs.writeFileSync(sessionStateFile(), JSON.stringify(state, null, 2));
}

// --- Ref-based targeting ---

// Injected into the page to generate unique CSS selectors for elements
const SELECTOR_GEN_SCRIPT = `if (!window.__webactGenSelector) {
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

// Resolve a ref number (e.g. "3") to a CSS selector using the stored ref map
function resolveSelector(input) {
  if (/^\d+$/.test(input)) {
    const state = loadSessionState();
    if (!state.refMap) throw new Error('No ref map. Run: axtree -i');
    const selector = state.refMap[input];
    if (!selector) throw new Error(`Ref ${input} not found. Run: axtree -i to refresh.`);
    return selector;
  }
  return input;
}

// --- Action cache ---

const ACTION_CACHE_FILE = path.join(TMP, 'webact-action-cache.json');
const CACHE_TTL = 48 * 60 * 60 * 1000; // 48 hours
const CACHE_MAX_ENTRIES = 100;

function loadActionCache() {
  try { return JSON.parse(fs.readFileSync(ACTION_CACHE_FILE, 'utf8')); }
  catch { return {}; }
}

function saveActionCache(cache) {
  const now = Date.now();
  for (const key of Object.keys(cache)) {
    if (now - cache[key].timestamp > CACHE_TTL) delete cache[key];
  }
  const entries = Object.entries(cache).sort((a, b) => b[1].timestamp - a[1].timestamp);
  const pruned = entries.length > CACHE_MAX_ENTRIES
    ? Object.fromEntries(entries.slice(0, CACHE_MAX_ENTRIES))
    : cache;
  fs.writeFileSync(ACTION_CACHE_FILE, JSON.stringify(pruned));
}

// --- Tab locking ---
const TAB_LOCKS_FILE = path.join(TMP, 'webact-tab-locks.json');

function loadTabLocks() {
  try { return JSON.parse(fs.readFileSync(TAB_LOCKS_FILE, 'utf8')); }
  catch { return {}; }
}

function saveTabLocks(locks) {
  fs.writeFileSync(TAB_LOCKS_FILE, JSON.stringify(locks, null, 2));
}

function checkTabLock(tabId) {
  const locks = loadTabLocks();
  const lock = locks[tabId];
  if (!lock) return null;
  if (Date.now() > lock.expires) {
    delete locks[tabId];
    saveTabLocks(locks);
    return null;
  }
  return lock;
}

// --- CDP Connection ---

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function httpPut(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'PUT',
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.end();
  });
}

async function getDebugTabs() {
  const data = await httpGet(`http://${CDP_HOST}:${CDP_PORT}/json`);
  try {
    return JSON.parse(data);
  } catch (e) {
    throw new Error('Failed to parse Chrome debug info');
  }
}

async function createNewTab(url) {
  const endpoint = url
    ? `http://${CDP_HOST}:${CDP_PORT}/json/new?${url}`
    : `http://${CDP_HOST}:${CDP_PORT}/json/new`;
  const data = await httpPut(endpoint);
  try {
    return JSON.parse(data);
  } catch (e) {
    throw new Error('Failed to create new tab');
  }
}

async function connectToTab() {
  const state = loadSessionState();
  const tabs = await getDebugTabs();

  let tab;
  if (state.activeTabId) {
    tab = tabs.find(t => t.id === state.activeTabId);
    if (!tab) {
      // Active tab gone — try another session-owned tab
      for (const ownedId of state.tabs) {
        tab = tabs.find(t => t.id === ownedId);
        if (tab) break;
      }
    }
  }

  if (!tab || !tab.webSocketDebuggerUrl) {
    throw new Error('No active tab for this session. Navigate to a URL first.');
  }

  // Update active tab
  state.activeTabId = tab.id;
  saveSessionState(state);
  return tab;
}

function createCDP(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let msgId = 1;
    const pending = new Map();
    const eventHandlers = new Map();

    ws.on('open', () => {
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

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(`${msg.error.message} (${msg.error.code})`));
        } else {
          resolve(msg.result);
        }
      } else if (msg.method && eventHandlers.has(msg.method)) {
        eventHandlers.get(msg.method)(msg.params);
      }
    });

    ws.on('error', reject);
    ws.on('close', () => {
      for (const { reject } of pending.values()) {
        reject(new Error('WebSocket closed'));
      }
      pending.clear();
    });
  });
}

// Compact page brief: ~200 chars instead of ~4000 for full DOM
// Gives the agent enough to decide next step without a separate dom call
const PAGE_BRIEF_SCRIPT = `(function() {
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
  if (counts.length) r += '\\n(' + counts.join(', ') + ' total — use dom or axtree for full list)';
  return r;
})()`;

async function getPageBrief(cdp) {
  try {
    const result = await cdp.send('Runtime.evaluate', {
      expression: PAGE_BRIEF_SCRIPT,
      returnByValue: true,
    });
    return result.result.value || '';
  } catch { return ''; }
}

// Resolve the execution context ID for the active frame (if any).
// Returns undefined for main frame, or a contextId for iframes.
async function getFrameContextId(cdp) {
  const state = loadSessionState();
  if (!state.activeFrameId) return undefined;
  // Collect execution contexts via Runtime.enable events
  const contexts = [];
  cdp.on('Runtime.executionContextCreated', (params) => { contexts.push(params.context); });
  await cdp.send('Runtime.enable');
  // Events arrive synchronously before enable resolves, but add a small delay for safety
  await new Promise(r => setTimeout(r, 30));
  const ctx = contexts.find(c => c.auxData && c.auxData.frameId === state.activeFrameId && c.auxData.isDefault);
  if (!ctx) {
    console.error(`Could not find execution context for frame ${state.activeFrameId}. Try "webact.js frames" to verify the frame still exists.`);
    process.exit(1);
  }
  return ctx.id;
}

async function withCDP(fn) {
  const tab = await connectToTab();
  // Check if another session has locked this tab
  const lock = checkTabLock(tab.id);
  if (lock && lock.sessionId !== currentSessionId) {
    throw new Error(`Tab is locked by session ${lock.sessionId} (expires in ${Math.round((lock.expires - Date.now()) / 1000)}s). Use a different tab or wait.`);
  }
  // Chrome returns ws://127.0.0.1:... but in WSL2 we need the host IP
  let wsUrl = tab.webSocketDebuggerUrl;
  if (IS_WSL && CDP_HOST !== '127.0.0.1') {
    wsUrl = wsUrl.replace('127.0.0.1', CDP_HOST);
  }
  const cdp = await createCDP(wsUrl);
  try {
    const state = loadSessionState();

    // If a dialog handler is pending, activate it
    if (state.dialogHandler) {
      const { accept, promptText } = state.dialogHandler;
      await cdp.send('Page.enable');
      cdp.on('Page.javascriptDialogOpening', async (params) => {
        try {
          await cdp.send('Page.handleJavaScriptDialog', { accept, promptText });
          console.log(`Auto-${accept ? 'accepted' : 'dismissed'} ${params.type}: "${params.message}"`);
        } catch {}
      });
      delete state.dialogHandler;
      saveSessionState(state);
    }

    // If network blocking is configured, apply it
    if (state.blockPatterns) {
      const { resourceTypes, urlPatterns } = state.blockPatterns;
      await cdp.send('Fetch.enable', {
        patterns: [{ requestStage: 'Request' }],
      });
      cdp.on('Fetch.requestPaused', async (params) => {
        try {
          const rt = params.resourceType;
          const url = params.request.url;
          const blocked = resourceTypes.includes(rt) ||
            urlPatterns.some(p => url.includes(p));
          if (blocked) {
            await cdp.send('Fetch.failRequest', { requestId: params.requestId, errorReason: 'BlockedByClient' });
          } else {
            await cdp.send('Fetch.continueRequest', { requestId: params.requestId });
          }
        } catch {}
      });
    }

    return await fn(cdp);
  } finally {
    cdp.close();
  }
}

// --- Commands ---

// --- Browser detection ---
// All Chromium-based browsers support CDP. Ordered by preference.

function findBrowser() {
  if (process.env.CHROME_PATH) {
    if (fs.existsSync(process.env.CHROME_PATH)) {
      return { path: process.env.CHROME_PATH, name: path.basename(process.env.CHROME_PATH) };
    }
    console.error(`CHROME_PATH set but not found: ${process.env.CHROME_PATH}`);
    process.exit(1);
  }

  const home = process.env.HOME || '';
  const platform = process.platform;

  // Each entry: [path, display name]
  const candidates = [];

  if (platform === 'darwin') {
    const macApps = [
      // /Applications and ~/Applications for each
      ['Google Chrome',         'Google Chrome.app/Contents/MacOS/Google Chrome'],
      ['Google Chrome Canary',  'Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'],
      ['Microsoft Edge',        'Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
      ['Brave Browser',         'Brave Browser.app/Contents/MacOS/Brave Browser'],
      ['Arc',                   'Arc.app/Contents/MacOS/Arc'],
      ['Vivaldi',               'Vivaldi.app/Contents/MacOS/Vivaldi'],
      ['Opera',                 'Opera.app/Contents/MacOS/Opera'],
      ['Chromium',              'Chromium.app/Contents/MacOS/Chromium'],
    ];
    for (const [name, rel] of macApps) {
      candidates.push([`/Applications/${rel}`, name]);
      candidates.push([`${home}/Applications/${rel}`, name]);
    }
  } else if (platform === 'linux') {
    candidates.push(
      // Chrome
      ['/usr/bin/google-chrome-stable', 'Google Chrome'],
      ['/usr/bin/google-chrome', 'Google Chrome'],
      ['/usr/local/bin/google-chrome-stable', 'Google Chrome'],
      ['/usr/local/bin/google-chrome', 'Google Chrome'],
      // Edge
      ['/usr/bin/microsoft-edge-stable', 'Microsoft Edge'],
      ['/usr/bin/microsoft-edge', 'Microsoft Edge'],
      // Brave
      ['/usr/bin/brave-browser', 'Brave Browser'],
      ['/usr/bin/brave-browser-stable', 'Brave Browser'],
      // Vivaldi
      ['/usr/bin/vivaldi-stable', 'Vivaldi'],
      ['/usr/bin/vivaldi', 'Vivaldi'],
      // Opera
      ['/usr/bin/opera', 'Opera'],
      // Chromium
      ['/usr/bin/chromium-browser', 'Chromium'],
      ['/usr/bin/chromium', 'Chromium'],
      ['/usr/local/bin/chromium-browser', 'Chromium'],
      ['/usr/local/bin/chromium', 'Chromium'],
      ['/snap/bin/chromium', 'Chromium (snap)'],
      // Flatpak (common runtime paths)
      [`${home}/.local/share/flatpak/exports/bin/com.google.Chrome`, 'Google Chrome (flatpak)'],
      ['/var/lib/flatpak/exports/bin/com.google.Chrome', 'Google Chrome (flatpak)'],
      [`${home}/.local/share/flatpak/exports/bin/org.chromium.Chromium`, 'Chromium (flatpak)'],
      ['/var/lib/flatpak/exports/bin/org.chromium.Chromium', 'Chromium (flatpak)'],
      [`${home}/.local/share/flatpak/exports/bin/com.brave.Browser`, 'Brave Browser (flatpak)'],
      ['/var/lib/flatpak/exports/bin/com.brave.Browser', 'Brave Browser (flatpak)'],
    );
    // WSL: also check Windows host browsers via /mnt/c/
    if (IS_WSL) {
      candidates.push(
        ['/mnt/c/Program Files/Google/Chrome/Application/chrome.exe', 'Google Chrome (Windows)'],
        ['/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'Google Chrome (Windows)'],
        ['/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe', 'Microsoft Edge (Windows)'],
        ['/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'Microsoft Edge (Windows)'],
        ['/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe', 'Brave Browser (Windows)'],
        ['/mnt/c/Program Files/Vivaldi/Application/vivaldi.exe', 'Vivaldi (Windows)'],
      );
    }
  } else if (platform === 'win32') {
    const pf = process.env['PROGRAMFILES'] || 'C:\\Program Files';
    const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const local = process.env['LOCALAPPDATA'] || '';
    candidates.push(
      [`${pf}\\Google\\Chrome\\Application\\chrome.exe`, 'Google Chrome'],
      [`${pf86}\\Google\\Chrome\\Application\\chrome.exe`, 'Google Chrome'],
      [`${local}\\Google\\Chrome\\Application\\chrome.exe`, 'Google Chrome'],
      [`${pf}\\Microsoft\\Edge\\Application\\msedge.exe`, 'Microsoft Edge'],
      [`${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`, 'Microsoft Edge'],
      [`${pf}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`, 'Brave Browser'],
      [`${local}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`, 'Brave Browser'],
      [`${pf}\\Vivaldi\\Application\\vivaldi.exe`, 'Vivaldi'],
      [`${local}\\Vivaldi\\Application\\vivaldi.exe`, 'Vivaldi'],
    );
  }

  for (const [p, name] of candidates) {
    if (fs.existsSync(p)) {
      return { path: p, name };
    }
  }

  // Fallback: try to find a browser on PATH (Linux/macOS)
  if (platform !== 'win32') {
    const pathNames = [
      ['google-chrome-stable', 'Google Chrome'],
      ['google-chrome', 'Google Chrome'],
      ['chromium-browser', 'Chromium'],
      ['chromium', 'Chromium'],
      ['microsoft-edge-stable', 'Microsoft Edge'],
      ['brave-browser', 'Brave Browser'],
    ];
    for (const [bin, name] of pathNames) {
      try {
        const resolved = execSync(`which ${bin} 2>/dev/null`, { encoding: 'utf8' }).trim();
        if (resolved) return { path: resolved, name };
      } catch {}
    }
  }

  return null;
}

function minimizeBrowser(browserName) {
  if (process.platform !== 'darwin') return;
  try {
    execSync(`osascript -e 'tell application "${browserName}" to set miniaturized of every window to true'`, { stdio: 'ignore' });
  } catch {}
}

function activateBrowser(browserName) {
  if (process.platform !== 'darwin') return;
  try {
    execSync(`osascript -e 'tell application "${browserName}" to activate' -e 'tell application "${browserName}" to set miniaturized of window 1 to false'`, { stdio: 'ignore' });
  } catch {}
}

// Module-level variable to pass browser name from cmdLaunch to cmdConnect
let launchBrowserName = null;

async function cmdLaunch() {
  const userDataDir = path.join(TMP, 'webact-chrome-profile');
  const portFile = path.join(userDataDir, '.webact-port');

  // Resolve the right host for CDP connections (handles WSL2)
  if (IS_WSL) await resolveCDPHost();

  // Check if Chrome is already running from a previous session
  // The port changes each launch, so we save it to a file keyed to the user-data-dir
  try {
    const savedPort = parseInt(fs.readFileSync(portFile, 'utf8').trim(), 10);
    if (savedPort) {
      CDP_PORT = savedPort;
      await getDebugTabs();
      // Try to determine browser name for session state
      launchBrowserName = findBrowser()?.name || null;
      console.log(`Browser already running.`);
      return cmdConnect();
    }
  } catch {
    // Saved port didn't respond — Chrome likely closed. Clean up stale file.
    try { fs.unlinkSync(portFile); } catch {}
  }

  // Determine port: env override or find a free one
  if (process.env.CDP_PORT) {
    CDP_PORT = parseInt(process.env.CDP_PORT, 10);
  } else {
    CDP_PORT = await findFreePort();
  }

  const browser = findBrowser();
  if (!browser) {
    console.error('No Chromium-based browser found.');
    console.error('Install one of: Google Chrome, Microsoft Edge, Brave, Chromium, Arc, Vivaldi, Opera');
    console.error('Or set CHROME_PATH to the browser executable.');
    process.exit(1);
  }
  launchBrowserName = browser.name;

  let launchDataDir = userDataDir;
  const isWindowsBrowser = IS_WSL && browser.path.startsWith('/mnt/');

  // Windows browsers need Windows-style paths
  if (isWindowsBrowser) {
    launchDataDir = wslWindowsPath(userDataDir);
  }

  // Ensure user data dir exists so we can write the port file
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const spawnOpts = { stdio: 'ignore' };
  if (process.platform === 'win32') {
    spawnOpts.detached = false;
    spawnOpts.shell = true;
  } else {
    spawnOpts.detached = true;
  }

  const child = spawn(browser.path, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${launchDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
  ], spawnOpts);
  child.unref();

  // Wait for browser to be ready
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      if (IS_WSL) await resolveCDPHost();
      await getDebugTabs();
      // Save the port so future launches can find this Chrome instance
      fs.writeFileSync(portFile, String(CDP_PORT));
      console.log(`${browser.name} launched successfully.`);
      minimizeBrowser(browser.name);
      return cmdConnect();
    } catch {}
  }
  console.error(`${browser.name} launched but debug port not responding after 15s.`);
  process.exit(1);
}

async function cmdConnect() {
  // Generate a new session ID
  currentSessionId = crypto.randomBytes(4).toString('hex');

  // Create a fresh tab for this session
  const newTab = await createNewTab();
  const state = {
    sessionId: currentSessionId,
    activeTabId: newTab.id,
    tabs: [newTab.id],
    port: CDP_PORT,
    host: CDP_HOST,
    browserName: launchBrowserName,
  };
  saveSessionState(state);

  // Save as last active session for auto-discovery
  fs.writeFileSync(LAST_SESSION_FILE, currentSessionId);

  console.log(`Session: ${currentSessionId}`);
}

async function cmdNavigate(url) {
  if (!url) { console.error('Usage: webact.js navigate <url>'); process.exit(1); }
  if (!url.startsWith('http')) url = 'https://' + url;

  // Clear stale ref map — new page invalidates old refs
  const state = loadSessionState();
  if (state.refMap) {
    delete state.refMap;
    delete state.refMapUrl;
    delete state.refMapTimestamp;
    saveSessionState(state);
  }

  await withCDP(async (cdp) => {
    await cdp.send('Page.enable');
    await cdp.send('Page.navigate', { url });

    // Wait for load
    const start = Date.now();
    while (Date.now() - start < 15000) {
      await new Promise(r => setTimeout(r, 300));
      const result = await cdp.send('Runtime.evaluate', {
        expression: 'document.readyState'
      });
      if (result.result && result.result.value === 'complete') break;
    }

    console.log(await getPageBrief(cdp));
  });
}

async function cmdDom(selector, maxTokens) {
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

      const root = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : 'document.body'};
      if (!root) return 'ERROR: Element not found' + (${selector ? `' for selector: ' + ${JSON.stringify(selector)}` : "''"});
      return extract(root, 0);
    })()
  `;

  await withCDP(async (cdp) => {
    const contextId = await getFrameContextId(cdp);
    const evalOpts = { expression: extractScript, returnByValue: true };
    if (contextId !== undefined) evalOpts.contextId = contextId;
    const result = await cdp.send('Runtime.evaluate', evalOpts);
    if (result.exceptionDetails) {
      console.error('DOM extraction error:', result.exceptionDetails.text);
      process.exit(1);
    }
    let output = result.result.value;
    if (maxTokens > 0) {
      const charBudget = maxTokens * 4;
      if (output.length > charBudget) {
        output = output.substring(0, charBudget) + '\n... (truncated to ~' + maxTokens + ' tokens)';
      }
    }
    console.log(output);
  });
}

async function cmdScreenshot() {
  await withCDP(async (cdp) => {
    const result = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(TMP, `webact-screenshot-${currentSessionId || 'default'}.png`);
    fs.writeFileSync(outPath, Buffer.from(result.data, 'base64'));
    console.log(`Screenshot saved to ${outPath}`);
  });
}

// Parse coordinate arguments: "550,197" or "550 197" (two args). Single number is a ref, not coords.
function parseCoordinates(args) {
  if (args.length === 1 && /^\d+(\.\d+)?,\d+(\.\d+)?$/.test(args[0])) {
    const [x, y] = args[0].split(',').map(Number);
    return { x, y };
  }
  if (args.length === 2 && /^\d+(\.\d+)?$/.test(args[0]) && /^\d+(\.\d+)?$/.test(args[1])) {
    return { x: Number(args[0]), y: Number(args[1]) };
  }
  return null;
}

// Shared helper: wait for element, scroll into view, return coordinates
async function locateElement(cdp, selector) {
  const contextId = await getFrameContextId(cdp);
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
    awaitPromise: true,
  };
  if (contextId !== undefined) evalOpts.contextId = contextId;
  const result = await cdp.send('Runtime.evaluate', evalOpts);
  const loc = result.result.value;
  if (loc.error) { console.error(loc.error); process.exit(1); }
  return loc;
}

// Search all visible elements for text match. Prefers exact match on smallest element.
async function locateElementByText(cdp, text) {
  const contextId = await getFrameContextId(cdp);
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
    returnByValue: true,
  };
  if (contextId !== undefined) evalOpts.contextId = contextId;
  const result = await cdp.send('Runtime.evaluate', evalOpts);
  const loc = result.result.value;
  if (loc.error) { console.error(loc.error); process.exit(1); }
  return loc;
}

// --- Human-like input simulation ---

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

async function humanMouseMove(cdp, fromX, fromY, toX, toY) {
  const distance = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
  const duration = 100 + (distance / 2000) * 200 + Math.random() * 100;
  const steps = Math.max(5, Math.min(30, Math.round(duration / 20)));

  const cp1X = fromX + (toX - fromX) * 0.25 + (Math.random() - 0.5) * 50;
  const cp1Y = fromY + (toY - fromY) * 0.25 + (Math.random() - 0.5) * 50;
  const cp2X = fromX + (toX - fromX) * 0.75 + (Math.random() - 0.5) * 50;
  const cp2Y = fromY + (toY - fromY) * 0.75 + (Math.random() - 0.5) * 50;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u*u*u*fromX + 3*u*u*t*cp1X + 3*u*t*t*cp2X + t*t*t*toX + (Math.random() - 0.5) * 2;
    const y = u*u*u*fromY + 3*u*u*t*cp1Y + 3*u*t*t*cp2Y + t*t*t*toY + (Math.random() - 0.5) * 2;
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await new Promise(r => setTimeout(r, 16 + Math.random() * 8));
  }
}

async function humanClick(cdp, x, y) {
  const startX = x + (Math.random() - 0.5) * 200 + 50;
  const startY = y + (Math.random() - 0.5) * 200 + 50;
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startX, y: startY });
  await humanMouseMove(cdp, startX, startY, x, y);
  await new Promise(r => setTimeout(r, 50 + Math.random() * 150));
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await new Promise(r => setTimeout(r, 30 + Math.random() * 90));
  const releaseX = x + (Math.random() - 0.5) * 2;
  const releaseY = y + (Math.random() - 0.5) * 2;
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: releaseX, y: releaseY, button: 'left', clickCount: 1 });
}

async function humanTypeText(cdp, text, fast) {
  const baseDelay = fast ? 40 : 80;
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char, unmodifiedText: char });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char, unmodifiedText: char });

    let delay = baseDelay + Math.random() * (baseDelay / 2);
    if (Math.random() < 0.05) delay += Math.random() * 500;
    if (i > 0 && chars[i - 1] === char) delay /= 2;

    if (Math.random() < 0.03 && i < chars.length - 1) {
      const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', text: wrongChar, unmodifiedText: wrongChar });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', text: wrongChar, unmodifiedText: wrongChar });
      await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', keyCode: 8, windowsVirtualKeyCode: 8 });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', keyCode: 8, windowsVirtualKeyCode: 8 });
      await new Promise(r => setTimeout(r, 30 + Math.random() * 70));
    }

    await new Promise(r => setTimeout(r, delay));
  }
}

async function cmdHumanClick(selector) {
  if (!selector) { console.error('Usage: webact humanclick <selector>'); process.exit(1); }

  await withCDP(async (cdp) => {
    const loc = await locateElement(cdp, selector);
    await humanClick(cdp, loc.x, loc.y);
    console.log(`Human-clicked ${loc.tag.toLowerCase()} "${loc.text}"`);
    await new Promise(r => setTimeout(r, 150));
    console.log(await getPageBrief(cdp));
  });
}

async function cmdHumanType(selector, text) {
  if (!selector || !text) { console.error('Usage: webact humantype <selector> <text>'); process.exit(1); }

  await withCDP(async (cdp) => {
    await cdp.send('Runtime.evaluate', {
      expression: `(function() { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Element not found'); el.focus(); if (el.select) el.select(); })()`,
    });
    await humanTypeText(cdp, text);
    console.log(`Human-typed "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" into ${selector}`);
  });
}

async function cmdClick(selector) {
  if (!selector) { console.error('Usage: webact.js click <selector>'); process.exit(1); }

  await withCDP(async (cdp) => {
    const loc = await locateElement(cdp, selector);

    // Move mouse first to trigger hover states (important for dynamic menus/dropdowns)
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: loc.x, y: loc.y,
    });
    await new Promise(r => setTimeout(r, 80));
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: loc.x, y: loc.y, button: 'left', clickCount: 1
    });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: loc.x, y: loc.y, button: 'left', clickCount: 1
    });

    console.log(`Clicked ${loc.tag.toLowerCase()} "${loc.text}"`);
    // Brief pause for any triggered navigation/render, then show page state
    await new Promise(r => setTimeout(r, 150));
    console.log(await getPageBrief(cdp));
  });
}

async function cmdDoubleClick(selector) {
  if (!selector) { console.error('Usage: webact.js doubleclick <selector>'); process.exit(1); }

  await withCDP(async (cdp) => {
    const loc = await locateElement(cdp, selector);

    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: loc.x, y: loc.y, button: 'left', clickCount: 1
    });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: loc.x, y: loc.y, button: 'left', clickCount: 1
    });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: loc.x, y: loc.y, button: 'left', clickCount: 2
    });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: loc.x, y: loc.y, button: 'left', clickCount: 2
    });

    console.log(`Double-clicked ${loc.tag.toLowerCase()} "${loc.text}"`);
    await new Promise(r => setTimeout(r, 150));
    console.log(await getPageBrief(cdp));
  });
}

async function cmdHover(selector) {
  if (!selector) { console.error('Usage: webact.js hover <selector>'); process.exit(1); }

  await withCDP(async (cdp) => {
    const loc = await locateElement(cdp, selector);

    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: loc.x, y: loc.y,
    });

    console.log(`Hovered ${loc.tag.toLowerCase()} "${loc.text}"`);
    await new Promise(r => setTimeout(r, 150));
    console.log(await getPageBrief(cdp));
  });
}

async function cmdFocus(selector) {
  if (!selector) { console.error('Usage: webact.js focus <selector>'); process.exit(1); }

  await withCDP(async (cdp) => {
    const result = await cdp.send('Runtime.evaluate', {
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
      awaitPromise: true,
    });
    const val = result.result.value;
    if (val.error) { console.error(val.error); process.exit(1); }
    console.log(`Focused <${val.tag.toLowerCase()}> "${val.text}"`);
  });
}

async function cmdSelect(selector, ...values) {
  if (!selector || values.length === 0) { console.error('Usage: webact.js select <selector> <value> [value2...]'); process.exit(1); }

  await withCDP(async (cdp) => {
    const result = await cdp.send('Runtime.evaluate', {
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
      awaitPromise: true,
    });
    const val = result.result.value;
    if (val.error) { console.error(val.error); process.exit(1); }
    console.log(`Selected: ${val.selected.join(', ')}`);
    console.log(await getPageBrief(cdp));
  });
}

async function cmdUpload(selector, ...filePaths) {
  if (!selector || filePaths.length === 0) { console.error('Usage: webact.js upload <selector> <file> [file2...]'); process.exit(1); }

  // Resolve absolute paths
  const resolved = filePaths.map(f => path.resolve(f));
  for (const f of resolved) {
    if (!fs.existsSync(f)) { console.error(`File not found: ${f}`); process.exit(1); }
  }

  await withCDP(async (cdp) => {
    // Enable DOM to use querySelector on the backend
    await cdp.send('DOM.enable');
    const doc = await cdp.send('DOM.getDocument');
    const node = await cdp.send('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector,
    });
    if (!node.nodeId) { console.error(`Element not found: ${selector}`); process.exit(1); }
    await cdp.send('DOM.setFileInputFiles', {
      nodeId: node.nodeId,
      files: resolved,
    });
    console.log(`Uploaded ${resolved.length} file(s) to ${selector}: ${resolved.map(f => path.basename(f)).join(', ')}`);
  });
}

async function cmdDrag(fromSelector, toSelector) {
  if (!fromSelector || !toSelector) { console.error('Usage: webact.js drag <from-selector> <to-selector>'); process.exit(1); }

  await withCDP(async (cdp) => {
    const from = await locateElement(cdp, fromSelector);
    const to = await locateElement(cdp, toSelector);

    // Move to source, press, move to target, release
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: from.x, y: from.y,
    });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: from.x, y: from.y, button: 'left', clickCount: 1,
    });
    // Intermediate steps for drag recognition
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const x = from.x + (to.x - from.x) * (i / steps);
      const y = from.y + (to.y - from.y) * (i / steps);
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved', x, y,
      });
    }
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: to.x, y: to.y, button: 'left', clickCount: 1,
    });

    console.log(`Dragged ${from.tag.toLowerCase()} to ${to.tag.toLowerCase()}`);
    console.log(await getPageBrief(cdp));
  });
}

async function cmdType(selector, text) {
  if (!selector || !text) { console.error('Usage: webact.js type <selector> <text>'); process.exit(1); }

  await withCDP(async (cdp) => {
    // Focus the element
    await cdp.send('Runtime.evaluate', {
      expression: `
        (function() {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) throw new Error('Element not found: ${selector}');
          el.focus();
          if (el.select) el.select();
        })()
      `,
    });

    // Type character by character for compatibility
    for (const char of text) {
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown', text: char, unmodifiedText: char,
      });
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp', text: char, unmodifiedText: char,
      });
    }

    console.log(`Typed "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" into ${selector}`);
  });
}

async function cmdKeyboard(text) {
  if (!text) { console.error('Usage: webact.js keyboard <text>'); process.exit(1); }

  await withCDP(async (cdp) => {
    for (const char of text) {
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown', text: char, unmodifiedText: char,
      });
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp', text: char, unmodifiedText: char,
      });
    }
    console.log(`OK keyboard "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
  });
}

async function cmdPaste(text) {
  if (!text) { console.error('Usage: webact.js paste <text>'); process.exit(1); }

  await withCDP(async (cdp) => {
    const result = await cdp.send('Runtime.evaluate', {
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
      returnByValue: true,
    });
    const val = result.result.value;
    if (val && val.error) { console.error(val.error); process.exit(1); }
    console.log(`OK pasted "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
  });
}

async function cmdWaitFor(selector, timeoutMs) {
  if (!selector) { console.error('Usage: webact.js waitfor <selector> [timeout_ms]'); process.exit(1); }
  const timeout = parseInt(timeoutMs, 10) || 5000;

  await withCDP(async (cdp) => {
    const result = await cdp.send('Runtime.evaluate', {
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
      awaitPromise: true,
    });

    const val = result.result.value;
    if (!val.found) {
      console.error(`Element not found after ${timeout}ms: ${selector}`);
      process.exit(1);
    }
    console.log(`Found ${val.tag} "${val.text}"`);
    console.log(await getPageBrief(cdp));
  });
}

async function cmdDialog(action, promptText) {
  const validActions = ['accept', 'dismiss'];
  if (!action || !validActions.includes(action.toLowerCase())) {
    console.error('Usage: webact.js dialog <accept|dismiss> [prompt-text]');
    console.error('Sets up auto-handling for the next dialog. Run BEFORE the action that triggers it.');
    process.exit(1);
  }

  const accept = action.toLowerCase() === 'accept';
  const state = loadSessionState();
  state.dialogHandler = { accept, promptText: promptText || '' };
  saveSessionState(state);
  console.log(`Dialog handler set: will ${accept ? 'accept' : 'dismiss'} the next dialog${promptText ? ` with text: "${promptText}"` : ''}`);
}

async function cmdWaitForNavigation(timeoutMs) {
  const timeout = parseInt(timeoutMs, 10) || 10000;

  await withCDP(async (cdp) => {
    await cdp.send('Page.enable');

    const result = await cdp.send('Runtime.evaluate', {
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
      awaitPromise: true,
    });

    const val = result.result.value;
    if (!val.ready) {
      console.error(`Page not ready after ${timeout}ms (readyState: ${val.readyState})`);
      process.exit(1);
    }
    console.log(await getPageBrief(cdp));
  });
}

async function cmdPress(key) {
  if (!key) { console.error('Usage: webact.js press <key>'); process.exit(1); }

  const keyMap = {
    'enter': { key: 'Enter', code: 'Enter', keyCode: 13 },
    'tab': { key: 'Tab', code: 'Tab', keyCode: 9 },
    'escape': { key: 'Escape', code: 'Escape', keyCode: 27 },
    'backspace': { key: 'Backspace', code: 'Backspace', keyCode: 8 },
    'delete': { key: 'Delete', code: 'Delete', keyCode: 46 },
    'arrowup': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    'arrowdown': { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    'arrowleft': { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    'arrowright': { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    'space': { key: ' ', code: 'Space', keyCode: 32 },
    'home': { key: 'Home', code: 'Home', keyCode: 36 },
    'end': { key: 'End', code: 'End', keyCode: 35 },
    'pageup': { key: 'PageUp', code: 'PageUp', keyCode: 33 },
    'pagedown': { key: 'PageDown', code: 'PageDown', keyCode: 34 },
  };

  // Handle key combos: Ctrl+A, Shift+Enter, Meta+C, etc.
  if (key.includes('+')) {
    const { modifiers, key: mainKey } = parseKeyCombo(key);
    const mapped = keyMap[mainKey.toLowerCase()] || {
      key: mainKey.length === 1 ? mainKey : mainKey,
      code: mainKey.length === 1 ? `Key${mainKey.toUpperCase()}` : mainKey,
      keyCode: mainKey.length === 1 ? mainKey.toUpperCase().charCodeAt(0) : 0,
    };
    const modBits = (modifiers.alt ? 1 : 0) | (modifiers.ctrl ? 2 : 0) | (modifiers.meta ? 4 : 0) | (modifiers.shift ? 8 : 0);

    await withCDP(async (cdp) => {
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown', ...mapped,
        windowsVirtualKeyCode: mapped.keyCode, nativeVirtualKeyCode: mapped.keyCode,
        modifiers: modBits,
      });
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp', ...mapped,
        windowsVirtualKeyCode: mapped.keyCode, nativeVirtualKeyCode: mapped.keyCode,
        modifiers: modBits,
      });
      console.log(`OK press ${key}`);
      if (['enter', 'tab', 'escape'].includes(mainKey.toLowerCase())) {
        await new Promise(r => setTimeout(r, 150));
        console.log(await getPageBrief(cdp));
      }
    });
    return;
  }

  const mapped = keyMap[key.toLowerCase()] || { key, code: `Key${key.toUpperCase()}`, keyCode: key.charCodeAt(0) };

  await withCDP(async (cdp) => {
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown', ...mapped, windowsVirtualKeyCode: mapped.keyCode, nativeVirtualKeyCode: mapped.keyCode,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp', ...mapped, windowsVirtualKeyCode: mapped.keyCode, nativeVirtualKeyCode: mapped.keyCode,
    });
    console.log(`OK press ${key}`);
    // Enter/Tab/Escape can trigger navigation or state changes
    if (['enter', 'tab', 'escape'].includes(key.toLowerCase())) {
      await new Promise(r => setTimeout(r, 150));
      console.log(await getPageBrief(cdp));
    }
  });
}

async function cmdScroll(args) {
  if (!args.length) { console.error('Usage: webact.js scroll <up|down|top|bottom|selector> [pixels]\n       webact.js scroll <selector> <up|down|top|bottom> [pixels]'); process.exit(1); }

  const directions = ['up', 'down', 'top', 'bottom'];
  const first = args[0];
  const lower = first.toLowerCase();

  // Detect element-scoped scroll: scroll <selector> <direction> [px]
  const secondIsDirection = args[1] && directions.includes(args[1].toLowerCase());
  const firstIsDirection = directions.includes(lower);

  await withCDP(async (cdp) => {
    if (firstIsDirection) {
      // Page-level scroll
      if (lower === 'top') {
        await cdp.send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)' });
      } else if (lower === 'bottom') {
        await cdp.send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight)' });
      } else {
        const pixels = parseInt(args[1], 10) || 400;
        const deltaY = lower === 'up' ? -pixels : pixels;
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mouseWheel', x: 200, y: 200, deltaX: 0, deltaY,
        });
      }
    } else if (secondIsDirection) {
      // Element-scoped scroll: scroll <selector> <direction> [px]
      const selector = first;
      const dir = args[1].toLowerCase();
      const pixels = parseInt(args[2], 10) || 400;
      const result = await cdp.send('Runtime.evaluate', {
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
        returnByValue: true,
      });
      const val = result.result.value;
      if (val && val.error) { console.error(val.error); process.exit(1); }
      console.log(`Scrolled ${val.dir} within ${val.tag} ${selector}`);
    } else {
      // Treat as CSS selector — scroll element into view
      const result = await cdp.send('Runtime.evaluate', {
        expression: `
          (function() {
            const el = document.querySelector(${JSON.stringify(first)});
            if (!el) return { error: 'Element not found: ' + ${JSON.stringify(first)} };
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            return { tag: el.tagName.toLowerCase() };
          })()
        `,
        returnByValue: true,
      });
      const val = result.result.value;
      if (val && val.error) { console.error(val.error); process.exit(1); }
      console.log(`Scrolled to ${val.tag} ${first}`);
    }
    await new Promise(r => setTimeout(r, 100));
    console.log(await getPageBrief(cdp));
  });
}

async function cmdEval(expression) {
  if (!expression) { console.error('Usage: webact.js eval <js-expression>'); process.exit(1); }

  await withCDP(async (cdp) => {
    const contextId = await getFrameContextId(cdp);
    const evalOpts = { expression, returnByValue: false, awaitPromise: true };
    if (contextId !== undefined) evalOpts.contextId = contextId;
    // Evaluate the raw expression first (no wrapping — avoids quote/escaping issues)
    const result = await cdp.send('Runtime.evaluate', evalOpts);
    if (result.exceptionDetails) {
      console.error('Error:', result.exceptionDetails.text || result.exceptionDetails.exception?.description);
      process.exit(1);
    }
    const r = result.result;
    if (r.type === 'undefined') {
      // Silent for side-effect calls like .click() — no noisy output
    } else if (r.type === 'object' && r.objectId) {
      // Serialize object results by calling JSON.stringify on the remote object
      const serOpts = {
        expression: `JSON.stringify(this, (k, v) => v instanceof HTMLElement ? v.outerHTML.slice(0, 200) : v, 2)`,
        objectId: r.objectId,
        returnByValue: true,
      };
      const ser = await cdp.send('Runtime.callFunctionOn', serOpts);
      if (ser.result.value !== undefined) {
        console.log(ser.result.value);
      } else {
        console.log(r.description || `(${r.type})`);
      }
    } else if (r.value !== undefined) {
      console.log(r.value);
    } else {
      console.log(r.description || `(${r.type})`);
    }
  });
}

async function cmdTabs() {
  const allTabs = await getDebugTabs();
  const state = loadSessionState();
  const ownedIds = new Set(state.tabs || []);
  const owned = allTabs.filter(t => ownedIds.has(t.id));
  if (owned.length === 0) {
    console.log('No tabs owned by this session.');
    return;
  }
  for (const t of owned) {
    const active = t.id === state.activeTabId ? ' *' : '';
    console.log(`[${t.id}] ${t.title || '(untitled)'} - ${t.url}${active}`);
  }
}

async function cmdTab(id) {
  if (!id) { console.error('Usage: webact.js tab <id>'); process.exit(1); }
  const state = loadSessionState();
  if (!(state.tabs || []).includes(id)) {
    console.error(`Tab ${id} is not owned by this session.`);
    process.exit(1);
  }
  const allTabs = await getDebugTabs();
  const tab = allTabs.find(t => t.id === id);
  if (!tab) { console.error(`Tab ${id} not found in Chrome`); process.exit(1); }

  state.activeTabId = id;
  saveSessionState(state);

  // Activate the tab in Chrome
  await httpPut(`http://${CDP_HOST}:${CDP_PORT}/json/activate/${id}`);
  console.log(`Switched to tab: ${tab.title || tab.url}`);
}

async function cmdNewTab(url) {
  const newTab = await createNewTab(url);
  const state = loadSessionState();
  state.tabs.push(newTab.id);
  state.activeTabId = newTab.id;
  saveSessionState(state);
  console.log(`New tab: [${newTab.id}] ${newTab.url}`);
}

async function cmdClose() {
  const state = loadSessionState();
  if (!state.activeTabId) { console.error('No active tab'); process.exit(1); }

  const tabId = state.activeTabId;
  await httpPut(`http://${CDP_HOST}:${CDP_PORT}/json/close/${tabId}`);

  // Remove from session
  state.tabs = (state.tabs || []).filter(id => id !== tabId);
  state.activeTabId = state.tabs.length > 0 ? state.tabs[state.tabs.length - 1] : null;
  saveSessionState(state);

  console.log(`Closed tab ${tabId}`);
  if (state.activeTabId) {
    console.log(`Active tab is now: ${state.activeTabId}`);
  } else {
    console.log('No tabs remaining in this session.');
  }
}

// --- Tier 1: axtree, cookies, back/forward/reload, rightclick, key combos, clear, pdf ---

// Helper: resolve textContent from DOM for AX nodes with empty names
// Caller must ensure DOM.enable has been called before invoking this.
// entries: [{ backendDOMNodeId, idx }] — idx is used as key in returned Map
// Returns Map<idx, string> of resolved text content (trimmed, max 80 chars)
async function resolveTextContent(cdp, entries) {
  if (entries.length === 0) return new Map();
  const capped = entries.slice(0, 200);
  const results = new Map();
  await Promise.all(capped.map(async ({ backendDOMNodeId, idx }) => {
    try {
      const resolved = await cdp.send('DOM.resolveNode', { backendNodeId: backendDOMNodeId });
      if (!resolved.object?.objectId) return;
      const r = await cdp.send('Runtime.callFunctionOn', {
        objectId: resolved.object.objectId,
        functionDeclaration: 'function() { var t = (this.textContent || "").trim(); if (!t) t = this.getAttribute("aria-label") || ""; return t.trim().substring(0, 80); }',
        returnByValue: true,
      });
      const text = r.result?.value;
      if (text) results.set(idx, text);
    } catch {}
  }));
  return results;
}

// Helper: fetch interactive elements, generate ref map, cache results
// Called from within a withCDP callback — receives the cdp connection
async function fetchInteractiveElements(cdp) {
  const INTERACTIVE_ROLES = new Set([
    'button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio',
    'switch', 'slider', 'spinbutton', 'tab', 'menuitem', 'menuitemcheckbox',
    'menuitemradio', 'option', 'listbox', 'tree', 'treeitem',
  ]);

  // Get current URL for cache key
  const urlResult = await cdp.send('Runtime.evaluate', {
    expression: 'location.href', returnByValue: true,
  });
  const currentUrl = urlResult.result.value;
  let cacheKey;
  try { const u = new URL(currentUrl); cacheKey = u.hostname + u.pathname; }
  catch { cacheKey = currentUrl; }

  // Check action cache
  const actionCache = loadActionCache();
  const cached = actionCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    const refs = Object.entries(cached.refMap);
    const checkRefs = refs.slice(0, Math.min(3, refs.length));
    let valid = checkRefs.length > 0;
    for (const [, sel] of checkRefs) {
      try {
        const check = await cdp.send('Runtime.evaluate', {
          expression: `!!document.querySelector(${JSON.stringify(sel)})`,
          returnByValue: true,
        });
        if (!check.result?.value) { valid = false; break; }
      } catch { valid = false; break; }
    }
    if (valid) {
      const state = loadSessionState();
      state.refMap = cached.refMap;
      state.refMapUrl = currentUrl;
      state.refMapTimestamp = cached.timestamp;
      saveSessionState(state);
      return { elements: cached.elements, refMap: cached.refMap, output: cached.output };
    }
  }

  // Fresh AX tree walk
  await cdp.send('Accessibility.enable');
  const axResult = await cdp.send('Accessibility.getFullAXTree');
  const nodes = axResult.nodes;
  const nodeMap = new Map();
  for (const n of nodes) nodeMap.set(n.nodeId, n);

  // Collect interactive nodes
  const interactiveNodes = [];
  function walk(node) {
    const role = node.role?.value || '';
    if (INTERACTIVE_ROLES.has(role)) interactiveNodes.push(node);
    for (const cid of (node.childIds || [])) {
      const child = nodeMap.get(cid);
      if (child) walk(child);
    }
  }
  if (nodes[0]) walk(nodes[0]);

  // Build output lines + elements array, track nameless nodes
  const elements = [];
  const outputLines = [];
  const namelessIndices = new Set();
  for (let i = 0; i < interactiveNodes.length; i++) {
    const node = interactiveNodes[i];
    const role = node.role?.value || '';
    const name = String(node.name?.value ?? '');
    const value = String(node.value?.value ?? '');
    let line = `[${i + 1}] ${role}`;
    if (name) line += ` "${name.substring(0, 80)}"`;
    if (value) line += ` val="${value.substring(0, 40)}"`;
    const props = {};
    for (const p of (node.properties || [])) {
      if (p.name === 'disabled' && p.value?.value) props.disabled = true;
      if (p.name === 'checked') props.checked = p.value?.value;
      if (p.name === 'expanded') props.expanded = p.value?.value;
      if (p.name === 'selected' && p.value?.value) props.selected = true;
    }
    const propStr = Object.entries(props).map(([k,v]) => `${k}=${v}`).join(' ');
    if (propStr) line += ` [${propStr}]`;
    outputLines.push(line);
    elements.push({ role, name, value });
    if (!name) namelessIndices.add(i);
  }

  // Inject selector generator and resolve CSS selectors (+textContent for nameless) in parallel
  await cdp.send('Runtime.evaluate', { expression: SELECTOR_GEN_SCRIPT });
  await cdp.send('DOM.enable');
  const refMap = {};
  await Promise.all(interactiveNodes.map(async (node, i) => {
    try {
      if (!node.backendDOMNodeId) return;
      const resolved = await cdp.send('DOM.resolveNode', { backendNodeId: node.backendDOMNodeId });
      if (!resolved.object?.objectId) return;
      if (namelessIndices.has(i)) {
        const sResult = await cdp.send('Runtime.callFunctionOn', {
          objectId: resolved.object.objectId,
          functionDeclaration: 'function() { var s = window.__webactGenSelector(this); var t = (this.textContent || "").trim(); if (!t) t = this.getAttribute("aria-label") || ""; return { selector: s, textContent: t.trim().substring(0, 80) }; }',
          returnByValue: true,
        });
        const val = sResult.result?.value;
        if (val?.selector) refMap[i + 1] = val.selector;
        if (val?.textContent) {
          elements[i].name = val.textContent;
          const rolePrefix = `[${i + 1}] ${elements[i].role}`;
          outputLines[i] = rolePrefix + ` "${val.textContent}"` + outputLines[i].substring(rolePrefix.length);
        }
      } else {
        const sResult = await cdp.send('Runtime.callFunctionOn', {
          objectId: resolved.object.objectId,
          functionDeclaration: 'function() { return window.__webactGenSelector(this); }',
          returnByValue: true,
        });
        if (sResult.result?.value) refMap[i + 1] = sResult.result.value;
      }
    } catch {}
  }));

  let output = outputLines.join('\n') + (outputLines.length ? '\n' : '');
  if (output.length > 6000) {
    output = output.substring(0, 6000) + '\n... (truncated)';
  }

  await cdp.send('Accessibility.disable');

  // Save ref map to session state
  const state = loadSessionState();
  state.prevElements = state.currentElements || null;
  state.currentElements = elements.map((el, i) => ({ ref: i + 1, ...el }));
  state.refMap = refMap;
  state.refMapUrl = currentUrl;
  state.refMapTimestamp = Date.now();
  saveSessionState(state);

  // Save to action cache
  actionCache[cacheKey] = { refMap, elements, output, timestamp: Date.now() };
  saveActionCache(actionCache);

  return { elements, refMap, output };
}

function diffElements(prev, curr) {
  if (!prev) return null;
  const prevMap = new Map(prev.map(e => [e.ref, e]));
  const currMap = new Map(curr.map(e => [e.ref, e]));
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

async function cmdAxtree(selector, interactiveOnly, showDiff, maxTokens) {
  await withCDP(async (cdp) => {
    // Fast path: interactive-only without selector — uses cache + ref map
    if (interactiveOnly && !selector) {
      const data = await fetchInteractiveElements(cdp);
      if (showDiff) {
        const state = loadSessionState();
        const diff = diffElements(state.prevElements, state.currentElements);
        if (!diff) {
          console.log('(no previous snapshot to diff against)');
          console.log(data.output || '(no interactive elements found)');
        } else if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
          console.log('(no changes since last snapshot)');
        } else {
          let out = '';
          if (diff.added.length) out += 'ADDED:\n' + diff.added.map(e => `  + [${e.ref}] ${e.role} "${e.name}"`).join('\n') + '\n';
          if (diff.removed.length) out += 'REMOVED:\n' + diff.removed.map(e => `  - [${e.ref}] ${e.role} "${e.name}"`).join('\n') + '\n';
          if (diff.changed.length) out += 'CHANGED:\n' + diff.changed.map(c => `  ~ [${c.ref}] ${c.to.role} "${c.to.name}" (was: "${c.from.name}")`).join('\n') + '\n';
          out += `(${diff.added.length} added, ${diff.removed.length} removed, ${diff.changed.length} changed)`;
          console.log(out);
        }
        return;
      }

      let output = data.output || '(no interactive elements found)';
      if (maxTokens > 0) {
        const charBudget = maxTokens * 4;
        if (output.length > charBudget) {
          output = output.substring(0, charBudget) + '\n... (truncated to ~' + maxTokens + ' tokens)';
        }
      }
      console.log(output);
      return;
    }

    await cdp.send('Accessibility.enable');

    let nodes;
    if (selector) {
      const objResult = await cdp.send('Runtime.evaluate', {
        expression: `document.querySelector(${JSON.stringify(selector)})`,
      });
      if (!objResult.result.objectId) {
        console.error(`Element not found: ${selector}`);
        process.exit(1);
      }
      const result = await cdp.send('Accessibility.queryAXTree', {
        objectId: objResult.result.objectId,
      });
      nodes = result.nodes;
    } else {
      const result = await cdp.send('Accessibility.getFullAXTree');
      nodes = result.nodes;
    }

    const SKIP_ROLES = new Set(['InlineTextBox', 'LineBreak']);
    const PASS_THROUGH_ROLES = new Set(['none', 'generic']);
    const INTERACTIVE_ROLES = new Set([
      'button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio',
      'switch', 'slider', 'spinbutton', 'tab', 'menuitem', 'menuitemcheckbox',
      'menuitemradio', 'option', 'listbox', 'tree', 'treeitem',
    ]);
    const nodeMap = new Map();
    for (const n of nodes) nodeMap.set(n.nodeId, n);

    if (interactiveOnly) {
      // Flat list of interactive elements with indices — token-efficient
      let idx = 1;
      const outputLines = [];
      const namelessEntries = [];
      function collectInteractive(node) {
        const role = node.role?.value || '';
        if (INTERACTIVE_ROLES.has(role)) {
          const name = String(node.name?.value ?? '');
          const value = String(node.value?.value ?? '');
          let line = `[${idx}] ${role}`;
          if (name) line += ` "${name.substring(0, 80)}"`;
          if (value) line += ` val="${value.substring(0, 40)}"`;
          const props = {};
          for (const p of (node.properties || [])) {
            if (p.name === 'disabled' && p.value?.value) props.disabled = true;
            if (p.name === 'checked') props.checked = p.value?.value;
            if (p.name === 'expanded') props.expanded = p.value?.value;
            if (p.name === 'selected' && p.value?.value) props.selected = true;
          }
          const propStr = Object.entries(props).map(([k,v]) => `${k}=${v}`).join(' ');
          if (propStr) line += ` [${propStr}]`;
          const lineIdx = outputLines.length;
          outputLines.push(line);
          if (!name && node.backendDOMNodeId) {
            namelessEntries.push({ backendDOMNodeId: node.backendDOMNodeId, idx: lineIdx, refIdx: idx, role });
          }
          idx++;
        }
        for (const cid of (node.childIds || [])) {
          const child = nodeMap.get(cid);
          if (child) collectInteractive(child);
        }
      }
      if (nodes[0]) collectInteractive(nodes[0]);

      // Resolve textContent for nameless interactive nodes
      if (namelessEntries.length > 0) {
        await cdp.send('DOM.enable');
        const resolved = await resolveTextContent(cdp, namelessEntries);
        for (const entry of namelessEntries) {
          const text = resolved.get(entry.idx);
          if (text) {
            const rolePrefix = `[${entry.refIdx}] ${entry.role}`;
            outputLines[entry.idx] = rolePrefix + ` "${text}"` + outputLines[entry.idx].substring(rolePrefix.length);
          }
        }
      }

      let output = outputLines.join('\n') + (outputLines.length ? '\n' : '');
      if (output.length > 6000) {
        output = output.substring(0, 6000) + '\n... (truncated)';
      }
      console.log(output || '(no interactive elements found)');
    } else {
      // Full tree format
      const RESOLVE_ROLES = new Set([...INTERACTIVE_ROLES, 'heading', 'img', 'cell', 'columnheader', 'rowheader']);
      const namelessNodes = [];

      function formatNode(node, depth) {
        const role = node.role?.value || '';
        if (SKIP_ROLES.has(role)) return '';

        const name = String(node.name?.value ?? '');
        const value = String(node.value?.value ?? '');
        const isPassThrough = PASS_THROUGH_ROLES.has(role) && !name;

        let out = '';

        if (!isPassThrough) {
          if (role === 'StaticText') {
            const indent = '  '.repeat(Math.min(depth, 6));
            if (name.length > 80) {
              out += `${indent}- text "${name.substring(0, 80)}..."\n`;
            }
            return out;
          }

          const indent = '  '.repeat(Math.min(depth, 6));
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
          for (const p of (node.properties || [])) {
            if (p.name === 'disabled' && p.value?.value) props.disabled = true;
            if (p.name === 'required' && p.value?.value) props.required = true;
            if (p.name === 'checked') props.checked = p.value?.value;
            if (p.name === 'expanded') props.expanded = p.value?.value;
            if (p.name === 'selected' && p.value?.value) props.selected = true;
          }
          const propStr = Object.entries(props).map(([k,v]) => `${k}=${v}`).join(' ');
          if (propStr) line += ` [${propStr}]`;

          out += line + '\n';
        }

        const childIds = node.childIds || [];
        for (const cid of childIds) {
          const child = nodeMap.get(cid);
          if (child) out += formatNode(child, isPassThrough ? depth : depth + 1);
        }
        return out;
      }

      const root = nodes[0];
      let output = '';
      if (root) {
        output = formatNode(root, 0);
      }

      // Resolve textContent for nameless nodes with meaningful roles
      if (namelessNodes.length > 0) {
        await cdp.send('DOM.enable');
        const resolved = await resolveTextContent(cdp, namelessNodes);
        for (const entry of namelessNodes) {
          const text = resolved.get(entry.idx);
          if (text) {
            output = output.replace(entry.placeholder, `"${text}"`);
          } else {
            output = output.replace(` ${entry.placeholder}`, '');
          }
        }
      }

      if (output.length > 6000) {
        output = output.substring(0, 6000) + '\n... (truncated)';
      }
      console.log(output || '(empty accessibility tree)');
    }

    await cdp.send('Accessibility.disable');
  });
}

async function cmdObserve() {
  await withCDP(async (cdp) => {
    const data = await fetchInteractiveElements(cdp);
    if (data.elements.length === 0) {
      console.log('(no interactive elements found)');
      return;
    }

    let output = '';
    for (let i = 0; i < data.elements.length; i++) {
      const el = data.elements[i];
      const ref = i + 1;
      const desc = `${el.role}${el.name ? ' "' + el.name.substring(0, 60) + '"' : ''}`;
      let cmd;
      switch (el.role) {
        case 'textbox':
        case 'searchbox':
          cmd = `type ${ref} <text>`;
          break;
        case 'combobox':
        case 'listbox':
          cmd = `select ${ref} <value>`;
          break;
        case 'slider':
        case 'spinbutton':
          cmd = `type ${ref} <value>`;
          break;
        default:
          cmd = `click ${ref}`;
      }
      output += `[${ref}] ${cmd}  — ${desc}\n`;
    }
    console.log(output.trimEnd());
  });
}

async function cmdFind(query) {
  if (!query) { console.error('Usage: webact find <query>\nExample: webact find "login button"'); process.exit(1); }

  await withCDP(async (cdp) => {
    const data = await fetchInteractiveElements(cdp);
    if (data.elements.length === 0) {
      console.error('No interactive elements found. Navigate to a page first.');
      process.exit(1);
    }

    const STOPWORDS = new Set(['the', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'is', 'it', 'and', 'or', 'this', 'that']);
    function tokenize(str) {
      return str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 1 && !STOPWORDS.has(t));
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
            if (et.includes(t) || t.includes(et)) { intersection += 0.5; break; }
          }
        }
      }
      const union = new Set([...queryTokens, ...elTokens]).size;
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
    const confidence = best.score >= 0.5 ? 'high' : best.score >= 0.25 ? 'medium' : 'low';
    console.log(`Best: [${best.ref}] ${best.el.role} "${best.el.name}" (${confidence} confidence, score:${best.score.toFixed(2)})`);
    if (topK.length > 1) {
      const others = topK.slice(1).map(m => `  [${m.ref}] ${m.el.role} "${m.el.name}" (${m.score.toFixed(2)})`);
      console.log('Also:\n' + others.join('\n'));
    }
  });
}

async function cmdCookies(action, ...args) {
  if (!action) {
    // Default: get all cookies for current page
    action = 'get';
  }

  switch (action.toLowerCase()) {
    case 'get': {
      await withCDP(async (cdp) => {
        const result = await cdp.send('Network.getCookies');
        if (result.cookies.length === 0) {
          console.log('No cookies.');
          return;
        }
        for (const c of result.cookies) {
          const flags = [];
          if (c.httpOnly) flags.push('httpOnly');
          if (c.secure) flags.push('secure');
          if (c.session) flags.push('session');
          const exp = c.expires > 0 ? new Date(c.expires * 1000).toISOString().split('T')[0] : '';
          console.log(`${c.name}=${c.value.substring(0, 60)}${c.value.length > 60 ? '...' : ''} (${c.domain}${exp ? ' exp:' + exp : ''} ${flags.join(' ')})`);
        }
      });
      break;
    }
    case 'set': {
      if (args.length < 2) {
        console.error('Usage: webact.js cookies set <name> <value> [domain]');
        process.exit(1);
      }
      const [name, value, domain] = args;
      await withCDP(async (cdp) => {
        const cookieDomain = domain || await cdp.send('Runtime.evaluate', {
          expression: 'location.hostname', returnByValue: true,
        }).then(r => r.result.value);

        await cdp.send('Network.setCookie', {
          name, value, domain: cookieDomain, path: '/',
        });
        console.log(`Cookie set: ${name}=${value.substring(0, 40)} (${cookieDomain})`);
      });
      break;
    }
    case 'clear': {
      await withCDP(async (cdp) => {
        await cdp.send('Network.clearBrowserCookies');
        console.log('All cookies cleared.');
      });
      break;
    }
    case 'delete': {
      if (!args[0]) {
        console.error('Usage: webact.js cookies delete <name> [domain]');
        process.exit(1);
      }
      await withCDP(async (cdp) => {
        const domain = args[1] || await cdp.send('Runtime.evaluate', {
          expression: 'location.hostname', returnByValue: true,
        }).then(r => r.result.value);

        await cdp.send('Network.deleteCookies', { name: args[0], domain });
        console.log(`Deleted cookie: ${args[0]} (${domain})`);
      });
      break;
    }
    default:
      console.error('Usage: webact.js cookies [get|set|clear|delete] [args]');
      process.exit(1);
  }
}

async function cmdBack() {
  await withCDP(async (cdp) => {
    const nav = await cdp.send('Page.getNavigationHistory');
    if (nav.currentIndex <= 0) {
      console.error('No previous page in history.');
      process.exit(1);
    }
    const entry = nav.entries[nav.currentIndex - 1];
    await cdp.send('Page.navigateToHistoryEntry', { entryId: entry.id });
    await new Promise(r => setTimeout(r, 500));
    console.log(await getPageBrief(cdp));
  });
}

async function cmdForward() {
  await withCDP(async (cdp) => {
    const nav = await cdp.send('Page.getNavigationHistory');
    if (nav.currentIndex >= nav.entries.length - 1) {
      console.error('No next page in history.');
      process.exit(1);
    }
    const entry = nav.entries[nav.currentIndex + 1];
    await cdp.send('Page.navigateToHistoryEntry', { entryId: entry.id });
    await new Promise(r => setTimeout(r, 500));
    console.log(await getPageBrief(cdp));
  });
}

async function cmdReload() {
  await withCDP(async (cdp) => {
    await cdp.send('Page.reload');
    // Wait for load
    const start = Date.now();
    while (Date.now() - start < 15000) {
      await new Promise(r => setTimeout(r, 300));
      const result = await cdp.send('Runtime.evaluate', {
        expression: 'document.readyState'
      });
      if (result.result && result.result.value === 'complete') break;
    }
    console.log(await getPageBrief(cdp));
  });
}

async function cmdRightClick(selector) {
  if (!selector) { console.error('Usage: webact.js rightclick <selector>'); process.exit(1); }

  await withCDP(async (cdp) => {
    const loc = await locateElement(cdp, selector);

    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: loc.x, y: loc.y, button: 'right', clickCount: 1
    });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: loc.x, y: loc.y, button: 'right', clickCount: 1
    });

    console.log(`Right-clicked ${loc.tag.toLowerCase()} "${loc.text}"`);
    await new Promise(r => setTimeout(r, 150));
    console.log(await getPageBrief(cdp));
  });
}

async function cmdClear(selector) {
  if (!selector) { console.error('Usage: webact.js clear <selector>'); process.exit(1); }

  await withCDP(async (cdp) => {
    const result = await cdp.send('Runtime.evaluate', {
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
      awaitPromise: true,
    });
    const val = result.result.value;
    if (val.error) { console.error(val.error); process.exit(1); }
    console.log(`Cleared ${val.tag.toLowerCase()} ${selector}`);
  });
}

async function cmdPdf(outputPath) {
  const outFile = outputPath || path.join(TMP, `webact-page-${currentSessionId || 'default'}.pdf`);

  await withCDP(async (cdp) => {
    const result = await cdp.send('Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: true,
    });
    fs.writeFileSync(outFile, Buffer.from(result.data, 'base64'));
    console.log(`PDF saved to ${outFile}`);
  });
}

// Parse key combo strings like "Ctrl+A", "Shift+Enter", "Meta+C"
function parseKeyCombo(combo) {
  const parts = combo.split('+');
  const modifiers = { ctrl: false, alt: false, shift: false, meta: false };
  let key = '';

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') modifiers.ctrl = true;
    else if (lower === 'alt' || lower === 'option') modifiers.alt = true;
    else if (lower === 'shift') modifiers.shift = true;
    else if (lower === 'meta' || lower === 'cmd' || lower === 'command') modifiers.meta = true;
    else key = part;
  }

  return { modifiers, key };
}

// --- Tier 2: console, network blocking, viewport, frames, download, scroll improvements ---

async function cmdConsole(action) {
  if (!action) action = 'show';

  if (action === 'show' || action === 'errors') {
    await withCDP(async (cdp) => {
      await cdp.send('Runtime.enable');
      const logs = [];
      let collecting = true;

      cdp.on('Runtime.consoleAPICalled', (params) => {
        if (!collecting) return;
        const type = params.type; // log, warn, error, info
        if (action === 'errors' && type !== 'error') return;
        const text = params.args.map(a => a.value || a.description || '').join(' ');
        logs.push(`[${type}] ${text.substring(0, 200)}`);
      });

      cdp.on('Runtime.exceptionThrown', (params) => {
        if (!collecting) return;
        const desc = params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || 'Unknown error';
        logs.push(`[exception] ${desc.substring(0, 200)}`);
      });

      // Wait briefly to collect any pending logs
      await new Promise(r => setTimeout(r, 1000));
      collecting = false;

      if (logs.length === 0) {
        console.log('No console output captured (listened for 1s).');
      } else {
        console.log(logs.join('\n'));
      }
    });
  } else if (action === 'listen') {
    // Long-running listener — prints in real time until Ctrl+C
    await withCDP(async (cdp) => {
      await cdp.send('Runtime.enable');
      console.log('Listening for console output (Ctrl+C to stop)...');

      cdp.on('Runtime.consoleAPICalled', (params) => {
        const type = params.type;
        const text = params.args.map(a => a.value || a.description || '').join(' ');
        console.log(`[${type}] ${text.substring(0, 500)}`);
      });

      cdp.on('Runtime.exceptionThrown', (params) => {
        const desc = params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || 'Unknown error';
        console.log(`[exception] ${desc.substring(0, 500)}`);
      });

      // Keep alive until process is killed
      await new Promise(() => {});
    });
  } else {
    console.error('Usage: webact.js console [show|errors|listen]');
    process.exit(1);
  }
}

async function cmdNetwork(action, ...args) {
  if (!action) action = 'capture';
  const logFile = path.join(TMP, `webact-network-${currentSessionId || 'default'}.json`);

  switch (action) {
    case 'capture': {
      // Capture network requests for N seconds, optionally filtered by URL substring
      const duration = parseInt(args[0], 10) || 10;
      const filter = args[1] || null;
      await withCDP(async (cdp) => {
        await cdp.send('Network.enable');
        const requests = [];
        const startTime = Date.now();

        cdp.on('Network.requestWillBeSent', (params) => {
          if (filter && !params.request.url.includes(filter)) return;
          requests.push({
            id: params.requestId,
            method: params.request.method,
            url: params.request.url,
            type: params.type || '',
            time: Date.now() - startTime,
            postData: params.request.postData ? params.request.postData.substring(0, 2000) : undefined,
          });
        });

        cdp.on('Network.responseReceived', (params) => {
          const req = requests.find(r => r.id === params.requestId);
          if (req) {
            req.status = params.response.status;
            req.statusText = params.response.statusText;
            req.mimeType = params.response.mimeType;
          }
        });

        console.log(`Capturing network for ${duration}s${filter ? ` (filter: "${filter}")` : ''}...`);
        await new Promise(r => setTimeout(r, duration * 1000));

        for (const r of requests) {
          const status = r.status ? ` [${r.status}]` : ' [pending]';
          console.log(`${r.method} ${r.url.substring(0, 150)}${status} (${r.type || '?'}) +${r.time}ms`);
          if (r.postData) console.log(`  body: ${r.postData.substring(0, 200)}`);
        }
        console.log(`\n${requests.length} requests captured`);
        fs.writeFileSync(logFile, JSON.stringify(requests, null, 2));
      });
      break;
    }
    case 'show': {
      if (!fs.existsSync(logFile)) {
        console.error('No captured requests. Run "network capture" first.');
        process.exit(1);
      }
      const requests = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
      const filter = args[0] || null;
      const filtered = filter ? requests.filter(r => r.url.includes(filter)) : requests;
      for (const r of filtered) {
        const status = r.status ? ` [${r.status}]` : ' [pending]';
        console.log(`${r.method} ${r.url.substring(0, 150)}${status} (${r.type || '?'}) +${r.time}ms`);
        if (r.postData) console.log(`  body: ${r.postData.substring(0, 200)}`);
      }
      console.log(`\n${filtered.length} requests${filter ? ` matching "${filter}"` : ''}`);
      break;
    }
    default:
      console.error('Usage: webact network [capture [seconds] [filter]|show [filter]]');
      process.exit(1);
  }
}

const ADBLOCK_PATTERNS = [
  'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
  'googlesyndication.com', 'googleadservices.com', 'doubleclick.net',
  'facebook.com/tr', 'connect.facebook.net', 'fbevents.js',
  'analytics.twitter.com', 'ads-twitter.com',
  'segment.io', 'segment.com', 'mixpanel.com', 'amplitude.com',
  'hotjar.com', 'fullstory.com', 'heapanalytics.com', 'mouseflow.com',
  'crazyegg.com', 'newrelic.com', 'nr-data.net',
  'adnxs.com', 'openx.net', 'pubmatic.com', 'rubiconproject.com',
  'amazon-adsystem.com', 'criteo.com', 'criteo.net',
  'taboola.com', 'outbrain.com', 'revcontent.com',
  'marketo.com', 'marketo.net', 'pardot.com',
  'cookielaw.org', 'cookiebot.com', 'onetrust.com', 'trustarc.com',
  'scorecardresearch.com', 'quantserve.com', 'chartbeat.com',
  'optimizely.com', 'demdex.net', 'addthis.com', 'sharethis.com',
];

async function cmdBlock(...patterns) {
  if (patterns.length === 0) {
    console.error('Usage: webact.js block <pattern> [pattern2...]\nPatterns: images, css, fonts, media, scripts, or URL substring\nUse "block off" to disable blocking.');
    process.exit(1);
  }

  const state = loadSessionState();

  if (patterns[0] === 'off') {
    delete state.blockPatterns;
    saveSessionState(state);
    console.log('Request blocking disabled.');
    return;
  }

  // Handle --ads preset
  if (patterns.includes('--ads') || patterns.includes('ads')) {
    const otherPatterns = patterns.filter(p => p !== '--ads' && p !== 'ads');
    const RESOURCE_TYPES = { 'images': 'Image', 'css': 'Stylesheet', 'fonts': 'Font', 'media': 'Media', 'scripts': 'Script' };
    const allUrlPatterns = [...ADBLOCK_PATTERNS];
    const resourceTypes = [];
    for (const p of otherPatterns) {
      if (RESOURCE_TYPES[p.toLowerCase()]) {
        resourceTypes.push(RESOURCE_TYPES[p.toLowerCase()]);
      } else {
        allUrlPatterns.push(p);
      }
    }
    state.blockPatterns = { resourceTypes, urlPatterns: allUrlPatterns };
    saveSessionState(state);
    console.log(`Blocking: ads/trackers (${ADBLOCK_PATTERNS.length} patterns)${otherPatterns.length ? ' + ' + otherPatterns.join(', ') : ''}. Takes effect on next page load.`);
    return;
  }

  // Expand shorthand patterns to resource types
  const RESOURCE_TYPES = {
    'images': 'Image',
    'css': 'Stylesheet',
    'fonts': 'Font',
    'media': 'Media',
    'scripts': 'Script',
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
  saveSessionState(state);

  console.log(`Blocking: ${patterns.join(', ')}. Takes effect on next page load.`);
}

async function cmdViewport(width, height) {
  if (!width) {
    console.error('Usage: webact.js viewport <width> <height>\nPresets: mobile (375x667), tablet (768x1024), desktop (1280x800)');
    process.exit(1);
  }

  // Handle presets
  const presets = {
    'mobile': { w: 375, h: 667, dpr: 2, mobile: true },
    'iphone': { w: 390, h: 844, dpr: 3, mobile: true },
    'ipad': { w: 820, h: 1180, dpr: 2, mobile: true },
    'tablet': { w: 768, h: 1024, dpr: 2, mobile: true },
    'desktop': { w: 1280, h: 800, dpr: 1, mobile: false },
  };

  let w, h, dpr = 1, mobile = false;
  const preset = presets[width.toLowerCase()];
  if (preset) {
    w = preset.w; h = preset.h; dpr = preset.dpr; mobile = preset.mobile;
  } else {
    w = parseInt(width, 10);
    h = parseInt(height, 10) || Math.round(w * 0.625); // 16:10 default
    if (isNaN(w)) {
      console.error('Invalid width. Use a number or preset: mobile, tablet, desktop');
      process.exit(1);
    }
  }

  await withCDP(async (cdp) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: w, height: h, deviceScaleFactor: dpr, mobile,
    });
    console.log(`Viewport set to ${w}x${h} (dpr:${dpr}${mobile ? ' mobile' : ''})`);
  });
}

async function cmdFrames() {
  await withCDP(async (cdp) => {
    const tree = await cdp.send('Page.getFrameTree');

    function printFrame(frame, depth) {
      const indent = '  '.repeat(depth);
      const name = frame.frame.name ? ` name="${frame.frame.name}"` : '';
      const id = frame.frame.id;
      console.log(`${indent}[${id}]${name} ${frame.frame.url}`);
      for (const child of (frame.childFrames || [])) {
        printFrame(child, depth + 1);
      }
    }

    await cdp.send('Page.enable');
    printFrame(tree.frameTree, 0);
  });
}

async function cmdFrame(frameIdOrSelector) {
  if (!frameIdOrSelector) {
    console.error('Usage: webact.js frame <frameId|selector>\nUse "webact.js frames" to list available frames.\nUse "webact.js frame main" to return to main frame.');
    process.exit(1);
  }

  const state = loadSessionState();

  if (frameIdOrSelector === 'main' || frameIdOrSelector === 'top') {
    delete state.activeFrameId;
    saveSessionState(state);
    console.log('Switched to main frame.');
    return;
  }

  await withCDP(async (cdp) => {
    await cdp.send('Page.enable');
    const tree = await cdp.send('Page.getFrameTree');

    // Try to find frame by ID or name
    function findFrame(node) {
      if (node.frame.id === frameIdOrSelector || node.frame.name === frameIdOrSelector) {
        return node.frame;
      }
      for (const child of (node.childFrames || [])) {
        const found = findFrame(child);
        if (found) return found;
      }
      return null;
    }

    let frame = findFrame(tree.frameTree);

    // If not found by ID/name, try CSS selector to find iframe element
    if (!frame) {
      const result = await cdp.send('Runtime.evaluate', {
        expression: `
          (function() {
            const el = document.querySelector(${JSON.stringify(frameIdOrSelector)});
            if (!el || (el.tagName !== 'IFRAME' && el.tagName !== 'FRAME')) return null;
            return { name: el.getAttribute('name') || null, id: el.id || null, src: el.src || null };
          })()
        `,
        returnByValue: true,
      });
      const info = result.result.value;
      if (info) {
        // Try matching by name or id first
        if (info.name || info.id) {
          const nameOrId = info.name || info.id;
          function findFrameByNameOrId(node) {
            if (node.frame.id === nameOrId || node.frame.name === nameOrId) return node.frame;
            for (const child of (node.childFrames || [])) {
              const found = findFrameByNameOrId(child);
              if (found) return found;
            }
            return null;
          }
          frame = findFrameByNameOrId(tree.frameTree);
        }
        // Fallback: match by URL (handles iframes without name/id)
        if (!frame && info.src) {
          function findFrameByUrl(node, url) {
            if (node.frame.url === url) return node.frame;
            for (const child of (node.childFrames || [])) {
              const found = findFrameByUrl(child, url);
              if (found) return found;
            }
            return null;
          }
          frame = findFrameByUrl(tree.frameTree, info.src);
        }
      }
    }

    if (!frame) {
      console.error(`Frame not found: ${frameIdOrSelector}`);
      process.exit(1);
    }

    state.activeFrameId = frame.id;
    saveSessionState(state);
    console.log(`Switched to frame: [${frame.id}] ${frame.url}`);
  });
}

async function cmdDownload(action, ...args) {
  if (!action) action = 'path';

  const state = loadSessionState();
  const downloadDir = state.downloadDir || path.join(TMP, 'webact-downloads');

  switch (action.toLowerCase()) {
    case 'path': {
      const dir = args[0] || downloadDir;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      state.downloadDir = dir;
      saveSessionState(state);

      await withCDP(async (cdp) => {
        await cdp.send('Browser.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: dir,
        });
      });
      console.log(`Downloads will be saved to: ${dir}`);
      break;
    }
    case 'list': {
      if (!fs.existsSync(downloadDir)) {
        console.log('No downloads directory.');
        return;
      }
      const files = fs.readdirSync(downloadDir);
      if (files.length === 0) {
        console.log('No downloaded files.');
      } else {
        for (const f of files) {
          const stat = fs.statSync(path.join(downloadDir, f));
          const size = stat.size > 1048576 ? `${(stat.size / 1048576).toFixed(1)}MB` :
                       stat.size > 1024 ? `${(stat.size / 1024).toFixed(0)}KB` : `${stat.size}B`;
          console.log(`${f} (${size})`);
        }
      }
      break;
    }
    default:
      console.error('Usage: webact.js download [path <dir>|list]');
      process.exit(1);
  }
}

async function cmdActivate() {
  const state = loadSessionState();
  const browserName = state.browserName || findBrowser()?.name;
  if (!browserName) { console.error('Cannot determine browser.'); return; }
  activateBrowser(browserName);
  console.log(`Brought ${browserName} to front.`);
}

async function cmdMinimize() {
  const state = loadSessionState();
  const browserName = state.browserName || findBrowser()?.name;
  if (!browserName) { console.error('Cannot determine browser.'); return; }
  minimizeBrowser(browserName);
  console.log(`Minimized ${browserName}.`);
}

async function cmdLock(ttlSeconds) {
  const ttl = parseInt(ttlSeconds, 10) || 300;
  const state = loadSessionState();
  if (!state.activeTabId) { console.error('No active tab'); process.exit(1); }

  const lock = checkTabLock(state.activeTabId);
  if (lock && lock.sessionId !== currentSessionId) {
    console.error(`Tab already locked by session ${lock.sessionId} (expires in ${Math.round((lock.expires - Date.now()) / 1000)}s)`);
    process.exit(1);
  }

  const locks = loadTabLocks();
  locks[state.activeTabId] = {
    sessionId: currentSessionId,
    expires: Date.now() + ttl * 1000,
  };
  saveTabLocks(locks);
  console.log(`Tab ${state.activeTabId} locked for ${ttl}s by session ${currentSessionId}`);
}

async function cmdUnlock() {
  const state = loadSessionState();
  if (!state.activeTabId) { console.error('No active tab'); process.exit(1); }

  const locks = loadTabLocks();
  const lock = locks[state.activeTabId];
  if (!lock) {
    console.log('Tab is not locked.');
    return;
  }
  if (lock.sessionId !== currentSessionId) {
    console.error(`Tab is locked by session ${lock.sessionId}, not yours.`);
    process.exit(1);
  }
  delete locks[state.activeTabId];
  saveTabLocks(locks);
  console.log(`Tab ${state.activeTabId} unlocked.`);
}

// --- Command dispatch ---

async function dispatch(command, args) {
  switch (command) {
    case 'launch': await cmdLaunch(); break;
    case 'connect': await cmdConnect(); break;
    case 'navigate': await cmdNavigate(args.join(' ')); break;
    case 'dom': {
      const tokensArg = args.find(a => a.startsWith('--tokens='));
      const maxTokens = tokensArg ? parseInt(tokensArg.split('=')[1], 10) : 0;
      const selectorArg = args.filter(a => a !== '--full' && !a.startsWith('--tokens=')).join(' ') || null;
      const selector = selectorArg ? resolveSelector(selectorArg) : null;
      await cmdDom(selector, maxTokens);
      break;
    }
    case 'screenshot': await cmdScreenshot(); break;
    case 'click': {
      const coords = parseCoordinates(args);
      if (coords) {
        await withCDP(async (cdp) => {
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: coords.x, y: coords.y });
          await new Promise(r => setTimeout(r, 80));
          await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: coords.x, y: coords.y, button: 'left', clickCount: 1 });
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: coords.x, y: coords.y, button: 'left', clickCount: 1 });
          console.log(`Clicked at (${coords.x}, ${coords.y})`);
          await new Promise(r => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else if (args[0] === '--text') {
        const text = args.slice(1).join(' ');
        if (!text) { console.error('Usage: webact click --text <text>'); process.exit(1); }
        await withCDP(async (cdp) => {
          const loc = await locateElementByText(cdp, text);
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: loc.x, y: loc.y });
          await new Promise(r => setTimeout(r, 80));
          await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: loc.x, y: loc.y, button: 'left', clickCount: 1 });
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: loc.x, y: loc.y, button: 'left', clickCount: 1 });
          console.log(`Clicked ${loc.tag.toLowerCase()} "${loc.text}" (text match)`);
          await new Promise(r => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else {
        await cmdClick(resolveSelector(args.join(' ')));
      }
      break;
    }
    case 'doubleclick': {
      const coords = parseCoordinates(args);
      if (coords) {
        await withCDP(async (cdp) => {
          await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: coords.x, y: coords.y, button: 'left', clickCount: 1 });
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: coords.x, y: coords.y, button: 'left', clickCount: 1 });
          await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: coords.x, y: coords.y, button: 'left', clickCount: 2 });
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: coords.x, y: coords.y, button: 'left', clickCount: 2 });
          console.log(`Double-clicked at (${coords.x}, ${coords.y})`);
          await new Promise(r => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else if (args[0] === '--text') {
        const text = args.slice(1).join(' ');
        if (!text) { console.error('Usage: webact doubleclick --text <text>'); process.exit(1); }
        await withCDP(async (cdp) => {
          const loc = await locateElementByText(cdp, text);
          await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: loc.x, y: loc.y, button: 'left', clickCount: 1 });
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: loc.x, y: loc.y, button: 'left', clickCount: 1 });
          await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: loc.x, y: loc.y, button: 'left', clickCount: 2 });
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: loc.x, y: loc.y, button: 'left', clickCount: 2 });
          console.log(`Double-clicked ${loc.tag.toLowerCase()} "${loc.text}" (text match)`);
          await new Promise(r => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else {
        await cmdDoubleClick(resolveSelector(args.join(' ')));
      }
      break;
    }
    case 'hover': {
      const coords = parseCoordinates(args);
      if (coords) {
        await withCDP(async (cdp) => {
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: coords.x, y: coords.y });
          console.log(`Hovered at (${coords.x}, ${coords.y})`);
          await new Promise(r => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else if (args[0] === '--text') {
        const text = args.slice(1).join(' ');
        if (!text) { console.error('Usage: webact hover --text <text>'); process.exit(1); }
        await withCDP(async (cdp) => {
          const loc = await locateElementByText(cdp, text);
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: loc.x, y: loc.y });
          console.log(`Hovered ${loc.tag.toLowerCase()} "${loc.text}" (text match)`);
          await new Promise(r => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else {
        await cmdHover(resolveSelector(args.join(' ')));
      }
      break;
    }
    case 'focus': await cmdFocus(resolveSelector(args.join(' '))); break;
    case 'type': {
      const selector = resolveSelector(args[0]);
      const text = args.slice(1).join(' ');
      await cmdType(selector, text);
      break;
    }
    case 'keyboard': await cmdKeyboard(args.join(' ')); break;
    case 'paste': await cmdPaste(args.join(' ')); break;
    case 'select': await cmdSelect(resolveSelector(args[0]), ...args.slice(1)); break;
    case 'upload': await cmdUpload(resolveSelector(args[0]), ...args.slice(1)); break;
    case 'drag': await cmdDrag(resolveSelector(args[0]), resolveSelector(args[1])); break;
    case 'dialog': await cmdDialog(args[0], args.slice(1).join(' ') || undefined); break;
    case 'waitfor': await cmdWaitFor(resolveSelector(args[0]), args[1]); break;
    case 'waitfornav': await cmdWaitForNavigation(args[0]); break;
    case 'press': await cmdPress(args[0]); break;
    case 'scroll': await cmdScroll(args); break;
    case 'eval': await cmdEval(args.join(' ')); break;
    case 'tabs': await cmdTabs(); break;
    case 'tab': await cmdTab(args[0]); break;
    case 'newtab': await cmdNewTab(args.join(' ') || undefined); break;
    case 'close': await cmdClose(); break;
    case 'axtree': {
      const interactive = args.includes('--interactive') || args.includes('-i');
      const diff = args.includes('--diff');
      const tokensArg = args.find(a => a.startsWith('--tokens='));
      const maxTokens = tokensArg ? parseInt(tokensArg.split('=')[1], 10) : 0;
      const selector = args.filter(a => !['--interactive', '-i', '--diff'].includes(a) && !a.startsWith('--tokens=')).join(' ') || null;
      await cmdAxtree(selector, interactive, diff, maxTokens);
      break;
    }
    case 'cookies': await cmdCookies(args[0], ...args.slice(1)); break;
    case 'back': await cmdBack(); break;
    case 'forward': await cmdForward(); break;
    case 'reload': await cmdReload(); break;
    case 'rightclick': {
      const coords = parseCoordinates(args);
      if (coords) {
        await withCDP(async (cdp) => {
          await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: coords.x, y: coords.y, button: 'right', clickCount: 1 });
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: coords.x, y: coords.y, button: 'right', clickCount: 1 });
          console.log(`Right-clicked at (${coords.x}, ${coords.y})`);
          await new Promise(r => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else if (args[0] === '--text') {
        const text = args.slice(1).join(' ');
        if (!text) { console.error('Usage: webact rightclick --text <text>'); process.exit(1); }
        await withCDP(async (cdp) => {
          const loc = await locateElementByText(cdp, text);
          await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: loc.x, y: loc.y, button: 'right', clickCount: 1 });
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: loc.x, y: loc.y, button: 'right', clickCount: 1 });
          console.log(`Right-clicked ${loc.tag.toLowerCase()} "${loc.text}" (text match)`);
          await new Promise(r => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else {
        await cmdRightClick(resolveSelector(args.join(' ')));
      }
      break;
    }
    case 'clear': await cmdClear(resolveSelector(args.join(' '))); break;
    case 'observe': await cmdObserve(); break;
    case 'find': await cmdFind(args.join(' ')); break;
    case 'pdf': await cmdPdf(args[0]); break;
    case 'console': await cmdConsole(args[0]); break;
    case 'network': await cmdNetwork(args[0], ...args.slice(1)); break;
    case 'block': await cmdBlock(...args); break;
    case 'viewport': await cmdViewport(args[0], args[1]); break;
    case 'frames': await cmdFrames(); break;
    case 'frame': await cmdFrame(args[0]); break;
    case 'download': await cmdDownload(args[0], ...args.slice(1)); break;
    case 'activate': await cmdActivate(); break;
    case 'minimize': await cmdMinimize(); break;
    case 'humanclick': {
      const coords = parseCoordinates(args);
      if (coords) {
        await withCDP(async (cdp) => {
          await humanClick(cdp, coords.x, coords.y);
          console.log(`Human-clicked at (${coords.x}, ${coords.y})`);
          await new Promise(r => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else if (args[0] === '--text') {
        const text = args.slice(1).join(' ');
        if (!text) { console.error('Usage: webact humanclick --text <text>'); process.exit(1); }
        await withCDP(async (cdp) => {
          const loc = await locateElementByText(cdp, text);
          await humanClick(cdp, loc.x, loc.y);
          console.log(`Human-clicked ${loc.tag.toLowerCase()} "${loc.text}" (text match)`);
          await new Promise(r => setTimeout(r, 150));
          console.log(await getPageBrief(cdp));
        });
      } else {
        await cmdHumanClick(resolveSelector(args.join(' ')));
      }
      break;
    }
    case 'humantype': {
      const selector = resolveSelector(args[0]);
      const text = args.slice(1).join(' ');
      await cmdHumanType(selector, text);
      break;
    }
    case 'lock': await cmdLock(args[0]); break;
    case 'unlock': await cmdUnlock(); break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

// --- CLI ---

async function main() {
  const [,, command, ...args] = process.argv;

  if (command === '--version' || command === '-v') {
    console.log(VERSION);
    process.exit(0);
  }

  if (!command) {
    console.log(`webact v${VERSION} - Browser automation via Chrome DevTools Protocol

Usage: webact <command> [args]

Commands:
  launch              Launch Chrome and start a session
  connect             Attach to already-running Chrome (no launch)
  navigate <url>      Navigate to URL
  back                Go back in history
  forward             Go forward in history
  reload              Reload the current page
  dom [selector]      Get compact DOM (--tokens=N to limit output)
  axtree [selector]   Get accessibility tree (semantic roles + names)
  axtree -i           Interactive elements with ref numbers (enables ref-based targeting)
  axtree -i --diff    Show only changes since last snapshot
  axtree -i --tokens=N  Truncate output to ~N tokens
  observe             Show interactive elements as ready-to-use commands
  find <query>        Find element by description (e.g. find "login button")
  screenshot          Capture screenshot
  pdf [path]          Save page as PDF
  click <sel|x,y|--text> Click element, coordinates, or text match
  doubleclick <sel|x,y|--text> Double-click element, coordinates, or text
  rightclick <sel|x,y|--text>  Right-click element, coordinates, or text
  hover <sel|x,y|--text>       Hover element, coordinates, or text
  focus <selector>    Focus an element without clicking
  clear <selector>    Clear an input field or contenteditable
  type <sel> <text>   Type text into element (focuses selector first)
  keyboard <text>     Type text at current caret position (no selector)
  paste <text>        Paste text via ClipboardEvent (for rich editors)
  select <sel> <val>  Select option(s) from a <select> by value or label
  upload <sel> <file> Upload file(s) to a file input
  drag <from> <to>    Drag from one element to another
  dialog <accept|dismiss> [text]  Handle alert/confirm/prompt dialog
  waitfor <sel> [ms]  Wait for element to appear (default 5000ms)
  waitfornav [ms]     Wait for page navigation to complete (default 10000ms)
  press <key>         Press a key or combo (Enter, Ctrl+A, Meta+C, etc.)
  scroll <target> [px] Scroll: up, down, top, bottom, or CSS selector [pixels]
  scroll <sel> <dir> [px] Scroll within element: up, down, top, bottom [pixels]
  eval <js>           Evaluate JavaScript
  cookies [get|set|clear|delete]  Manage browser cookies
  console [show|errors|listen]    View console output or JS errors
  block <pattern>     Block requests: images, css, fonts, media, scripts, or URL
  block --ads         Block ads, analytics, and tracking (50+ patterns)
  block off           Disable request blocking
  viewport <w> <h>    Set viewport size (or preset: mobile, tablet, desktop, iphone, ipad)
  frames              List all frames/iframes on the page
  frame <id|sel>      Switch to a frame (use "frame main" to return)
  download [path|list] Set download dir or list downloaded files
  tabs                List this session's tabs
  tab <id>            Switch to a session-owned tab
  newtab [url]        Open a new tab in this session
  close               Close current tab
  lock [seconds]      Lock active tab for exclusive access (default 300s)
  unlock              Release tab lock
  activate            Bring browser window to front (macOS)
  minimize            Minimize browser window (macOS)
  humanclick <sel|x,y|--text>  Click with human-like mouse movement (anti-bot)
  humantype <sel> <text>       Type with variable delays and occasional typos`);
    process.exit(0);
  }

  try {
    // Set port from env for standalone commands (non-launch, non-run)
    if (process.env.CDP_PORT) {
      CDP_PORT = parseInt(process.env.CDP_PORT, 10);
    }

    if (command === 'run') {
      const sessionId = args[0];
      if (!sessionId) {
        console.error('Usage: webact.js run <sessionId>');
        process.exit(1);
      }
      currentSessionId = sessionId;

      // Restore port and host from session state
      const state = loadSessionState();
      if (state.port) CDP_PORT = state.port;
      if (state.host) CDP_HOST = state.host;

      // Inline command: node webact.js run <sid> navigate https://example.com
      if (args.length > 1) {
        await dispatch(args[1], args.slice(2));
      } else {
        // File-based command (supports chaining via arrays)
        const cmdFile = path.join(TMP, `webact-command-${sessionId}.json`);
        let cmdData;
        try {
          cmdData = JSON.parse(fs.readFileSync(cmdFile, 'utf8'));
        } catch (e) {
          console.error(`Cannot read ${cmdFile}: ${e.message}`);
          process.exit(1);
        }
        const commands = Array.isArray(cmdData) ? cmdData : [cmdData];
        for (const cmd of commands) {
          if (!cmd.command) {
            console.error(`Missing "command" field in: ${JSON.stringify(cmd)}`);
            process.exit(1);
          }
          await dispatch(cmd.command, cmd.args || []);
        }
      }
    } else if (command !== 'launch' && command !== 'connect') {
      // Direct command: auto-discover last session
      try {
        const lastSid = fs.readFileSync(LAST_SESSION_FILE, 'utf8').trim();
        currentSessionId = lastSid;
        const state = loadSessionState();
        if (state.port) CDP_PORT = state.port;
        if (state.host) CDP_HOST = state.host;
      } catch {
        console.error('No active session. Run: node webact.js launch');
        process.exit(1);
      }
      await dispatch(command, args);
    } else {
      await dispatch(command, args);
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

main();
