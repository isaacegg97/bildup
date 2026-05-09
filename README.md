# bildup

A markdown superset that compiles to self-contained static HTML. Write content and layout in a readable format, compile to a real page — or skip the compile step entirely and render in the browser.

```bash
bildup page.bu
```

---

## What it is

Standard markdown, plus:

- **Scoped color palettes** — three named slots, reference them anywhere in the region
- **Layout blocks** — flex and grid containers without writing CSS
- **CSV tables** — no pipe syntax, no alignment ceremony
- **Interactive components** — inputs, buttons, outputs wired to local expressions
- **Source inheritance** — pull in other `.bu` files as reusable components or themes
- **Client-side rendering** — no compile step, render `.bu` files directly in the browser
- **Script passthrough** — drop to raw JS when you need to

All standard markdown — headings, bold, italic, code, links, lists, blockquotes — works unchanged.

---

## Install

```bash
npm install -g bildup
```

Requires Node.js. Depends on `marked` (`npm install marked`).

---

## CLI usage

```bash
bildup input.bu                  # compiles to input.html
bildup input.bu -o output.html   # explicit output path
bildup input.bu --strict         # abort on any warnings
```

---

## Browser usage

No compile step. Drop this into any HTML file:

```html
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="bildup-browser.js"></script>

<!-- External .bu file -->
<script type="text/bildup" src="page.bu"></script>

<!-- Or inline -->
<script type="text/bildup">
# Hello

^C(crimson, obsidian, amber)
^primary[Primary]^ ^secondary[Secondary]^ ^accent[Accent]^
^C
</script>
```

Programmatic API:

```js
await bildup.mount(source, document.getElementById('app'));

const { html, fns, scripts } = await bildup.render(source);
```

---

## Quick example

```
# My Page

^C(crimson, obsidian, amber)

^primary[Primary]^ ^secondary[Secondary]^ ^accent[Accent]^

^S(flex, row, gap=3)
::[pad=3 bg=primary fg=secondary]
Left column.
::
::[pad=3 bg=secondary fg=primary]
Right column.
::
^S

^C

---

::table[striped]
Name, Role, Years
Alice, Engineer, 4
Bob, Designer, 2
::

::input#email[email placeholder="Your email"]/
::button[label="Subscribe" primary]/
```

---

## Source inheritance

Pull in other `.bu` files as reusable components:

```
::source ./nav.bu          # wrapped — regions auto-close, no bleed
::source ./theme.bu inline # raw — palette bleeds into parent document
```

Sourced files resolve recursively. Circular references are detected and skipped with a warning.

---

## Spec

See [SPEC.md](./SPEC.md) for the full language reference and LLM system prompt.

---

## Files

| File | Purpose |
|------|---------|
| `bildup.js` | CLI compiler and Node.js library |
| `bildup-browser.js` | Client-side renderer |
| `SPEC.md` | Full language reference |
| `example.bu` | Basic feature showcase |
| `showcase.bu` | Bildup vs markdown comparison |

---

## License

MIT
