const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const readline = require('readline');
const { version: VERSION } = require('./package.json');
const TOOLS = require('./tools.json');
let MCP_INSTRUCTIONS = '';
try { MCP_INSTRUCTIONS = fs.readFileSync(path.join(__dirname, 'MCP_INSTRUCTIONS.md'), 'utf8'); } catch {}

const {
  IS_WSL,
  getWSLHostIP,
  wslWindowsPath,
  findBrowser: findBrowserRaw,
  minimizeBrowser: minimizeBrowserRaw,
  activateBrowser: activateBrowserRaw,
} = require('./lib/browser');
const createStateStore = require('./lib/state');
const {
  findFreePort,
  httpGet: httpGetRaw,
  httpPut: httpPutRaw,
  getDebugTabs: getDebugTabsRaw,
  createNewTab: createNewTabRaw,
  createCDP: createCDPRaw,
} = require('./lib/cdp');
const {
  SELECTOR_GEN_SCRIPT,
  getPageBrief,
} = require('./lib/page');
const {
  parseCoordinates,
  parseKeyCombo,
  humanClick,
  humanTypeText,
} = require('./lib/input');
const {
  getFrameContextId: getFrameContextIdRaw,
  locateElement: locateElementRaw,
  locateElementByText: locateElementByTextRaw,
} = require('./lib/locator');
const createAxCommands = require('./lib/commands/ax');
const createExtendedCommands = require('./lib/commands/extended');
const createBaseCommands = require('./lib/commands/base');
const createInteractionCommands = require('./lib/commands/interactions');

// --- Temp directory (cross-platform) ---
const TMP = os.tmpdir();

// --- CDP port (resolved at runtime) ---
let CDP_PORT = 9222;

// CDP host: in WSL2, localhost forwarding may or may not work.
let CDP_HOST = '127.0.0.1';

async function resolveCDPHost() {
  if (!IS_WSL) return;
  try {
    await httpGet(`http://127.0.0.1:${CDP_PORT}/json/version`);
    return;
  } catch {}
  const hostIP = getWSLHostIP();
  if (hostIP) {
    try {
      await httpGet(`http://${hostIP}:${CDP_PORT}/json/version`);
      CDP_HOST = hostIP;
      return;
    } catch {}
  }
}

// --- Session state ---
let currentSessionId = null;
const stateStore = createStateStore(TMP);

const LAST_SESSION_FILE = stateStore.lastSessionFile;

function sessionStateFile() {
  return stateStore.sessionStateFile(currentSessionId);
}

function loadSessionState() {
  return stateStore.loadSessionState(currentSessionId);
}

function saveSessionState(state) {
  stateStore.saveSessionState(currentSessionId, state);
}

// --- Ref-based targeting ---

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

const CACHE_TTL = stateStore.cacheTtl;

function loadActionCache() {
  return stateStore.loadActionCache();
}

function saveActionCache(cache) {
  stateStore.saveActionCache(cache);
}

// --- Tab locking ---
function loadTabLocks() {
  return stateStore.loadTabLocks();
}

function saveTabLocks(locks) {
  stateStore.saveTabLocks(locks);
}

function checkTabLock(tabId) {
  return stateStore.checkTabLock(tabId);
}

// --- CDP Connection ---

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
    tab = tabs.find(t => t.id === state.activeTabId);
    if (!tab) {
      for (const ownedId of state.tabs) {
        tab = tabs.find(t => t.id === ownedId);
        if (tab) break;
      }
    }
  }

  if (!tab || !tab.webSocketDebuggerUrl) {
    throw new Error('No active tab for this session. Navigate to a URL first.');
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
    throw new Error(`Tab is locked by session ${lock.sessionId} (expires in ${Math.round((lock.expires - Date.now()) / 1000)}s). Use a different tab or wait.`);
  }
  let wsUrl = tab.webSocketDebuggerUrl;
  if (IS_WSL && CDP_HOST !== '127.0.0.1') {
    wsUrl = wsUrl.replace('127.0.0.1', CDP_HOST);
  }
  const cdp = await createCDP(wsUrl);
  try {
    const state = loadSessionState();

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

async function locateElement(cdp, selector) {
  const contextId = await getFrameContextId(cdp);
  return await locateElementRaw(cdp, selector, contextId);
}

async function locateElementByText(cdp, text) {
  const contextId = await getFrameContextId(cdp);
  return await locateElementByTextRaw(cdp, text, contextId);
}

// --- Browser detection ---

function findBrowser() {
  return findBrowserRaw();
}

function minimizeBrowser(browserName) {
  return minimizeBrowserRaw(browserName);
}

function activateBrowser(browserName) {
  return activateBrowserRaw(browserName);
}

let launchBrowserName = null;

async function cmdLaunch() {
  const userDataDir = path.join(TMP, 'webact-chrome-profile');
  const portFile = path.join(userDataDir, '.webact-port');

  if (IS_WSL) await resolveCDPHost();

  try {
    const savedPort = parseInt(fs.readFileSync(portFile, 'utf8').trim(), 10);
    if (savedPort) {
      CDP_PORT = savedPort;
      await getDebugTabs();
      launchBrowserName = findBrowser()?.name || null;
      console.log(`Browser already running.`);
      return cmdConnect();
    }
  } catch {
    try { fs.unlinkSync(portFile); } catch {}
  }

  if (process.env.CDP_PORT) {
    CDP_PORT = parseInt(process.env.CDP_PORT, 10);
  } else {
    CDP_PORT = await findFreePort();
  }

  const browser = findBrowser();
  if (!browser) {
    throw new Error('No Chromium-based browser found. Install one of: Google Chrome, Microsoft Edge, Brave, Chromium, Arc, Vivaldi, Opera. Or set CHROME_PATH to the browser executable.');
  }
  launchBrowserName = browser.name;

  let launchDataDir = userDataDir;
  const isWindowsBrowser = IS_WSL && browser.path.startsWith('/mnt/');

  if (isWindowsBrowser) {
    launchDataDir = wslWindowsPath(userDataDir);
  }

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

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      if (IS_WSL) await resolveCDPHost();
      await getDebugTabs();
      fs.writeFileSync(portFile, String(CDP_PORT));
      console.log(`${browser.name} launched successfully.`);
      minimizeBrowser(browser.name);
      return cmdConnect();
    } catch {}
  }
  throw new Error(`${browser.name} launched but debug port not responding after 15s.`);
}

async function cmdConnect() {
  currentSessionId = crypto.randomBytes(4).toString('hex');

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

  fs.writeFileSync(LAST_SESSION_FILE, currentSessionId);

  console.log(`Session: ${currentSessionId}`);
}

const {
  cmdNavigate,
  cmdDom,
  cmdScreenshot,
  cmdTabs,
  cmdTab,
  cmdNewTab,
  cmdClose,
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
  TMP,
});

const {
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
  cmdEval,
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
  path,
});

const {
  cmdAxtree,
  cmdObserve,
  cmdFind,
} = createAxCommands({
  withCDP,
  loadSessionState,
  saveSessionState,
  loadActionCache,
  saveActionCache,
  CACHE_TTL,
  SELECTOR_GEN_SCRIPT,
});

const {
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
  cmdUnlock,
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
  getCurrentSessionId: () => currentSessionId,
});

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
        if (!text) throw new Error('Usage: click --text <text>');
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
        if (!text) throw new Error('Usage: doubleclick --text <text>');
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
        if (!text) throw new Error('Usage: hover --text <text>');
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
        if (!text) throw new Error('Usage: rightclick --text <text>');
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
        if (!text) throw new Error('Usage: humanclick --text <text>');
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
      throw new Error(`Unknown command: ${command}`);
  }
}

// --- MCP Tool-to-command mapping ---

function mapToolToArgs(toolName, params) {
  const command = toolName.replace(/^webact_/, '');
  let args = [];

  switch (command) {
    case 'launch':
    case 'screenshot':
    case 'observe':
    case 'frames':
    case 'tabs':
    case 'close':
    case 'back':
    case 'forward':
    case 'reload':
    case 'activate':
    case 'minimize':
    case 'unlock':
      args = [];
      break;
    case 'navigate':
      args = [params.url];
      break;
    case 'dom': {
      const a = [];
      if (params.selector) a.push(params.selector);
      if (params.max_tokens) a.push('--tokens=' + params.max_tokens);
      args = a;
      break;
    }
    case 'axtree': {
      const a = [];
      if (params.interactive) a.push('-i');
      if (params.diff) a.push('--diff');
      if (params.selector) a.push(params.selector);
      if (params.max_tokens) a.push('--tokens=' + params.max_tokens);
      args = a;
      break;
    }
    case 'click':
    case 'doubleclick':
    case 'rightclick':
    case 'hover':
    case 'humanclick':
      args = params.target.split(' ');
      break;
    case 'type':
    case 'humantype':
      args = [params.selector, params.text];
      break;
    case 'keyboard':
    case 'paste':
      args = [params.text];
      break;
    case 'press':
      args = [params.key];
      break;
    case 'select':
      args = [params.selector, ...params.values];
      break;
    case 'upload':
      args = [params.selector, ...params.files];
      break;
    case 'drag':
      args = [params.from, params.to];
      break;
    case 'scroll': {
      const a = params.target.split(' ');
      if (params.pixels) a.push(String(params.pixels));
      args = a;
      break;
    }
    case 'eval':
      args = [params.expression];
      break;
    case 'dialog': {
      const a = [params.action];
      if (params.text) a.push(params.text);
      args = a;
      break;
    }
    case 'waitfor': {
      const a = [params.selector];
      if (params.timeout) a.push(String(params.timeout));
      args = a;
      break;
    }
    case 'waitfornav': {
      const a = [];
      if (params.timeout) a.push(String(params.timeout));
      args = a;
      break;
    }
    case 'cookies': {
      const a = [];
      if (params.action) a.push(params.action);
      if (params.name) a.push(params.name);
      if (params.value) a.push(params.value);
      if (params.domain) a.push(params.domain);
      args = a;
      break;
    }
    case 'console': {
      const a = [];
      if (params.action) a.push(params.action);
      args = a;
      break;
    }
    case 'network': {
      const a = [];
      if (params.action) a.push(params.action);
      if (params.duration) a.push(String(params.duration));
      if (params.filter) a.push(params.filter);
      args = a;
      break;
    }
    case 'block':
      args = params.patterns;
      break;
    case 'viewport': {
      const a = [params.preset_or_width];
      if (params.height) a.push(params.height);
      args = a;
      break;
    }
    case 'frame':
      args = [params.target];
      break;
    case 'tab':
      args = [params.id];
      break;
    case 'newtab': {
      const a = [];
      if (params.url) a.push(params.url);
      args = a;
      break;
    }
    case 'lock': {
      const a = [];
      if (params.seconds) a.push(String(params.seconds));
      args = a;
      break;
    }
    case 'download': {
      const a = [];
      if (params.action) a.push(params.action);
      if (params.path) a.push(params.path);
      args = a;
      break;
    }
    case 'find':
      args = [params.query];
      break;
    case 'pdf': {
      const a = [];
      if (params.path) a.push(params.path);
      args = a;
      break;
    }
    case 'focus':
      args = [params.selector];
      break;
    case 'clear':
      args = [params.selector];
      break;
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }

  return { command, args };
}

// --- Output capture ---

function captureOutput(fn) {
  const captured = [];
  const origLog = console.log;
  const origError = console.error;

  console.log = (...args) => {
    captured.push(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
  };
  console.error = (...args) => {
    captured.push(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
  };

  const restore = () => {
    console.log = origLog;
    console.error = origError;
  };

  return { captured, restore };
}

// --- Screenshot handling ---
// cmdScreenshot writes a PNG to disk and logs the path.
// We need to detect that and return image content instead.

function extractScreenshotPath(output) {
  for (const line of output) {
    const match = line.match(/^Screenshot saved to (.+\.png)$/);
    if (match) return match[1];
  }
  return null;
}

// --- Session auto-discovery for non-launch commands ---

function ensureSession() {
  if (currentSessionId) return;
  try {
    const lastSid = fs.readFileSync(LAST_SESSION_FILE, 'utf8').trim();
    currentSessionId = lastSid;
    const state = loadSessionState();
    if (state.port) CDP_PORT = state.port;
    if (state.host) CDP_HOST = state.host;
  } catch {
    throw new Error('No active session. Call webact_launch first.');
  }
}

// --- MCP JSON-RPC Server ---

function sendResponse(response) {
  const json = JSON.stringify(response);
  process.stdout.write(json + '\n');
}

async function handleRequest(msg) {
  // Notifications (no id) — ignore
  if (msg.id === undefined || msg.id === null) {
    return;
  }

  const { id, method, params } = msg;

  try {
    switch (method) {
      case 'initialize': {
        sendResponse({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2025-11-25',
            capabilities: { tools: {} },
            serverInfo: { name: 'webact', version: VERSION },
            instructions: MCP_INSTRUCTIONS,
          },
        });
        break;
      }

      case 'tools/list': {
        sendResponse({
          jsonrpc: '2.0',
          id,
          result: { tools: TOOLS },
        });
        break;
      }

      case 'tools/call': {
        const toolName = params.name;
        const toolParams = params.arguments || {};

        try {
          const { command, args } = mapToolToArgs(toolName, toolParams);

          // Set CDP_PORT from env if available
          if (process.env.CDP_PORT) {
            CDP_PORT = parseInt(process.env.CDP_PORT, 10);
          }

          // Auto-launch: if no session or Chrome not reachable, launch automatically
          if (command !== 'launch' && command !== 'connect') {
            // Try to restore existing session (don't throw if missing)
            try { ensureSession(); } catch {}

            let needsLaunch = !currentSessionId;
            if (!needsLaunch) {
              try { await getDebugTabs(); } catch { needsLaunch = true; }
            }
            if (needsLaunch) {
              process.stderr.write(`Auto-launching browser for ${command}...\n`);
              await dispatch('launch', []);
              process.stderr.write(`Auto-launch complete.\n`);
            }
          }

          const { captured, restore } = captureOutput();

          try {
            await dispatch(command, args);
          } finally {
            restore();
          }

          // Special case: screenshot returns image content
          if (command === 'screenshot') {
            const screenshotPath = extractScreenshotPath(captured);
            if (screenshotPath && fs.existsSync(screenshotPath)) {
              const base64 = fs.readFileSync(screenshotPath, 'base64');
              // Include any non-screenshot text output too
              const textLines = captured.filter(l => !l.startsWith('Screenshot saved to '));
              const content = [];
              if (textLines.length > 0) {
                content.push({ type: 'text', text: textLines.join('\n') });
              }
              content.push({ type: 'image', data: base64, mimeType: 'image/png' });
              sendResponse({
                jsonrpc: '2.0',
                id,
                result: { content },
              });
              return;
            }
          }

          const text = captured.join('\n');
          sendResponse({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: text || '(no output)' }],
            },
          });
        } catch (err) {
          sendResponse({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: `Error: ${err.message}` }],
              isError: true,
            },
          });
        }
        break;
      }

      default: {
        sendResponse({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        });
      }
    }
  } catch (err) {
    sendResponse({
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: err.message },
    });
  }
}

// --- Main ---

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

rl.on('line', async (line) => {
  line = line.trim();
  if (!line) return;

  try {
    const msg = JSON.parse(line);
    await handleRequest(msg);
  } catch (err) {
    sendResponse({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: `Parse error: ${err.message}` },
    });
  }
});

rl.on('close', () => {
  process.exit(0);
});
