/**
 * bildup-browser.js v0.2
 * Client-side renderer for .bu files. No compile step required.
 *
 * Usage:
 *   <script src="bildup-browser.js"></script>
 *   <script type="text/bildup" src="page.bu"></script>
 *
 * Or inline:
 *   <script type="text/bildup">
 *   # My Page
 *   ^C(crimson, obsidian, amber)
 *   ^primary[Hello]^
 *   ^C
 *   </script>
 *
 * Or programmatic:
 *   bildup.render(source).then(html => { ... })
 *   bildup.mount(source, document.getElementById('app'))
 */

(function (global) {
  'use strict';

  // ─── marked.js dependency check ─────────────────────────────────────────────
  // bildup-browser requires marked.js for markdown rendering.
  // Include it before this script: <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  function getMarked() {
    if (typeof marked === 'undefined') {
      throw new Error('[bildup] marked.js is required. Include it before bildup-browser.js.');
    }
    return typeof marked.parse === 'function' ? marked.parse.bind(marked) : marked;
  }

  // ─── Color palette ──────────────────────────────────────────────────────────
  const COLOR_MAP = {
    midnight: '#0d1117', snow:     '#f8f9fa', electric: '#00eeff',
    surface:  '#1e1e2e', muted:    '#6b7280',
    slate:    '#475569', cream:    '#fdf6e3', gold:     '#f59e0b',
    navy:     '#1e3a5f', coral:    '#ff6b6b', lime:     '#84cc16',
    crimson:  '#dc2626', obsidian: '#1c1c1e', amber:    '#f59e0b',
    red: 'red', blue: 'blue', green: 'green', black: 'black',
    white: 'white', orange: 'orange', purple: 'purple', pink: 'pink',
    teal: 'teal', cyan: 'cyan', yellow: 'yellow', gray: 'gray',
  };

  function resolveColor(name) {
    const n = (name || '').trim().toLowerCase();
    return COLOR_MAP[n] || n;
  }

  // ─── Palette stack ──────────────────────────────────────────────────────────
  /**
   * Purpose: A stack containing active color palettes scoped to document regions.
   * Authors: Antigravity
   * Timestamp: 2026-05-20
   * Footguns: None.
   * Usage Example:
   *   const p = new PaletteStack();
   */
  class PaletteStack {
    /**
     * Purpose: Initializes the stack with default values.
     * Authors: Antigravity
     * Timestamp: 2026-05-20
     * Footguns: None.
     * Usage Example: const p = new PaletteStack();
     */
    constructor() { this.stack = [null]; this.fromInline = [false]; }
    /**
     * Purpose: Pushes a new palette scope onto the stack.
     * Authors: Antigravity
     * Timestamp: 2026-05-20
     * Footguns: None.
     * Usage Example: p.push(['red', 'green', 'blue'], true);
     */
    push(colors, fromInline = false) {
      this.stack.push(colors);
      this.fromInline.push(fromInline);
    }
    /**
     * Purpose: Pops the current palette scope off the stack.
     * Authors: Antigravity
     * Timestamp: 2026-05-20
     * Footguns: None.
     * Usage Example: p.pop();
     */
    pop() {
      if (this.stack.length > 1) {
        this.stack.pop();
        this.fromInline.pop();
      }
    }
    /**
     * Purpose: Gets the active palette on top of the stack.
     * Authors: Antigravity
     * Timestamp: 2026-05-20
     * Footguns: None.
     * Usage Example: const pCurrent = p.current();
     */
    current() { return this.stack[this.stack.length - 1]; }
    /**
     * Purpose: Gets the color value for a slot (1, 2, 3) in the active palette.
     * Authors: Antigravity
     * Timestamp: 2026-05-20
     * Footguns: None.
     * Usage Example: const color = p.slot(1);
     */
    slot(n) { const p = this.current(); return p ? resolveColor(p[n - 1] || '') : null; }
    /**
     * Purpose: Returns the stack depth.
     * Authors: Antigravity
     * Timestamp: 2026-05-20
     * Footguns: None.
     * Usage Example: const d = p.depth();
     */
    depth() { return this.stack.length - 1; }
    /**
     * Purpose: Returns details of unclosed color regions still on the stack.
     * Authors: Antigravity
     * Timestamp: 2026-05-20
     * Footguns: None.
     * Usage Example: const list = p.unclosed();
     */
    unclosed() {
      const res = [];
      for (let i = 1; i < this.stack.length; i++) {
        res.push({ type: 'color region', palette: this.stack[i], fromInline: this.fromInline[i] });
      }
      return res;
    }
  }

  // ─── Style stack ────────────────────────────────────────────────────────────
  /**
   * Purpose: A stack containing active style layouts scoped to document regions.
   * Authors: Antigravity
   * Timestamp: 2026-05-20
   * Footguns: None.
   * Usage Example:
   *   const s = new StyleStack();
   */
  class StyleStack {
    /**
     * Purpose: Initializes the stack with default values.
     * Authors: Antigravity
     * Timestamp: 2026-05-20
     * Footguns: None.
     * Usage Example: const s = new StyleStack();
     */
    constructor() { this.stack = [{}]; this.fromInline = [false]; }
    /**
     * Purpose: Pushes a style region onto the stack.
     * Authors: Antigravity
     * Timestamp: 2026-05-20
     * Footguns: None.
     * Usage Example: s.push({ flex: true }, false);
     */
    push(attrs, fromInline = false) {
      this.stack.push(attrs);
      this.fromInline.push(fromInline);
    }
    /**
     * Purpose: Pops a style region off the stack.
     * Authors: Antigravity
     * Timestamp: 2026-05-20
     * Footguns: None.
     * Usage Example: s.pop();
     */
    pop() {
      if (this.stack.length > 1) {
        this.stack.pop();
        this.fromInline.pop();
      }
    }
    /**
     * Purpose: Returns stack depth.
     * Authors: Antigravity
     * Timestamp: 2026-05-20
     * Footguns: None.
     * Usage Example: const d = s.depth();
     */
    depth() { return this.stack.length - 1; }
    /**
     * Purpose: Returns all unclosed style regions still on the stack.
     * Authors: Antigravity
     * Timestamp: 2026-05-20
     * Footguns: None.
     * Usage Example: const list = s.unclosed();
     */
    unclosed() {
      const res = [];
      for (let i = 1; i < this.stack.length; i++) {
        res.push({ type: 'style region', fromInline: this.fromInline[i] });
      }
      return res;
    }
  }

  // ─── Attribute parser ────────────────────────────────────────────────────────
  /**
   * Purpose: Parses attribute tokens from a tag attribute string.
   * Authors: Antigravity
   * Timestamp: 2026-05-20
   * Footguns:
   *   - The splitting logic on '=' splits strictly at the first '=' to prevent issues with values containing '='.
   *   - Regexp handles hyphens and colons to support state names and namespaces.
   * Usage Example:
   *   const attrs = parseAttrs('state-empty="red-border" id="foo"');
   */
  function parseAttrs(str) {
    const attrs = {};
    if (!str) return attrs;
    const tokens = str.match(/([\w:-]+)=(?:"[^"]*"|\S+)|[\w:-]+/g) || [];
    for (const tok of tokens) {
      const idx = tok.indexOf('=');
      if (idx !== -1) {
        const k = tok.slice(0, idx);
        const v = tok.slice(idx + 1).replace(/^"|"$/g, '');
        attrs[k] = v;
      } else {
        attrs[tok] = true;
      }
    }
    return attrs;
  }

  // ─── Extra Attributes Serializer ──────────────────────────────────────────────
  /**
   * Purpose: Serializes state-* and show-if attributes into proper HTML data-* attributes.
   * Authors: Antigravity
   * Timestamp: 2026-05-20
   * Footguns:
   *   - Does not escape attribute values for HTML context; values should be safe strings.
   * Usage Example:
   *   const extra = renderExtraAttrs({ 'show-if': 'myinput', 'state-empty': 'red' });
   */
  function renderExtraAttrs(attrs) {
    const parts = [];
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('state-') || k === 'show-if') {
        const valStr = v === true ? '' : `="${v}"`;
        parts.push(`data-${k}${valStr}`);
      } else if (k.startsWith('data-')) {
        const valStr = v === true ? '' : `="${v}"`;
        parts.push(`${k}${valStr}`);
      }
    }
    return parts.length ? ' ' + parts.join(' ') : '';
  }

  // ─── Slot resolution ─────────────────────────────────────────────────────────
  const SLOT_NAMES = { primary: 1, secondary: 2, accent: 3 };

  function resolveValue(val, palette) {
    if (typeof val !== 'string') return val;
    const lower = val.toLowerCase();
    if (SLOT_NAMES[lower] !== undefined) return palette.slot(SLOT_NAMES[lower]);
    if (/^\^[123]$/.test(val)) return palette.slot(parseInt(val[1]));
    return resolveColor(val);
  }

  // ─── CSS builder ─────────────────────────────────────────────────────────────
  function attrsToCSS(attrs, palette) {
    const css = [];
    if (attrs.flex) css.push('display:flex');
    if (attrs.grid) css.push('display:grid');
    if (attrs.row)  css.push('flex-direction:row');
    if (attrs.col)  css.push('flex-direction:column');
    if (attrs.gap)  css.push(`gap:${parseFloat(attrs.gap) * 0.5}rem`);
    if (attrs.pad)  css.push(`padding:${parseFloat(attrs.pad) * 0.5}rem`);
    if (attrs.wrap) css.push('flex-wrap:wrap');
    if (attrs.bg) { const c = resolveValue(attrs.bg, palette); if (c) css.push(`background:${c}`); }
    if (attrs.fg) { const c = resolveValue(attrs.fg, palette); if (c) css.push(`color:${c}`); }
    return css.join(';');
  }

  // ─── Inline color ────────────────────────────────────────────────────────────
  function processInlineColor(text, palette) {
    text = text.replace(/\^(primary|secondary|accent)\[([^\]]*)\]\^/gi, (_, name, content) => {
      const color = palette.slot(SLOT_NAMES[name.toLowerCase()]);
      return color ? `<span style="color:${color}">${content}</span>` : content;
    });
    text = text.replace(/\^([123])(.*?)\^/g, (_, slot, content) => {
      const color = palette.slot(parseInt(slot));
      return color ? `<span style="color:${color}">${content}</span>` : content;
    });
    return text;
  }

  // ─── Source resolution (async fetch) ─────────────────────────────────────────
  function wrapSourceContent(lines) {
    let cDepth = 0, sDepth = 0;
    for (const line of lines) {
      const t = line.trim();
      if (t.match(/^\^C\([^)]+\)$/)) cDepth++;
      if (t === '^C' && cDepth > 0)  cDepth--;
      if (t.match(/^\^S\([^)]+\)$/)) sDepth++;
      if (t === '^S' && sDepth > 0)  sDepth--;
    }
    const closes = [];
    for (let i = 0; i < sDepth; i++) closes.push('^S');
    for (let i = 0; i < cDepth; i++) closes.push('^C');
    return [...lines, ...closes];
  }

  async function resolveSource(source, baseUrl, seen = new Set()) {
    const lines  = source.split('\n');
    const output = [];
    let inCodeBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('```')) inCodeBlock = !inCodeBlock;

      const m = !inCodeBlock && trimmed.match(/^::source\s+(\S+)(\s+inline)?$/);
      if (!m) { output.push(line); continue; }

      const fileUrl    = new URL(m[1], baseUrl).href;
      const inlineMode = !!m[2];

      if (seen.has(fileUrl)) {
        console.warn(`[bildup] WARNING: circular ::source — ${fileUrl} skipped`);
        continue;
      }

      let childSrc;
      try {
        const resp = await fetch(fileUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        childSrc = await resp.text();
      } catch (e) {
        console.warn(`[bildup] WARNING: ::source fetch failed — ${fileUrl}: ${e.message}`);
        continue;
      }

      const childSeen = new Set([...seen, fileUrl]);
      const resolved  = await resolveSource(childSrc, fileUrl, childSeen);

      if (inlineMode) {
        output.push(`<!-- source:inline ${m[1]} -->`);
        output.push(...resolved.split('\n'));
        output.push(`<!-- /source:inline ${m[1]} -->`);
      } else {
        output.push(`<!-- source:wrapped ${m[1]} -->`);
        output.push(...wrapSourceContent(resolved.split('\n')));
        output.push(`<!-- /source:wrapped ${m[1]} -->`);
      }
    }

    return output.join('\n');
  }

  // ─── Core render ─────────────────────────────────────────────────────────────
  /**
   * Purpose: Compiles a Bildup source string into html, functions and scripts on the client side.
   * Authors: Antigravity
   * Timestamp: 2026-05-20
   * Footguns: None.
   * Usage Example:
   *   const res = await render(source);
   */
  async function render(source, opts = {}) {
    const { baseUrl = window.location.href } = opts;
    const markedParse = getMarked();

    const flat    = await resolveSource(source, baseUrl);
    const lines   = flat.split('\n');
    const palette = new PaletteStack();
    const style   = new StyleStack();
    const fns     = {};
    const scripts = [];
    let inlineSourceDepth = 0;

    function warn(msg) { console.warn(`[bildup] WARNING: ${msg}`); }

    /**
     * Purpose: Renders a CSV table block into a styled HTML table.
     * Authors: Antigravity
     * Timestamp: 2026-05-20
     * Footguns: None.
     * Usage Example:
     *   const html = renderTable(['A,B', '1,2'], { striped: true });
     */
    function renderTable(csvLines, attrs) {
      if (!csvLines.length) return '';
      const parseRow = l => l.split(',').map(c => c.trim());
      const [headerRow, ...rows] = csvLines;
      const cls = ['bildup-table', attrs.striped && 'striped',
        (attrs.border || attrs.bordered) && 'bordered'].filter(Boolean).join(' ');
      const thead = `<thead><tr>${parseRow(headerRow).map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows.map(r =>
        `<tr>${parseRow(r).map(c => `<td>${c}</td>`).join('')}</tr>`
      ).join('')}</tbody>`;
      return `<div class="bildup-table-wrap"><table class="${cls}">${thead}${tbody}</table></div>`;
    }

    /**
     * Purpose: Renders a component (input, button, output) to its corresponding HTML.
     * Authors: Antigravity
     * Timestamp: 2026-05-20
     * Footguns: None.
     * Usage Example:
     *   const html = renderComponent('input', 'username', { placeholder: 'Name' });
     */
    function renderComponent(tag, id, attrs) {
      const idAttr = id ? ` id="${id}"` : '';
      const extra = renderExtraAttrs(attrs);
      switch (tag) {
        case 'input': {
          const type = Object.keys(attrs).find(k =>
            ['text','email','number','password','tel','url'].includes(k)) || 'text';
          const ph  = attrs.placeholder || '';
          const val = attrs.value !== undefined ? ` value="${attrs.value}"` : '';
          if (attrs.textarea)
            return `<textarea${idAttr}${extra} placeholder="${ph}" class="bildup-input">${attrs.value||''}</textarea>`;
          return `<input${idAttr}${extra} type="${type}" placeholder="${ph}"${val} class="bildup-input">`;
        }
        case 'button': {
          const label = attrs.label || 'Button';
          const cls   = attrs.primary ? 'bildup-btn bildup-btn-primary' : 'bildup-btn';
          let onclick = '';
          if (attrs.action === 'navigate' && attrs.target)
            onclick = ` onclick="window.location='${attrs.target}'"`;
          else if (attrs.action === 'submit' && attrs.target)
            onclick = ` onclick="bildupSubmit('${attrs.target}',event)"`;
          else if (attrs.action === 'calc' && attrs.targets)
            onclick = ` onclick="bildupCalc([${attrs.targets.split(',').map(t=>`'${t.trim()}'`).join(',')}])"`;
          return `<button${idAttr}${extra} class="${cls}"${onclick}>${label}</button>`;
        }
        case 'output': {
          const dataFn = attrs.fn ? ` data-fn="${attrs.fn}"` : '';
          return `<div class="bildup-output"${idAttr}${dataFn}${extra}>`
            + `<span class="bildup-output-label">${attrs.label||''}</span>`
            + `<span class="bildup-output-value">—</span></div>`;
        }
        default: return `<!-- unknown component: ${tag} -->`;
      }
    }

    /**
     * Purpose: Iterates line-by-line to parse layout structures, style/color regions, and markdown content.
     * Authors: Antigravity
     * Timestamp: 2026-05-20
     * Footguns:
     *   - Incomplete code blocks or missing closures can cause parsed lines to be processed as raw markdown.
     * Usage Example:
     *   const html = renderLines(['# Title', '::[flex]', 'Text', '::']);
     */
    function renderLines(lineArr, baseLineNum = 0) {
      const chunks = [];
      const localOpenBlocks = [];
      let j = 0, mdBuffer = [];
      let inCodeBlock = false;

      function flushMd() {
        if (!mdBuffer.length) return;
        const raw = mdBuffer.join('\n');
        mdBuffer = [];
        if (raw.trim()) chunks.push(processInlineColor(markedParse(raw), palette));
      }

      while (j < lineArr.length) {
        const line    = lineArr[j];
        const trimmed = line.trim();

        if (trimmed.startsWith('```')) inCodeBlock = !inCodeBlock;

        if (inCodeBlock) {
          mdBuffer.push(line);
          j++; continue;
        }

        // Tracking inline source sentinel comments
        if (trimmed.startsWith('<!-- source:inline')) {
          inlineSourceDepth++;
          j++; continue;
        }
        if (trimmed.startsWith('<!-- /source:inline')) {
          inlineSourceDepth--;
          j++; continue;
        }
        if (trimmed.startsWith('<!-- source:') || trimmed.startsWith('<!-- /source:')) {
          j++; continue;
        }

        const cOpen = trimmed.match(/^\^C\(([^)]+)\)$/);
        if (cOpen) {
          flushMd();
          palette.push(cOpen[1].split(',').map(s=>s.trim()), inlineSourceDepth > 0);
          j++; continue;
        }

        if (trimmed === '^C') {
          flushMd();
          if (palette.depth() === 0) warn(`^C close has no matching open`);
          else palette.pop();
          j++; continue;
        }

        const sOpen = trimmed.match(/^\^S\(([^)]+)\)$/);
        if (sOpen) {
          flushMd();
          const css = attrsToCSS(parseAttrs(sOpen[1]), palette);
          style.push({}, inlineSourceDepth > 0);
          chunks.push(`<div style="${css};width:100%">`);
          j++; continue;
        }

        if (trimmed === '^S') {
          flushMd();
          if (style.depth() === 0) warn(`^S close has no matching open`);
          else { style.pop(); chunks.push('</div>'); }
          j++; continue;
        }

        const tableOpen = trimmed.match(/^::table(\[([^\]]*)\])?$/);
        if (tableOpen) {
          flushMd();
          const attrs = parseAttrs(tableOpen[2] || '');
          const csvLines = [];
          let inTableCode = false;
          j++;
          while (j < lineArr.length) {
            const it = lineArr[j].trim();
            if (it.startsWith('```')) inTableCode = !inTableCode;
            if (!inTableCode && it === '::') break;
            if (lineArr[j].trim()) csvLines.push(lineArr[j].trim()); j++;
          }
          if (j < lineArr.length) j++;
          chunks.push(renderTable(csvLines, attrs));
          continue;
        }

        const fnOpen = trimmed.match(/^::fn#(\w+)$/);
        if (fnOpen) {
          const fnId = fnOpen[1], body = [];
          let inFnCode = false;
          j++;
          while (j < lineArr.length) {
            const it = lineArr[j].trim();
            if (it.startsWith('```')) inFnCode = !inFnCode;
            if (!inFnCode && it === '::fn') break;
            body.push(lineArr[j].trim()); j++;
          }
          if (j < lineArr.length) j++;
          fns[fnId] = body.join(' ').trim();
          continue;
        }

        if (trimmed === '::script') {
          const scriptLines = [];
          let inScriptCode = false;
          j++;
          while (j < lineArr.length) {
            const it = lineArr[j].trim();
            if (it.startsWith('```')) inScriptCode = !inScriptCode;
            if (!inScriptCode && it === '::script') break;
            scriptLines.push(lineArr[j]); j++;
          }
          if (j < lineArr.length) j++;
          scripts.push(scriptLines.join('\n'));
          continue;
        }

        const selfClose = trimmed.match(/^::(\w+)(#\w+)?\[([^\]]*)\]\/$/);
        if (selfClose) {
          flushMd();
          const [, tag, idPart, attrStr] = selfClose;
          chunks.push(renderComponent(tag, idPart?.slice(1)||null, parseAttrs(attrStr)));
          j++; continue;
        }

        const simpleSelf = trimmed.match(/^::(\w+)(#\w+)?\/$/);
        if (simpleSelf) {
          flushMd();
          const [, tag, idPart] = simpleSelf;
          chunks.push(renderComponent(tag, idPart?.slice(1)||null, {}));
          j++; continue;
        }

        if (trimmed === '::') {
          flushMd();
          if (!localOpenBlocks.length) warn(`unexpected :: close`);
          else { localOpenBlocks.pop(); chunks.push('</div>'); }
          j++; continue;
        }

        const blockMatch = trimmed.match(/^::([\w]*)(#\w+)?\[([^\]]*)\](.*)$/) ||
                           trimmed.match(/^::([\w]+)(#\w+)?(.*)$/);
        if (blockMatch) {
          const tag = blockMatch[1] || 'div', idPart = blockMatch[2], attrStr = blockMatch[3] || '', rest = blockMatch[4] || '';
          const id = idPart ? idPart.slice(1) : null;
          const attrs = parseAttrs(attrStr);
          const extra = renderExtraAttrs(attrs);
          
          // Inline block: ::[attrs] Content ::
          if (rest.trim().endsWith('::')) {
            const content = rest.trim().slice(0, -2).trim();
            const css = attrsToCSS(attrs, palette);
            const idAttr = id ? ` id="${id}"` : '';
            const cssAttr = css ? ` style="${css}"` : '';
            flushMd();
            chunks.push(`<${tag}${idAttr}${cssAttr}${extra} class="bildup-block">`);
            chunks.push(markedParse(content));
            chunks.push(`</${tag}>`);
            j++; continue;
          }

          flushMd();
          const css     = attrsToCSS(attrs, palette);
          localOpenBlocks.push({ tag });
          chunks.push(`<div${id ? ` id="${id}"` : ''}${css ? ` style="${css}"` : ''}${extra} class="bildup-block">`);

          const inner = [];
          let depth = 1, foundClose = false, inInnerCode = false;
          let inInnerComp = null; // 'table', 'fn', or 'script'
          j++;
          while (j < lineArr.length) {
            const it = lineArr[j].trim();
            if (it.startsWith('```')) inInnerCode = !inInnerCode;

            if (!inInnerCode) {
              if (inInnerComp) {
                if (inInnerComp === 'table' && it === '::') inInnerComp = null;
                else if (inInnerComp === 'fn' && it === '::fn') inInnerComp = null;
                else if (inInnerComp === 'script' && it === '::script') inInnerComp = null;
              } else {
                const isOpen = (it.match(/^::([\w]*)(#\w+)?\[([^\]]*)\]$/) ||
                                it.match(/^::([\w]+)(#\w+)?$/)) &&
                               !it.match(/^::([\w]+)(#\w+)?\[.*\]\/$/);
                const compMatch = it.match(/^::(table|fn|script)/);
                if (compMatch) inInnerComp = compMatch[1];
                else if (isOpen && it !== '::') depth++;
                else if (it === '::') { depth--; if (depth === 0) { j++; foundClose = true; break; } }
              }
            }
            inner.push(lineArr[j]); j++;
          }
          if (foundClose) localOpenBlocks.pop();
          chunks.push(renderLines(inner, baseLineNum + j));
          chunks.push('</div>');
          continue;
        }

        mdBuffer.push(line);
        j++;
      }

      flushMd();

      // Auto-close unclosed regions and warn if not from inline source
      if (baseLineNum === 0) {
        for (const u of palette.unclosed()) {
          if (!u.fromInline) {
            warn(`unclosed color region (${u.palette?.join(', ')})`);
          }
        }
        for (const u of style.unclosed()) {
          if (!u.fromInline) {
            warn(`unclosed style region`);
          }
        }
        for (let k = 0; k < style.depth(); k++) chunks.push('</div>');
      }

      return chunks.join('\n');
    }

    const html = renderLines(lines);
    return { html, fns, scripts };
  }

  // ─── CSS ─────────────────────────────────────────────────────────────────────
  const CSS = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Georgia',serif;font-size:1.05rem;line-height:1.7;color:#e8e8e8;background:#111;max-width:860px;margin:0 auto;padding:2rem 1.5rem 4rem}
h1,h2,h3,h4{font-family:'Georgia',serif;font-weight:700;line-height:1.2;margin:1.5rem 0 .75rem}
h1{font-size:2.4rem}h2{font-size:1.7rem;border-bottom:1px solid #333;padding-bottom:.3rem}h3{font-size:1.25rem}
p{margin:.75rem 0;overflow-wrap:break-word;word-wrap:break-word}
ul,ol{margin:.75rem 0 .75rem 1.5rem}li{margin:.25rem 0}
code{font-family:monospace;background:#222;padding:.1em .4em;border-radius:3px;font-size:.9em}
pre{background:#1a1a1a;padding:1rem;border-radius:6px;overflow-x:auto;margin:1rem 0}pre code{background:none;padding:0}
a{color:#00eeff}hr{border:none;border-top:1px solid #333;margin:2rem 0}
strong{font-weight:700}em{font-style:italic}
blockquote{border-left:3px solid #333;margin:1rem 0;padding:.5rem 1rem;color:#aaa}
.bildup-block{width:100%;margin:.5rem 0;min-width:0;overflow-wrap:break-word;word-wrap:break-word}
[style*="display:flex"]>.bildup-block,[style*="display: flex"]>.bildup-block{flex:1;width:auto;margin:0}
[style*="flex-direction:row"]{align-items:stretch}
.bildup-input{display:block;width:100%;padding:.45rem .6rem;background:#1a1a1a;border:1px solid #333;border-radius:4px;color:#e8e8e8;font-size:.95rem;font-family:inherit;margin:.2rem 0;transition:border-color .15s}
.bildup-input:focus{outline:none;border-color:#00eeff}textarea.bildup-input{min-height:80px;resize:vertical}
.bildup-btn{display:inline-block;padding:.4rem .9rem;background:#222;border:1px solid #444;border-radius:4px;color:#e8e8e8;font-size:.9rem;font-family:inherit;cursor:pointer;margin:.2rem .2rem .2rem 0;transition:background .15s,border-color .15s,transform .1s}
.bildup-btn:hover{background:#2a2a2a;border-color:#666}
.bildup-btn:active{transform:translateY(1px)}
.bildup-btn-primary{background:#00eeff22;border-color:#00eeff;color:#00eeff}
.bildup-btn-primary:hover{background:#00eeff33}
.bildup-output{display:flex;align-items:center;gap:.75rem;padding:.4rem 0;font-size:1rem}
.bildup-output-label{color:#888}.bildup-output-value{font-weight:700;color:#e8e8e8}
.bildup-table-wrap{width:100%;overflow-x:auto;margin:1rem 0}
.bildup-table{width:100%;border-collapse:collapse;font-size:.95rem}
.bildup-table th{text-align:left;padding:.5rem .75rem;border-bottom:2px solid #333;color:#aaa;font-weight:600;letter-spacing:.03em}
.bildup-table td{padding:.5rem .75rem;border-bottom:1px solid #222}
.bildup-table.striped tr:nth-child(even) td{background:#1a1a1a}
.bildup-table.bordered th,.bildup-table.bordered td{border:1px solid #333}
.bildup-table tr:last-child td{border-bottom:none}`;

  // ─── Runtime JS (injected into DOM after mount) ───────────────────────────────
  /**
   * Purpose: Injects client-side reactivity and auto-eval JS runtime.
   * Authors: Antigravity
   * Timestamp: 2026-05-20
   * Footguns: None.
   * Usage Example: injectRuntime(fns, scripts, container);
   */
  function injectRuntime(fns, scripts, container) {
    const script = document.createElement('script');
    script.textContent = `
(function(){
const _fns=${JSON.stringify(fns)};
window.bildupAutoEval = function() {
  const vars={};
  document.querySelectorAll('input[id],textarea[id]').forEach(el=>{
    const v=parseFloat(el.value);vars[el.id]=isNaN(v)?el.value:v;
  });
  document.querySelectorAll('.bildup-output[data-fn]').forEach(el=>{
    const fnId=el.dataset.fn;if(!fnId||!_fns[fnId])return;
    let expr=_fns[fnId];
    Object.keys(_fns).forEach(n=>{expr=expr.replace(new RegExp('\\\\b'+n+'\\\\b','g'),'('+_fns[n]+')');});
    try{
      const result=new Function(...Object.keys(vars),'return '+expr)(...Object.values(vars));
      el.querySelector('.bildup-output-value').textContent=typeof result==='number'?result.toFixed(2):result;
    }catch(e){el.querySelector('.bildup-output-value').textContent='err';}
  });
};
window.bildupUpdateReactive = function() {
  document.querySelectorAll('[data-show-if]').forEach(el => {
    const cond = el.getAttribute('data-show-if');
    if (!cond) return;
    const isInverse = cond.startsWith('!');
    const targetId = isInverse ? cond.slice(1) : cond;
    const target = document.getElementById(targetId);
    let truthy = false;
    if (target) {
      if (target.type === 'checkbox' || target.type === 'radio') {
        truthy = target.checked;
      } else {
        truthy = Boolean(target.value && target.value.trim());
      }
    }
    const show = isInverse ? !truthy : truthy;
    el.style.display = show ? '' : 'none';
  });
};
window.bildupUpdateStates = function() {
  document.querySelectorAll('*').forEach(el => {
    if (!el.attributes) return;
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      if (attr.name.startsWith('data-state-')) {
        const match = attr.name.match(/^data-state-([a-zA-Z0-9]+)(?:-(.+))?$/);
        if (!match) continue;
        const cond = match[1];
        const targetId = match[2];
        const className = attr.value;
        const target = targetId ? document.getElementById(targetId) : el;
        if (!target) continue;
        
        let active = false;
        const val = target.value !== undefined ? target.value : '';
        const isCheckbox = target.type === 'checkbox' || target.type === 'radio';
        
        if (cond === 'empty') {
          active = isCheckbox ? !target.checked : (!val || !val.trim());
        } else if (cond === 'error') {
          const isInvalidNum = target.type === 'number' && val !== '' && isNaN(parseFloat(val));
          const hasValErr = target.validity && !target.validity.valid;
          active = isCheckbox ? !target.checked : (!val || !val.trim() || isInvalidNum || hasValErr);
        } else if (cond === 'neg' || cond === 'negative') {
          const num = parseFloat(val);
          active = !isNaN(num) && num < 0;
        } else if (cond === 'pos' || cond === 'positive') {
          const num = parseFloat(val);
          active = !isNaN(num) && num > 0;
        } else if (cond === 'zero') {
          const num = parseFloat(val);
          active = !isNaN(num) && num === 0;
        }
        
        if (active) {
          className.split(' ').filter(Boolean).forEach(c => el.classList.add(c));
        } else {
          className.split(' ').filter(Boolean).forEach(c => el.classList.remove(c));
        }
      }
    }
  });
};
window.bildupUpdate = function() {
  window.bildupAutoEval();
  window.bildupUpdateReactive();
  window.bildupUpdateStates();
};
window.bildupCalc=function(ids){
  window.bildupUpdate();
};
window.bildupSubmit=async function(url,e){
  e.preventDefault();
  const payload={};
  document.querySelectorAll('input[id],textarea[id]').forEach(el=>payload[el.id]=el.value);
  try{
    await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    alert('Submitted!');
  }catch(err){alert('Submission failed: '+err.message);}
};

// Event listeners
if (!window._bildupListenersAttached) {
  window._bildupListenersAttached = true;
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id) {
      window.bildupUpdate();
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id) {
      window.bildupUpdate();
    }
  });
}
window.bildupUpdate();
${scripts.join('\n')}
})();`;
    container.appendChild(script);
  }

  // ─── Mount ───────────────────────────────────────────────────────────────────
  /**
   * Purpose: Mounts compiled bildup template HTML into a container element and runs the runtime script.
   * Authors: Antigravity
   * Timestamp: 2026-05-20
   * Footguns: None.
   * Usage Example: mount(source, document.getElementById('app'));
   */
  async function mount(source, container, opts = {}) {
    container.innerHTML = '<div style="color:#888;padding:1rem">[bildup] rendering...</div>';
    try {
      const { html, fns, scripts } = await render(source, opts);
      container.innerHTML = html;
      injectRuntime(fns, scripts, container);
    } catch (e) {
      container.innerHTML = `<pre style="color:#f66;padding:1rem">[bildup] render error:\n${e.message}</pre>`;
      throw e;
    }
  }

  // ─── Hydrate ─────────────────────────────────────────────────────────────────
  /**
   * Purpose: Merges new HTML content into a DOM container while preserving active input values, focus, and cursor selection.
   * Authors: Antigravity
   * Timestamp: 2026-05-20
   * Footguns:
   *   - If elements are reordered dynamically without ids, cursor/focus might be lost or shifted.
   * Usage Example:
   *   bildup.hydrate(document.getElementById('app'), newHtml);
   */
  function hydrate(container, newHtml) {
    const activeEl = document.activeElement;
    const activeId = activeEl ? activeEl.id : null;
    const selectionStart = activeEl && activeEl.selectionStart !== undefined ? activeEl.selectionStart : null;
    const selectionEnd = activeEl && activeEl.selectionEnd !== undefined ? activeEl.selectionEnd : null;

    const savedState = {};
    container.querySelectorAll('input[id],textarea[id],select[id]').forEach(el => {
      savedState[el.id] = {
        value: el.value,
        checked: el.checked
      };
    });

    container.innerHTML = newHtml;

    container.querySelectorAll('input[id],textarea[id],select[id]').forEach(el => {
      if (savedState[el.id] !== undefined) {
        el.value = savedState[el.id].value;
        el.checked = savedState[el.id].checked;
      }
    });

    if (activeId) {
      const elToFocus = container.querySelector('#' + CSS.escape(activeId));
      if (elToFocus) {
        elToFocus.focus();
        if (selectionStart !== null && selectionEnd !== null) {
          try {
            elToFocus.setSelectionRange(selectionStart, selectionEnd);
          } catch (e) {
            // Ignore
          }
        }
      }
    }

    if (window.bildupUpdate) {
      window.bildupUpdate();
    }
  }

  // ─── Auto-boot ───────────────────────────────────────────────────────────────
  /**
   * Purpose: Automatically boots all script type=text/bildup tags on the page.
   * Authors: Antigravity
   * Timestamp: 2026-05-20
   * Footguns: None.
   * Usage Example: boot();
   */
  async function boot() {
    // Inject CSS
    if (!document.getElementById('bildup-styles')) {
      const style = document.createElement('style');
      style.id = 'bildup-styles';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    const tags = document.querySelectorAll('script[type="text/bildup"]');
    for (const tag of tags) {
      // Determine mount target: use data-target="#id" or insert a div after the script tag
      let container;
      if (tag.dataset.target) {
        container = document.querySelector(tag.dataset.target);
      } else {
        container = document.createElement('div');
        tag.parentNode.insertBefore(container, tag.nextSibling);
      }

      if (tag.src) {
        // External .bu file
        try {
          const resp = await fetch(tag.src);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const source = await resp.text();
          await mount(source, container, { baseUrl: tag.src });
        } catch (e) {
          container.innerHTML = `<pre style="color:#f66">[bildup] failed to load ${tag.src}: ${e.message}</pre>`;
        }
      } else {
        // Inline source
        await mount(tag.textContent, container, { baseUrl: window.location.href });
      }
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────
  const bildup = { render, mount, boot, hydrate };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = bildup;
  } else {
    global.bildup = bildup;
  }

  // Auto-boot on DOMContentLoaded
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  return bildup;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
