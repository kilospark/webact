pub const ADBLOCK_PATTERNS: &[&str] = &[
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
    "sharethis.com",
];

pub const PAGE_BRIEF_SCRIPT: &str = r#"(function() {
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
  if (inputs.length) r += '\n' + inputs.join(' ');
  if (buttons.length) r += '\n' + buttons.join(' ');
  if (links.length) r += '\nLinks: ' + links.join(', ');
  const counts = [];
  if (totalInputs > inputs.length) counts.push(totalInputs + ' inputs');
  if (totalButtons > buttons.length) counts.push(totalButtons + ' buttons');
  if (totalLinks > links.length) counts.push(totalLinks + ' links');
  if (counts.length) r += '\n(' + counts.join(', ') + ' total — use dom or axtree for full list)';
  return r;
})()"#;

pub const SELECTOR_GEN_SCRIPT: &str = r#"if (!window.__webactGenSelector) {
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
}"#;

pub const DOM_EXTRACT_TEMPLATE: &str = r#"
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
      const text = node.textContent.replace(/\s+/g, ' ').trim();
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

    if (showTag && childOut.includes('\n')) {
      out += indent + '</' + tag.toLowerCase() + '>\n';
    } else if (showTag) {
      out += '</' + tag.toLowerCase() + '>\n';
    }

    return out;
  }

  const root = __WEBACT_ROOT__;
  if (!root) return 'ERROR: Element not found' + (__WEBACT_SELECTOR_SUFFIX__);
  return extract(root, 0);
})()
"#;

pub const READ_EXTRACT_TEMPLATE: &str = r#"
(function() {
  const SKIP = new Set(['SCRIPT','STYLE','SVG','NOSCRIPT','LINK','META','HEAD','NAV','FOOTER','ASIDE']);
  const BLOCK = new Set(['P','DIV','SECTION','ARTICLE','H1','H2','H3','H4','H5','H6','LI','TR','BLOCKQUOTE','PRE','DT','DD','FIGCAPTION','HEADER']);
  const HEADING = new Set(['H1','H2','H3','H4','H5','H6']);

  function isVisible(el) {
    if (el.offsetParent === null && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (style.position !== 'fixed' && style.position !== 'sticky') return false;
    }
    return true;
  }

  function findMain(root) {
    const main = root.querySelector('main,[role=main],article,.article,.post,.content,.entry-content,#content,#main');
    if (main && main.textContent.trim().length > 200) return main;
    return null;
  }

  function extract(node, lines, depth) {
    if (!node) return;
    if (node.nodeType === 3) {
      const t = node.textContent.replace(/\s+/g, ' ').trim();
      if (t) {
        if (lines.length && !lines[lines.length-1].endsWith('\n')) {
          lines[lines.length-1] += ' ' + t;
        } else {
          lines.push(t);
        }
      }
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (SKIP.has(tag)) return;
    if (!isVisible(node)) return;

    if (HEADING.has(tag)) {
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      if (text) {
        const level = parseInt(tag[1]);
        lines.push('#'.repeat(Math.min(level, 3)) + ' ' + text + '\n');
      }
      return;
    }
    if (tag === 'LI') {
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      if (text) lines.push('- ' + text.substring(0, 200) + '\n');
      return;
    }
    if (tag === 'TR') {
      const cells = [...node.querySelectorAll('td,th')].map(c => c.textContent.replace(/\s+/g,' ').trim().substring(0,60));
      if (cells.length && cells.some(c => c)) lines.push(cells.join(' | ') + '\n');
      return;
    }
    if (tag === 'IMG') {
      const alt = node.getAttribute('alt');
      if (alt) lines.push('[image: ' + alt.substring(0, 80) + ']\n');
      return;
    }
    if (tag === 'A') {
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      if (text && text.length < 200) {
        if (lines.length && !lines[lines.length-1].endsWith('\n')) {
          lines[lines.length-1] += ' ' + text;
        } else {
          lines.push(text);
        }
      }
      return;
    }

    const isBlock = BLOCK.has(tag);
    for (const child of node.childNodes) extract(child, lines, depth + 1);
    if (node.shadowRoot) for (const child of node.shadowRoot.childNodes) extract(child, lines, depth + 1);
    if (isBlock && lines.length && !lines[lines.length-1].endsWith('\n')) {
      lines[lines.length-1] += '\n';
    }
  }

  const root = __WEBACT_ROOT__;
  if (!root) return 'ERROR: Element not found' + (__WEBACT_SELECTOR_SUFFIX__);
  const contentRoot = findMain(root) || root;
  const lines = [];
  extract(contentRoot, lines, 0);
  return lines.join('').replace(/\n{3,}/g, '\n\n').trim();
})()
"#;

pub const TEXT_EXTRACT_TEMPLATE: &str = r#"
(function() {
  __WEBACT_SELECTOR_GEN__

  const SKIP = new Set(['SCRIPT','STYLE','SVG','NOSCRIPT','LINK','META','HEAD']);
  const INTERACTIVE_SEL = 'a,button,input,textarea,select,[role=button],[role=link],[role=textbox],[role=checkbox],[role=radio],[tabindex]:not([tabindex="-1"])';
  const HEADING = new Set(['H1','H2','H3','H4','H5','H6']);

  function isVisible(el) {
    if (el.offsetParent === null && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (style.position !== 'fixed' && style.position !== 'sticky') return false;
    }
    return true;
  }

  function defaultRole(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'button') return 'button';
    if (tag === 'input') {
      const t = (el.type || 'text').toLowerCase();
      if (t === 'checkbox') return 'checkbox';
      if (t === 'radio') return 'radio';
      if (t === 'submit' || t === 'button') return 'button';
      return 'textbox';
    }
    if (tag === 'textarea') return 'textbox';
    if (tag === 'select') return 'combobox';
    return '';
  }

  const interactiveSet = new Set();
  const refMap = {};
  let refCounter = 0;
  const lines = [];

  function getName(el) {
    return (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.value || el.id || el.name || '').replace(/\s+/g,' ').trim().substring(0, 100);
  }

  function processInteractive(el) {
    if (interactiveSet.has(el)) return null;
    interactiveSet.add(el);
    refCounter++;
    const sel = window.__webactGenSelector(el);
    const role = (el.getAttribute('role') || defaultRole(el) || '').trim();
    const name = getName(el);
    refMap[String(refCounter)] = sel;
    return { ref: refCounter, role, name, selector: sel, tag: el.tagName.toLowerCase() };
  }

  function walk(node) {
    if (!node) return;
    if (node.nodeType === 3) {
      const t = node.textContent.replace(/\s+/g, ' ').trim();
      if (t) lines.push(t);
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (SKIP.has(tag)) return;
    if (!isVisible(node)) return;

    if (node.matches && node.matches(INTERACTIVE_SEL)) {
      const info = processInteractive(node);
      if (info) {
        const label = info.name ? info.role + ' "' + info.name.substring(0, 60) + '"' : info.role;
        lines.push('[' + info.ref + '] ' + label);
      }
      return;
    }

    if (HEADING.has(tag)) {
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      if (text) lines.push('#'.repeat(parseInt(tag[1])) + ' ' + text);
      return;
    }

    for (const child of node.childNodes) walk(child);
    if (node.shadowRoot) for (const child of node.shadowRoot.childNodes) walk(child);
  }

  const root = __WEBACT_ROOT__;
  if (!root) return JSON.stringify({ error: 'Element not found' + (__WEBACT_SELECTOR_SUFFIX__) });
  walk(root);
  return JSON.stringify({ lines: lines, refMap: refMap });
})()
"#;

pub const AXTREE_INTERACTIVE_SCRIPT: &str = r#"
(function() {
  __WEBACT_SELECTOR_GEN__

  function isVisible(el) {
    if (el.offsetParent === null && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (style.position !== 'fixed' && style.position !== 'sticky') return false;
    }
    return true;
  }

  function defaultRole(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'button') return 'button';
    if (tag === 'input') {
      const t = (el.type || 'text').toLowerCase();
      if (t === 'checkbox') return 'checkbox';
      if (t === 'radio') return 'radio';
      if (t === 'submit' || t === 'button') return 'button';
      return 'textbox';
    }
    if (tag === 'textarea') return 'textbox';
    if (tag === 'select') return 'combobox';
    return '';
  }

  const selector = 'a,button,input,textarea,select,[role=button],[role=link],[role=textbox],[role=checkbox],[role=radio],[tabindex]:not([tabindex="-1"])';
  const out = [];
  const seen = new Set();

  function walk(root) {
    for (const el of root.querySelectorAll(selector)) {
      if (!isVisible(el)) continue;
      const sel = window.__webactGenSelector(el);
      if (!sel || seen.has(sel)) continue;
      seen.add(sel);

      const role = (el.getAttribute('role') || defaultRole(el) || '').trim();
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const aria = (el.getAttribute('aria-label') || '').trim();
      const placeholder = (el.getAttribute('placeholder') || '').trim();
      const value = typeof el.value === 'string' ? el.value.trim() : '';
      const name = (aria || text || placeholder || value || el.id || el.name || '').substring(0, 100);

      out.push({
        selector: sel,
        role,
        name,
        tag: el.tagName.toLowerCase(),
        href: el.getAttribute('href') || '',
        type: el.getAttribute('type') || '',
      });
      if (out.length >= 250) return;
    }

    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot);
      if (out.length >= 250) return;
    }
  }

  walk(document);
  return out;
})()
"#;

pub const DISMISS_POPUPS_SCRIPT: &str = r#"(function() {
    const selectors = [
        '#onetrust-accept-btn-handler',
        '#CookieBoxSaveButton',
        '[data-testid="cookie-policy-manage-dialog-accept-button"]',
        '.cc-accept', '.cc-dismiss',
        '#accept-cookies', '#cookie-accept',
        '#cookie-consent-accept', '#cookies-accept',
        '[data-cookiefirst-action="accept"]',
        '.js-cookie-consent-agree',
        '#truste-consent-button',
        '#didomi-notice-agree-button',
    ];
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) { el.click(); return 'dismissed:' + sel; }
    }
    const textPatterns = [
        /^accept\s*(all|cookies)?$/i,
        /^(i\s+)?agree$/i,
        /^got\s*it$/i,
        /^(ok|okay)$/i,
        /^allow\s*(all|cookies)?$/i,
        /^close$/i,
    ];
    const buttons = document.querySelectorAll('button, [role="button"], a.button, a.btn');
    for (const btn of buttons) {
        const text = (btn.textContent || '').trim();
        if (text.length > 30) continue;
        for (const pat of textPatterns) {
            if (pat.test(text) && btn.offsetParent !== null) {
                btn.click();
                return 'dismissed:text:' + text;
            }
        }
    }
    return 'none';
})()"#;
