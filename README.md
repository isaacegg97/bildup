# bildup

**A markdown superset that compiles to self-contained static HTML.**

Write content and layout in a readable format, compile to a real page — or skip the compile step entirely and render directly in the browser.

```bash
bildup page.bu
```

---

## 🚀 Philosophy

Bildup is designed for **dynamic documentation** and **fast prototyping**. 

Most "static site" solutions today require a complex build chain just to get a button and a flexbox layout. Bildup bridges this gap by adding just enough syntax to Markdown to allow for **layout control** and **interactivity** without sacrificing the readability of a plain text file.

- **Zero-Build by Design**: Use `bildup-browser.js` to render `.bu` files directly. No NPM needed.
- **Token Efficient**: Designed to be easily generated and parsed by both humans and LLMs.
- **Self-Contained**: Compiles to a single HTML file with zero external dependencies.

---

## ✨ Features

Standard markdown, plus:

- **Scoped color palettes** — three named slots (`primary`, `secondary`, `accent`), reference them anywhere in the region.
- **Layout blocks** — flex and grid containers without writing CSS.
- **CSV tables** — no pipe syntax, no alignment ceremony.
- **Interactive components** — inputs, buttons, outputs wired to local expressions.
- **Source inheritance** — pull in other `.bu` files as reusable components or themes.
- **Client-side rendering** — no compile step, render `.bu` files directly in the browser.

---

## 🛠 Installation

```bash
npm install -g bildup
```

---

## 📖 Usage

### CLI Compiler
```bash
bildup input.bu                  # compiles to input.html
bildup input.bu -o output.html   # explicit output path
bildup input.bu --strict         # abort on any warnings
```

### Browser Runtime (Zero Build)
Drop this into any HTML file:

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

---

## 📐 Comparison

| Feature | Standard Markdown | Raw HTML | Bildup |
|---------|-------------------|----------|--------|
| **Layout Control** | None (Single Column) | Full (but verbose) | Flexible (concise) |
| **Interactivity** | None | Full (requires JS) | Declarative (Calc Engine) |
| **Styling** | Browser Default | Explicit CSS | Scoped Palettes |
| **Authoring** | Very Fast | Slow | Fast |

---

## 📜 License

MIT
