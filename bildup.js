#!/usr/bin/env node
'use strict';

// bildup v0.2 — markdown superset compiler for interactive static pages
// https://github.com/your-org/bildup
// MIT License

const { marked } = require('marked');
const fs   = require('fs');
const path = require('path');

// ─── Color palette ────────────────────────────────────────────────────────────
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
  const n = name.trim().toLowerCase();
  return COLOR_MAP[n] || n;
}

// ─── Palette stack ────────────────────────────────────────────────────────────
class PaletteStack {
  constructor() { this.stack = [null]; this.openAt = [null]; }
  push(colors, line) { this.stack.push(colors); this.openAt.push(line); }
  pop() { if (this.stack.length > 1) { this.stack.pop(); this.openAt.pop(); } }
  current() { return this.stack[this.stack.length - 1]; }
  slot(n) { const p = this.current(); return p ? resolveColor(p[n - 1] || '') : null; }
  unclosed() {
    return this.openAt.slice(1).map((line, i) => ({
      type: 'color region', line, palette: this.stack[i + 1]
    }));
  }
}

// ─── Style stack ─────────────────────────────────────────────────────────────
class StyleStack {
  constructor() { this.stack = [{}]; this.openAt = [null]; }
  push(attrs, line) { this.stack.push(attrs); this.openAt.push(line); }
  pop() { if (this.stack.length > 1) { this.stack.pop(); this.openAt.pop(); } }
  unclosed() { return this.openAt.slice(1).map(line => ({ type: 'style region', line })); }
}

// ─── Attribute parser ─────────────────────────────────────────────────────────
function parseAttrs(str) {
  const attrs = {};
  if (!str) return attrs;
  const tokens = str.match(/(\w+)=(?:"[^"]*"|\S+)|\w+/g) || [];
  for (const tok of tokens) {
    if (tok.includes('=')) {
      let [k, v] = tok.split('=');
      attrs[k] = v.replace(/^"|"$/g, '');
    } else {
      attrs[tok] = true;
    }
  }
  return attrs;
}

// ─── Slot resolution ──────────────────────────────────────────────────────────
const SLOT_NAMES = { primary: 1, secondary: 2, accent: 3 };

function resolveValue(val, palette) {
  if (typeof val !== 'string') return val;
  const lower = val.toLowerCase();
  if (SLOT_NAMES[lower] !== undefined) return palette.slot(SLOT_NAMES[lower]);
  if (/^\^[123]$/.test(val)) return palette.slot(parseInt(val[1]));
  return val;
}

// ─── CSS builder ──────────────────────────────────────────────────────────────
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
    if (t === '^C' && cDepth > 0)  cDepth--;
    if (t.match(/^\^S\([^)]+\)$/)) sDepth++;
    if (t === '^S' && sDepth > 0)  sDepth--;
  }
  const closes = [];
  for (let i = 0; i < sDepth; i++) closes.push('^S');
  for (let i = 0; i < cDepth; i++) closes.push('^C');
  return [...lines, ...closes];
}

function resolveSource(source, basedir, seen = new Set()) {
  const lines  = source.split('\n');
  const output = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(/^::source\s+(\S+)(\s+inline)?$/);
    if (!m) { output.push(line); continue; }

    const filePath   = path.resolve(basedir, m[1]);
    const inlineMode = !!m[2];

    if (seen.has(filePath)) {
      console.warn(`[bildup] WARNING: circular ::source — ${filePath} skipped`);
      continue;
    }
    if (!fs.existsSync(filePath)) {
      console.warn(`[bildup] WARNING: ::source not found — ${filePath}`);
      continue;
    }

    const childSrc  = fs.readFileSync(filePath, 'utf8');
    const childSeen = new Set([...seen, filePath]);
    const childDir  = path.dirname(filePath);
    const resolved  = resolveSource(childSrc, childDir, childSeen);

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
function compile(source, opts = {}) {
  const { strict = false, title = 'bildup', basedir = process.cwd() } = opts;

  const flat       = resolveSource(source, basedir);
  const lines      = flat.split('\n');
  const palette    = new PaletteStack();
  const styleStack = new StyleStack();
  const scripts    = [];
  const fns        = {};
  const warnings   = [];

  function warn(msg) {
    warnings.push(msg);
    console.warn(`[bildup] WARNING: ${msg}`);
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

  function renderComponent(tag, id, attrs) {
    const idAttr = id ? ` id="${id}"` : '';
    switch (tag) {
      case 'input': {
        const type = Object.keys(attrs).find(k =>
          ['text','email','number','password','tel','url'].includes(k)) || 'text';
        const ph  = attrs.placeholder || '';
        const val = attrs.value !== undefined ? ` value="${attrs.value}"` : '';
        if (attrs.textarea)
          return `<textarea${idAttr} placeholder="${ph}" class="bildup-input">${attrs.value||''}</textarea>`;
        return `<input${idAttr} type="${type}" placeholder="${ph}"${val} class="bildup-input">`;
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
        return `<button${idAttr} class="${cls}"${onclick}>${label}</button>`;
      }
      case 'output': {
        const dataFn = attrs.fn ? ` data-fn="${attrs.fn}"` : '';
        return `<div class="bildup-output"${idAttr}${dataFn}>`
          + `<span class="bildup-output-label">${attrs.label||''}</span>`
          + `<span class="bildup-output-value">—</span></div>`;
      }
      default:
        return `<!-- unknown component: ${tag} -->`;
    }
  }

  function renderLines(lineArr, baseLineNum = 0) {
    const chunks          = [];
    const localOpenBlocks = [];
    let j        = 0;
    let mdBuffer = [];

    function flushMd() {
      if (!mdBuffer.length) return;
      const raw = mdBuffer.join('\n');
      mdBuffer  = [];
      if (raw.trim()) chunks.push(processInlineColor(marked.parse(raw), palette));
    }

    while (j < lineArr.length) {
      const line    = lineArr[j];
      const trimmed = line.trim();
      const lineNum = baseLineNum + j + 1;

      // Skip source sentinel comments
      if (trimmed.startsWith('<!-- source:') || trimmed.startsWith('<!-- /source:')) {
        j++; continue;
      }

      const cOpen = trimmed.match(/^\^C\(([^)]+)\)$/);
      if (cOpen) {
        flushMd();
        palette.push(cOpen[1].split(',').map(s => s.trim()), lineNum);
        j++; continue;
      }

      if (trimmed === '^C') {
        flushMd();
        if (palette.stack.length <= 1) warn(`^C close at line ${lineNum} has no matching open`);
        else palette.pop();
        j++; continue;
      }

      const sOpen = trimmed.match(/^\^S\(([^)]+)\)$/);
      if (sOpen) {
        flushMd();
        const css = attrsToCSS(parseAttrs(sOpen[1]), palette);
        styleStack.push({}, lineNum);
        chunks.push(`<div style="${css};width:100%">`);
        j++; continue;
      }

      if (trimmed === '^S') {
        flushMd();
        if (styleStack.stack.length <= 1) warn(`^S close at line ${lineNum} has no matching open`);
        else { styleStack.pop(); chunks.push('</div>'); }
        j++; continue;
      }

      const tableOpen = trimmed.match(/^::table(\[([^\]]*)\])?$/);
      if (tableOpen) {
        flushMd();
        const attrs = parseAttrs(tableOpen[2] || '');
        const csvLines = [];
        const openLine = lineNum;
        j++;
        while (j < lineArr.length && lineArr[j].trim() !== '::') {
          if (lineArr[j].trim()) csvLines.push(lineArr[j].trim());
          j++;
        }
        if (j >= lineArr.length) warn(`unclosed ::table at line ${openLine} — reached EOF`);
        else j++;
        chunks.push(renderTable(csvLines, attrs));
        continue;
      }

      const fnOpen = trimmed.match(/^::fn#(\w+)$/);
      if (fnOpen) {
        const fnId = fnOpen[1], body = [], openLine = lineNum;
        j++;
        while (j < lineArr.length && lineArr[j].trim() !== '::fn') {
          body.push(lineArr[j].trim()); j++;
        }
        if (j >= lineArr.length) warn(`unclosed ::fn#${fnId} at line ${openLine}`);
        else j++;
        fns[fnId] = body.join(' ').trim();
        continue;
      }

      if (trimmed === '::script') {
        const scriptLines = [], openLine = lineNum;
        j++;
        while (j < lineArr.length && lineArr[j].trim() !== '::script') {
          scriptLines.push(lineArr[j]); j++;
        }
        if (j >= lineArr.length) warn(`unclosed ::script at line ${openLine}`);
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
        if (!localOpenBlocks.length) warn(`unexpected :: close at line ${lineNum}`);
        else { localOpenBlocks.pop(); chunks.push('</div>'); }
        j++; continue;
      }

      const blockOpen = trimmed.match(/^::([\w]*)(#\w+)?\[([^\]]*)\]$/) ||
                        trimmed.match(/^::([\w]+)(#\w+)?$/);
      if (blockOpen) {
        flushMd();
        const tag     = blockOpen[1] || 'div';
        const idPart  = blockOpen[2];
        const attrStr = blockOpen[3] || '';
        const id      = idPart ? idPart.slice(1) : null;
        const css     = attrsToCSS(parseAttrs(attrStr), palette);
        const idAttr  = id  ? ` id="${id}"` : '';
        const cssAttr = css ? ` style="${css}"` : '';

        localOpenBlocks.push({ tag, attrStr, lineNum });
        chunks.push(`<div${idAttr}${cssAttr} class="bildup-block">`);

        const inner = [];
        let depth = 1, foundClose = false;
        j++;
        while (j < lineArr.length) {
          const it = lineArr[j].trim();
          const isOpen = (it.match(/^::([\w]*)(#\w+)?\[([^\]]*)\]$/) ||
                          it.match(/^::([\w]+)(#\w+)?$/)) &&
                         !it.match(/^::([\w]+)(#\w+)?\[.*\]\/$/);
          if (isOpen && it !== '::') depth++;
          if (it === '::') { depth--; if (depth === 0) { j++; foundClose = true; break; } }
          inner.push(lineArr[j]); j++;
        }

        if (!foundClose) {
          warn(`unclosed block ${attrStr ? `::[${attrStr}]` : `::${tag}`} at line ${lineNum} — auto-closed`);
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
      for (const u of palette.unclosed())
        warn(`unclosed ${u.type} at line ${u.line} (${u.palette?.join(', ')}) — auto-closed`);
      for (const u of styleStack.unclosed())
        warn(`unclosed ${u.type} at line ${u.line} — auto-closed`);
      for (let k = 0; k < styleStack.stack.length - 1; k++)
        chunks.push('</div>');
    }

    return chunks.join('\n');
  }

  const body = renderLines(lines);

  if (strict && warnings.length > 0) {
    console.error(`[bildup] ERROR: ${warnings.length} warning(s) in strict mode. Aborting.`);
    process.exit(1);
  }
  if (warnings.length > 0)
    console.warn(`[bildup] Auto-closed ${warnings.length} unclosed region(s). Output may be malformed.`);

  const runtime = `<script>
const _fns=${JSON.stringify(fns)};
function bildupCalc(ids){
  const vars={};
  document.querySelectorAll('input[id],textarea[id]').forEach(el=>{
    const v=parseFloat(el.value);vars[el.id]=isNaN(v)?el.value:v;
  });
  ids.forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const fnId=el.dataset.fn;if(!fnId||!_fns[fnId])return;
    let expr=_fns[fnId];
    Object.keys(_fns).forEach(n=>{expr=expr.replace(new RegExp('\\b'+n+'\\b','g'),'('+_fns[n]+')');});
    try{
      const result=new Function(...Object.keys(vars),'return '+expr)(...Object.values(vars));
      el.querySelector('.bildup-output-value').textContent=typeof result==='number'?result.toFixed(2):result;
    }catch(e){el.querySelector('.bildup-output-value').textContent='err';}
  });
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
.bildup-input{display:block;width:100%;padding:.55rem .75rem;background:#1a1a1a;border:1px solid #333;border-radius:4px;color:#e8e8e8;font-size:1rem;font-family:inherit;margin:.4rem 0;transition:border-color .15s}
.bildup-input:focus{outline:none;border-color:#00eeff}textarea.bildup-input{min-height:100px;resize:vertical}
.bildup-btn{display:inline-block;padding:.55rem 1.25rem;background:#222;border:1px solid #444;border-radius:4px;color:#e8e8e8;font-size:.95rem;font-family:inherit;cursor:pointer;margin:.4rem .3rem .4rem 0;transition:background .15s,border-color .15s}
.bildup-btn:hover{background:#2a2a2a;border-color:#666}
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
  const args       = process.argv.slice(2);
  const strict     = args.includes('--strict');
  const inputPath  = args.find(a => !a.startsWith('-'));
  const outFlag    = args.indexOf('-o');
  const outputPath = outFlag !== -1 ? args[outFlag + 1] : null;

  if (!inputPath) {
    console.error('Usage: bildup <input.bu> [-o output.html] [--strict]');
    process.exit(1);
  }

  const resolvedOutput = outputPath || inputPath.replace(/\.(bu|bildup)$/, '') + '.html';
  const title   = path.basename(inputPath, path.extname(inputPath));
  const basedir = path.dirname(path.resolve(inputPath));
  const source  = fs.readFileSync(inputPath, 'utf8');
  const html    = compile(source, { strict, title, basedir });

  fs.writeFileSync(resolvedOutput, html, 'utf8');
  console.log(`[bildup] Compiled → ${resolvedOutput}`);
}

module.exports = { compile, resolveSource };
