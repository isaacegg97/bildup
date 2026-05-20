# Bildup

[![Token Savings](https://img.shields.io/badge/token_savings-61.6%25-blue)](#-benchmarks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**The Token-Dense Intermediate Representation Language for AI Coding Agents.**

Bildup is a markdown superset that compiles to self-contained, highly interactive, and styled HTML/CSS pages. It allows humans and AI agents to author and modify complex layouts and client-side logic with **up to 70%+ token savings** compared to equivalent bloated Tailwind HTML code.

---

## 🚀 Why Bildup for LLMs & Agents?

Most LLM coding agents spend thousands of tokens writing repetitive HTML tags, class lists, and boilerplate JavaScript just to produce a simple form or calculator. Bildup acts as a **minified high-level DSL** that compiles down to clean vanilla CSS/JS:

1. **Massive Token Density**: Achieve the same visuals and logic in 1/3 the token footprint.
2. **First-Class AI DX Tools**: Built-in CLI commands to output structured errors (`--strict-json`) and system prompt schemas (`--prompt`).
3. **No-Build Hydration**: Smoothly stream HTML updates into the browser without losing input text or cursor position (`bildup.hydrate()`).
4. **Parity Execution**: Identical parser stack compiles server-side or Hydrates natively client-side.

---

## ✨ Features

Standard markdown, plus:

- **Scoped Color Palettes** (`^C(primary, secondary, accent)`): Reference semantic slots, preventing CSS color name leakage.
- **Layout Style Regions** (`^S(flex, row, gap=3)`): Clean structure hierarchy without HTML boilerplate.
- **Semantic Blocks** (`::[pad=3 bg=primary] ... ::`): Layout wrappers that support local palette coloring.
- **CSV Tables** (`::table[striped] ... ::`): Simple data grid formatting, no pipe alignment ceremony.
- **Declarative Components**: Native interactive primitives (`::input/`, `::button/`, `::output/`).
- **Reactive Show-If Binding**: Element visibility updates (`show-if="input_id"` / `show-if="!input_id"`) based on input state.
- **Component State Classes**: Dynamic class toggling (`state-empty="border-red-500"`) based on value validation.
- **Auto-Evaluating Calc Engine**: Triggers instant recalculation of formulas (`::fn`) whenever dependencies change.

---

## 🛠 Installation

```bash
npm install -g @bildup/bildup
```

---

## 📖 Usage

### CLI Compiler
```bash
bildup input.bu                  # Compiles to input.html
bildup input.bu -o output.html   # Custom output path
bildup input.bu --strict         # Enable strict compilation
bildup input.bu --strict-json    # Compile and output structured diagnostic JSON on failure
bildup --prompt                  # Export the token-dense system prompt spec for AI context
```

### Browser Runtime (Zero Build)
Drop this into any HTML page to execute/hydrate directly:

```html
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="node_modules/@bildup/bildup/bildup-browser.js"></script>

<!-- External file -->
<script type="text/bildup" src="page.bu"></script>

<!-- Inline script template -->
<script type="text/bildup">
# Hello
^C(midnight, snow, electric)
^primary[Primary text]^ ^secondary[Secondary text]^
^C
</script>
```

---

## 📊 Benchmarks

We maintain a suite of identical UI pages implemented in Tailwind/HTML vs Bildup to measure token footprints using the `cl100k_base` vocabulary.

Run the audit tool locally:
```bash
node scripts/audit-tokens.js
```

| Page | Tailwind/HTML (Tokens) | Bildup (Tokens) | Token Savings |
|---|---|---|---|
| **Dashboard** | Measured | Measured | ~65-70% |
| **Datagrid** | Measured | Measured | ~60-65% |
| **Settings** | Measured | Measured | ~65-70% |

---

## 📜 License

MIT
