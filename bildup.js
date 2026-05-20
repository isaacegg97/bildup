#!/usr/bin/env node
'use strict';

// bildup v0.2 — markdown superset compiler for interactive static pages
// https://github.com/isaacegg97/bildup
// MIT License

const { marked } = require('marked');
const fs = require('fs');
const path = require('path');

// ─── Color palette ────────────────────────────────────────────────────────────
const COLOR_MAP = {
  midnight: '#0d1117', snow: '#f8f9fa', electric: '#00eeff',
  surface: '#1e1e2e', muted: '#6b7280',
  slate: '#475569', cream: '#fdf6e3', gold: '#f59e0b',
  navy: '#1e3a5f', coral: '#ff6b6b', lime: '#84cc16',
  crimson: '#dc2626', obsidian: '#1c1c1e', amber: '#f59e0b',
  red: 'red', blue: 'blue', green: 'green', black: 'black',
  white: 'white', orange: 'orange', purple: 'purple', pink: 'pink',
  teal: 'teal', cyan: 'cyan', yellow: 'yellow', gray: 'gray',
};

function resolveColor(name) {
  const n = name.trim().toLowerCase();
  return COLOR_MAP[n] || n;
}

// ─── Palette stack ────────────────────────────────────────────────────────────
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
  constructor() { this.stack = [null]; this.openAt = [null]; this.fromInline = [false]; }
  /**
   * Purpose: Pushes a new palette scope onto the stack.
   * Authors: Antigravity
   * Timestamp: 2026-05-20
   * Footguns: None.
   * Usage Example: p.push(['red', 'green', 'blue'], 12, true);
   */
  push(colors, line, fromInline = false) {
    this.stack.push(colors);
    this.openAt.push(line);
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
      this.openAt.pop();
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
   * Purpose: Returns details of unclosed color regions still on the stack.
   * Authors: Antigravity
   * Timestamp: 2026-05-20
   * Footguns: None.
   * Usage Example: const list = p.unclosed();
   */
  unclosed() {
    return this.openAt.slice(1).map((line, i) => ({
      type: 'color region', line, palette: this.stack[i + 1], fromInline: this.fromInline[i + 1]
    }));
  }
}

// ─── Style stack ─────────────────────────────────────────────────────────────
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
  constructor() { this.stack = [{}]; this.openAt = [null]; this.fromInline = [false]; }
  /**
   * Purpose: Pushes a style region onto the stack.
   * Authors: Antigravity
   * Timestamp: 2026-05-20
   * Footguns: None.
   * Usage Example: s.push({ flex: true }, 42, false);
   */
  push(attrs, line, fromInline = false) {
    this.stack.push(attrs);
    this.openAt.push(line);
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
      this.openAt.pop();
      this.fromInline.pop();
    }
  }
  /**
   * Purpose: Returns all unclosed style regions still on the stack.
   * Authors: Antigravity
   * Timestamp: 2026-05-20
   * Footguns: None.
   * Usage Example: const list = s.unclosed();
   */
  unclosed() {
    return this.openAt.slice(1).map((line, i) => ({
      type: 'style region', line, fromInline: this.fromInline[i + 1]
    }));
  }
}

// ─── Attribute parser ─────────────────────────────────────────────────────────
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

// ─── Slot resolution ──────────────────────────────────────────────────────────
const SLOT_NAMES = { primary: 1, secondary: 2, accent: 3 };

function resolveValue(val, palette) {
  if (typeof val !== 'string') return val;
  const lower = val.toLowerCase();
  if (SLOT_NAMES[lower] !== undefined) return palette.slot(SLOT_NAMES[lower]);
  if (/^\^[123]$/.test(val)) return palette.slot(parseInt(val[1]));
  return resolveColor(val);
}

// ─── CSS builder ──────────────────────────────────────────────────────────────
function attrsToCSS(attrs, palette) {
  const css = [];
  if (attrs.flex) css.push('display:flex');
  if (attrs.grid) css.push('display:grid');
  if (attrs.row) css.push('flex-direction:row');
  if (attrs.col) css.push('flex-direction:column');
  if (attrs.gap) css.push(`gap:${parseFloat(attrs.gap) * 0.5}rem`);
  if (attrs.pad) css.push(`padding:${parseFloat(attrs.pad) * 0.5}rem`);
  if (attrs.wrap) css.push('flex-wrap:wrap');
  if (attrs.bg) { const c = resolveValue(attrs.bg, palette); if (c) css.push(`background:${c}`); }
  if (attrs.fg) { const c = resolveValue(attrs.fg, palette); if (c) css.push(`color:${c}`); }
  return css.join(';');
}

// ─── Inline color ─────────────────────────────────────────────────────────────
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

// ─── Source resolution (pre-pass) ─────────────────────────────────────────────
// Count unclosed ^C and ^S in sourced content, inject closes at end
function wrapSourceContent(lines) {
  let cDepth = 0, sDepth = 0;
  for (const line of lines) {
    const t = line.trim();
    if (t.match(/^\^C\([^)]+\)$/)) cDepth++;
    if (t === '^C' && cDepth > 0) cDepth--;
    if (t.match(/^\^S\([^)]+\)$/)) sDepth++;
    if (t === '^S' && sDepth > 0) sDepth--;
  }
  const closes = [];
  for (let i = 0; i < sDepth; i++) closes.push('^S');
  for (let i = 0; i < cDepth; i++) closes.push('^C');
  return [...lines, ...closes];
}

function resolveSource(source, basedir, seen = new Set()) {
  const lines = source.split('\n');
  const output = [];
  let inCodeBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) inCodeBlock = !inCodeBlock;

    const m = !inCodeBlock && trimmed.match(/^::source\s+(\S+)(\s+inline)?$/);
    if (!m) { output.push(line); continue; }

    const filePath = path.resolve(basedir, m[1]);
    const inlineMode = !!m[2];

    if (seen.has(filePath)) {
      console.warn(`[bildup] WARNING: circular ::source — ${filePath} skipped`);
      continue;
    }
    if (!fs.existsSync(filePath)) {
      console.warn(`[bildup] WARNING: ::source not found — ${filePath}`);
      continue;
    }

    const childSrc = fs.readFileSync(filePath, 'utf8');
    const childSeen = new Set([...seen, filePath]);
    const childDir = path.dirname(filePath);
    const resolved = resolveSource(childSrc, childDir, childSeen);

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

// ─── Compiler ─────────────────────────────────────────────────────────────────
/**
 * Purpose: Compiles the bildup template source into a self-contained, interactive HTML document.
 * Authors: Antigravity
 * Timestamp: 2026-05-20
 * Footguns:
 *   - Circular template references in ::source imports can cause deep call stack exhaustion warnings.
 *   - The template expressions inside ::fn are dynamically evaluated via Function constructor in client JS.
 * Usage Example:
 *   const html = compile('# My Page', { title: 'My Page', strict: true });
 */
function compile(source, opts = {}) {
  const { strict = false, title = 'bildup', basedir = process.cwd(), json = false } = opts;

  const flat = resolveSource(source, basedir);
  const lines = flat.split('\n');
  const palette = new PaletteStack();
  const styleStack = new StyleStack();
  const scripts = [];
  const fns = {};
  const warnings = [];
  const errors = [];
  let inlineSourceDepth = 0;

  /**
   * Purpose: Adds a structured error/warning and logs it if not outputting JSON.
   * Authors: Antigravity
   * Timestamp: 2026-05-20
   * Footguns: None.
   * Usage Example: addError('unexpected_close', 42, 'msg');
   */
  function addError(type, line, msg, extra = {}) {
    warnings.push(msg);
    errors.push({
      type,
      line,
      message: msg,
      ...extra
    });
    if (!json) {
      console.warn(`[bildup] WARNING: ${msg}`);
    }
  }

  function renderTable(csvLines, attrs) {
    if (!csvLines.length) return '';
    const parseRow = l => l.split(',').map(c => c.trim());
    const [headerRow, ...rows] = csvLines;
    const cls = ['bildup-table',
      attrs.striped && 'striped',
      (attrs.border || attrs.bordered) && 'bordered'
    ].filter(Boolean).join(' ');
    const thead = `<thead><tr>${parseRow(headerRow).map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${rows.map(r =>
      `<tr>${parseRow(r).map(c => `<td>${c}</td>`).join('')}</tr>`
    ).join('')}</tbody>`;
    return `<div class="bildup-table-wrap"><table class="${cls}">${thead}${tbody}</table></div>`;
  }

  /**
   * Purpose: Renders a component component (input, button, output) to its corresponding HTML.
   * Authors: Antigravity
   * Timestamp: 2026-05-20
   * Footguns:
   *   - Unknown tags are returned as a fallback HTML comment.
   * Usage Example:
   *   const html = renderComponent('input', 'username', { text: true, placeholder: 'Enter username' });
   */
  function renderComponent(tag, id, attrs) {
    const idAttr = id ? ` id="${id}"` : '';
    const extra = renderExtraAttrs(attrs);
    switch (tag) {
      case 'input': {
        const type = Object.keys(attrs).find(k =>
          ['text', 'email', 'number', 'password', 'tel', 'url'].includes(k)) || 'text';
        const ph = attrs.placeholder || '';
        const val = attrs.value !== undefined ? ` value="${attrs.value}"` : '';
        if (attrs.textarea)
          return `<textarea${idAttr}${extra} placeholder="${ph}" class="bildup-input">${attrs.value || ''}</textarea>`;
        return `<input${idAttr}${extra} type="${type}" placeholder="${ph}"${val} class="bildup-input">`;
      }
      case 'button': {
        const label = attrs.label || 'Button';
        const cls = attrs.primary ? 'bildup-btn bildup-btn-primary' : 'bildup-btn';
        let onclick = '';
        if (attrs.action === 'navigate' && attrs.target)
          onclick = ` onclick="window.location='${attrs.target}'"`;
        else if (attrs.action === 'submit' && attrs.target)
          onclick = ` onclick="bildupSubmit('${attrs.target}',event)"`;
        else if (attrs.action === 'calc' && attrs.targets)
          onclick = ` onclick="bildupCalc([${attrs.targets.split(',').map(t => `'${t.trim()}'`).join(',')}])"`;
        return `<button${idAttr}${extra} class="${cls}"${onclick}>${label}</button>`;
      }
      case 'output': {
        const dataFn = attrs.fn ? ` data-fn="${attrs.fn}"` : '';
        return `<div class="bildup-output"${idAttr}${dataFn}${extra}>`
          + `<span class="bildup-output-label">${attrs.label || ''}</span>`
          + `<span class="bildup-output-value">—</span></div>`;
      }
      default:
        return `<!-- unknown component: ${tag} -->`;
    }
  }

  /**
   * Purpose: Iterates line-by-line to parse layout structures, style/color regions, and markdown content.
   * Authors: Antigravity
   * Timestamp: 2026-05-20
   * Footguns:
   *   - Incomplete/unclosed markdown code blocks can affect line matching.
   * Usage Example:
   *   const body = renderLines(['# Heading', '::[pad=2]', 'Content', '::']);
   */
  function renderLines(lineArr, baseLineNum = 0) {
    const chunks = [];
    const localOpenBlocks = [];
    let j = 0;
    let mdBuffer = [];

    function flushMd() {
      if (!mdBuffer.length) return;
      const raw = mdBuffer.join('\n');
      mdBuffer = [];
      if (raw.trim()) chunks.push(processInlineColor(marked.parse(raw), palette));
    }

    let inCodeBlock = false;
    while (j < lineArr.length) {
      const line = lineArr[j];
      const trimmed = line.trim();
      const lineNum = baseLineNum + j + 1;

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
        palette.push(cOpen[1].split(',').map(s => s.trim()), lineNum, inlineSourceDepth > 0);
        j++; continue;
      }

      if (trimmed === '^C') {
        flushMd();
        if (palette.stack.length <= 1) {
          addError('unexpected_close', lineNum, `^C close at line ${lineNum} has no matching open`, {
            token: '^C',
            suggestion: {
              action: 'remove',
              line: lineNum,
              description: `Remove the unexpected '^C' close at line ${lineNum}`
            }
          });
        }
        else palette.pop();
        j++; continue;
      }

      const sOpen = trimmed.match(/^\^S\(([^)]+)\)$/);
      if (sOpen) {
        flushMd();
        const css = attrsToCSS(parseAttrs(sOpen[1]), palette);
        styleStack.push({}, lineNum, inlineSourceDepth > 0);
        chunks.push(`<div style="${css};width:100%">`);
        j++; continue;
      }

      if (trimmed === '^S') {
        flushMd();
        if (styleStack.stack.length <= 1) {
          addError('unexpected_close', lineNum, `^S close at line ${lineNum} has no matching open`, {
            token: '^S',
            suggestion: {
              action: 'remove',
              line: lineNum,
              description: `Remove the unexpected '^S' close at line ${lineNum}`
            }
          });
        }
        else { styleStack.pop(); chunks.push('</div>'); }
        j++; continue;
      }

      const tableOpen = trimmed.match(/^::table(\[([^\]]*)\])?$/);
      if (tableOpen) {
        flushMd();
        const attrs = parseAttrs(tableOpen[2] || '');
        const csvLines = [];
        const openLine = lineNum;
        let inTableCode = false;
        j++;
        while (j < lineArr.length) {
          const it = lineArr[j].trim();
          if (it.startsWith('```')) inTableCode = !inTableCode;
          if (!inTableCode && it === '::') break;
          if (lineArr[j].trim()) csvLines.push(lineArr[j].trim());
          j++;
        }
        if (j >= lineArr.length) {
          addError('unclosed_table', openLine, `unclosed ::table at line ${openLine} — reached EOF`, {
            suggestion: {
              action: 'insert',
              content: '::',
              line: lineArr.length + baseLineNum,
              description: `Insert '::' to close the table opened at line ${openLine}`
            }
          });
        }
        else j++;
        chunks.push(renderTable(csvLines, attrs));
        continue;
      }

      const fnOpen = trimmed.match(/^::fn#(\w+)$/);
      if (fnOpen) {
        const fnId = fnOpen[1], body = [], openLine = lineNum;
        let inFnCode = false;
        j++;
        while (j < lineArr.length) {
          const it = lineArr[j].trim();
          if (it.startsWith('```')) inFnCode = !inFnCode;
          if (!inFnCode && it === '::fn') break;
          body.push(lineArr[j].trim()); j++;
        }
        if (j >= lineArr.length) {
          addError('unclosed_fn', openLine, `unclosed ::fn#${fnId} at line ${openLine}`, {
            fnId,
            suggestion: {
              action: 'insert',
              content: '::fn',
              line: lineArr.length + baseLineNum,
              description: `Insert '::fn' to close the function opened at line ${openLine}`
            }
          });
        }
        else j++;
        fns[fnId] = body.join(' ').trim();
        continue;
      }

      if (trimmed === '::script') {
        const scriptLines = [], openLine = lineNum;
        let inScriptCode = false;
        j++;
        while (j < lineArr.length) {
          const it = lineArr[j].trim();
          if (it.startsWith('```')) inScriptCode = !inScriptCode;
          if (!inScriptCode && it === '::script') break;
          scriptLines.push(lineArr[j]); j++;
        }
        if (j >= lineArr.length) {
          addError('unclosed_script', openLine, `unclosed ::script at line ${openLine}`, {
            suggestion: {
              action: 'insert',
              content: '::script',
              line: lineArr.length + baseLineNum,
              description: `Insert '::script' to close the script block opened at line ${openLine}`
            }
          });
        }
        else j++;
        scripts.push(scriptLines.join('\n'));
        continue;
      }

      const selfClose = trimmed.match(/^::(\w+)(#\w+)?\[([^\]]*)\]\/$/);
      if (selfClose) {
        flushMd();
        const [, tag, idPart, attrStr] = selfClose;
        chunks.push(renderComponent(tag, idPart?.slice(1) || null, parseAttrs(attrStr)));
        j++; continue;
      }

      const simpleSelf = trimmed.match(/^::(\w+)(#\w+)?\/$/);
      if (simpleSelf) {
        flushMd();
        const [, tag, idPart] = simpleSelf;
        chunks.push(renderComponent(tag, idPart?.slice(1) || null, {}));
        j++; continue;
      }

      if (trimmed === '::') {
        flushMd();
        if (!localOpenBlocks.length) {
          addError('unexpected_close', lineNum, `unexpected :: close at line ${lineNum}`, {
            token: '::',
            suggestion: {
              action: 'remove',
              line: lineNum,
              description: `Remove the unexpected '::' close at line ${lineNum}`
            }
          });
        }
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
          chunks.push(marked.parse(content));
          chunks.push(`</${tag}>`);
          j++; continue;
        }

        flushMd();
        const css = attrsToCSS(attrs, palette);
        const idAttr = id ? ` id="${id}"` : '';
        const cssAttr = css ? ` style="${css}"` : '';

        localOpenBlocks.push({ tag, attrStr, lineNum });
        chunks.push(`<div${idAttr}${cssAttr}${extra} class="bildup-block">`);

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

        if (!foundClose) {
          addError('unclosed_block', lineNum, `unclosed block ${attrStr ? `::[${attrStr}]` : `::${tag}`} at line ${lineNum} — auto-closed`, {
            tag,
            attributes: attrStr,
            suggestion: {
              action: 'insert',
              content: '::',
              line: lineArr.length + baseLineNum,
              description: `Insert '::' to close the block opened at line ${lineNum}`
            }
          });
        } else {
          localOpenBlocks.pop();
        }

        chunks.push(renderLines(inner, lineNum));
        chunks.push('</div>');
        continue;
      }

      mdBuffer.push(line);
      j++;
    }

    flushMd();

    if (baseLineNum === 0) {
      for (const u of palette.unclosed()) {
        if (!u.fromInline) {
          addError('unclosed_color_region', u.line, `unclosed color region at line ${u.line} (${u.palette?.join(', ')}) — auto-closed`, {
            palette: u.palette,
            suggestion: {
              action: 'insert',
              content: '^C',
              line: lines.length,
              description: `Insert '^C' to close the color region opened at line ${u.line}`
            }
          });
        }
      }
      for (const u of styleStack.unclosed()) {
        if (!u.fromInline) {
          addError('unclosed_style_region', u.line, `unclosed style region at line ${u.line} — auto-closed`, {
            suggestion: {
              action: 'insert',
              content: '^S',
              line: lines.length,
              description: `Insert '^S' to close the style region opened at line ${u.line}`
            }
          });
        }
      }
      for (let k = 0; k < styleStack.stack.length - 1; k++)
        chunks.push('</div>');
    }

    return chunks.join('\n');
  }

  const body = renderLines(lines);

  if (errors.length > 0) {
    if (json) {
      console.error(JSON.stringify({ status: 'error', errors }, null, 2));
      process.exit(1);
    } else if (strict) {
      console.error(`[bildup] ERROR: ${errors.length} warning(s)/error(s) in strict mode. Aborting.`);
      process.exit(1);
    }
  }
  if (warnings.length > 0 && !json) {
    console.warn(`[bildup] Auto-closed ${warnings.length} unclosed region(s). Output may be malformed.`);
  }

  const runtime = `<script>
const _fns=${JSON.stringify(fns)};
function bildupAutoEval() {
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
}
function bildupUpdateReactive() {
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
}
function bildupUpdateStates() {
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
}
function bildupUpdate() {
  bildupAutoEval();
  bildupUpdateReactive();
  bildupUpdateStates();
}
function bildupCalc(ids){
  bildupUpdate();
}
async function bildupSubmit(url,e){
  e.preventDefault();
  const payload={};
  document.querySelectorAll('input[id],textarea[id]').forEach(el=>payload[el.id]=el.value);
  try{
    await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    alert('Submitted!');
  }catch(err){alert('Submission failed: '+err.message);}
}

// Attach event listeners
document.addEventListener('input', (e) => {
  if (e.target && e.target.id) {
    bildupUpdate();
  }
});
document.addEventListener('change', (e) => {
  if (e.target && e.target.id) {
    bildupUpdate();
  }
});

// Run once on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bildupUpdate();
  });
} else {
  bildupUpdate();
}
${scripts.join('\n')}
</script>`;

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

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>${CSS}</style>
</head>
<body>
${body}
${runtime}
</body>
</html>`;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--strict-json') || args.includes('--ai-json');
  const strict = args.includes('--strict') || jsonMode;
  const promptMode = args.includes('--prompt');

  if (promptMode) {
    const promptText = `You write in bildup, a superset of markdown. All standard markdown works unchanged.
Additional syntax:
COLOR REGIONS
^C(primary, secondary, accent) - open; colors are named or hex
^C - close
^primary[text]^ ^secondary[text]^ ^accent[text]^ - inline

STYLE REGIONS
^S(flex, row, gap=2) - open; attrs: flex grid row col gap=N wrap
^S - close

BLOCKS
::[attrs] - open; attrs: pad=N bg= fg= flex grid row col gap=N show-if=[!]id state-empty="cls" state-error="cls"
::#id[attrs] - named block
:: - close

TABLES (first row = header)
::table[striped]
Col1, Col2, Col3
Val1, Val2, Val3
::

COMPONENTS (self-closing)
::input#id[text placeholder="..." show-if=[!]id state-empty="cls"]/
::input#id[number value=0]/
::input#id[textarea placeholder="..."]/
::button[label="Text" primary show-if=[!]id state-empty-otherInput="cls"]/
::button[label="Text" action=navigate target="#id"]/
::button[label="Text" action=submit target="https://..."]/
::output#id[label="Result:" fn=fnName]/

FUNCTIONS
::fn#name
  expression using input ids as variables
::fn

SOURCE INHERITANCE
::source ./file.bu - inline substitute, regions auto-closed
::source ./theme.bu inline - raw substitute, regions bleed into parent

SCRIPT PASSTHROUGH
::script
// raw JS
::script

Color names: midnight, snow, electric, slate, cream, gold, navy, coral, lime, crimson, obsidian, amber, or hex.
Extension: .bu`;
    console.log(promptText);
    process.exit(0);
  }

  const inputPath = args.find(a => !a.startsWith('-'));
  const outFlag = args.indexOf('-o');
  const outputPath = outFlag !== -1 ? args[outFlag + 1] : null;

  if (!inputPath) {
    console.error('Usage: bildup <input.bu> [-o output.html] [--strict] [--strict-json] [--ai-json] [--prompt]');
    process.exit(1);
  }

  const resolvedOutput = outputPath || inputPath.replace(/\.(bu|bildup)$/, '') + '.html';
  const title = path.basename(inputPath, path.extname(inputPath));
  const basedir = path.dirname(path.resolve(inputPath));
  const source = fs.readFileSync(inputPath, 'utf8');
  const html = compile(source, { strict, title, basedir, json: jsonMode });

  fs.writeFileSync(resolvedOutput, html, 'utf8');
  if (!jsonMode) {
    console.log(`[bildup] Compiled → ${resolvedOutput}`);
  }
}

module.exports = { compile, resolveSource };
