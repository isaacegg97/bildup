# Bildup Language Specification

Version 0.2

Bildup is a superset of CommonMark markdown. All valid markdown is valid bildup. This document describes only the extensions.

---

## File format

Bildup files use the `.bu` extension. The compiler produces a single self-contained `.html` file with all styles and scripts inlined. `.bildup` is accepted as a legacy alias.

---

## Color regions

A color region defines a three-slot palette scoped to a section of the document. Regions are lexically scoped and nestable. Inner regions override the outer palette for their scope; the outer palette resumes on close.

**Open:**
```
^C(primary, secondary, accent)
```

Each slot is a color name or hex value. Slots are referenced by name: `primary`, `secondary`, `accent`.

**Close:**
```
^C
```

**Inline color:**
```
^primary[text here]^
^secondary[text here]^
^accent[text here]^
```

**Example:**
```
^C(crimson, obsidian, amber)

^primary[This is crimson.]^ ^accent[This is amber.]^

^C
```

**Nesting:**
```
^C(slate, cream, gold)
Outer palette active.

  ^C(navy, coral, lime)
  Inner palette active. ^primary[Navy.]^
  ^C

Outer palette resumes. ^primary[Slate.]^
^C
```

---

## Style regions

A style region wraps content in a layout container. Orthogonal to color regions — each closes independently.

**Open:**
```
^S(attrs)
```

**Close:**
```
^S
```

**Attributes:**

| Attribute | Effect |
|-----------|--------|
| `flex` | `display: flex` |
| `grid` | `display: grid` |
| `row` | `flex-direction: row` |
| `col` | `flex-direction: column` |
| `gap=N` | `gap: N×0.5rem` |
| `wrap` | `flex-wrap: wrap` |

**Example:**
```
^S(flex, row, gap=3)
::[pad=2]
Column one
::
::[pad=2]
Column two
::
^S
```

---

## Blocks

A block is a styled container. Closes with `::`. Can contain any bildup content including other blocks, markdown, and components.

**Open:**
```
::[attrs]
```

**Named block** (produces an `id` attribute):
```
::#hero[attrs]
content
::
```

**Close:**
```
::
```

**Attributes:**

| Attribute | Effect |
|-----------|--------|
| `pad=N` | `padding: N×0.5rem` |
| `bg=color` | background color |
| `fg=color` | text color |
| `flex` | `display: flex` |
| `grid` | `display: grid` |
| `row` | `flex-direction: row` |
| `col` | `flex-direction: column` |
| `gap=N` | `gap: N×0.5rem` |
| `wrap` | `flex-wrap: wrap` |

`bg` and `fg` accept color names, hex values, or palette slot names (`primary`, `secondary`, `accent`) when inside a `^C` region.

**Example:**
```
^C(midnight, snow, electric)
::[pad=4 bg=primary fg=secondary]
# ^accent[Hello.]^
Content inside a dark block with light text and an electric accent.
::
^C
```

---

## Tables

Tables use CSV syntax. First row is always the header.

```
::table
Header1, Header2, Header3
Row1Col1, Row1Col2, Row1Col3
::
```

**Attributes:**

| Attribute | Effect |
|-----------|--------|
| `striped` | Alternating row background |
| `border` | Full cell borders |

---

## Components

Self-closing syntax: `::tag#id[attrs]/`

### Input

```
::input#id[text placeholder="Your name"]/
::input#id[email placeholder="Your email"]/
::input#id[number value=0]/
::input#id[textarea placeholder="Message"]/
```

Types: `text`, `email`, `number`, `password`, `tel`, `url`, `textarea`.

### Button

```
::button[label="Text"]/
::button[label="Text" primary]/
::button[label="Text" action=navigate target="#section"]/
::button[label="Text" action=submit target="https://api.example.com/endpoint"]/
::button[label="Text" action=calc targets="outputId1,outputId2"]/
```

| Action | Behavior |
|--------|----------|
| `navigate` | `window.location = target` |
| `submit` | POST all named inputs as JSON to `target` |
| `calc` | Evaluate `::fn` expressions and update named outputs |

### Output

```
::output#id[label="Result:" fn=fnName]/
```

---

## Functions

Named expressions for use with `::output` and `action=calc`. Input element ids are available as variables.

```
::fn#tip
  subtotal * (pct / 100)
::fn

::fn#total
  subtotal + tip
::fn
```

Function names can reference other functions within expressions.

---

## Script passthrough

Raw JavaScript passed directly into the compiled page, emitted at the bottom of the body.

```
::script
document.getElementById('myInput').addEventListener('input', () => {
  // your code
});
::script
```

---

## Source inheritance

`::source` performs inline textual substitution of another `.bu` file before compilation. The sourced file's content replaces the directive line exactly — palette regions, blocks, functions, and scripts all land at the point of inclusion.

**Wrapped (default):** unclosed `^C` and `^S` regions in the sourced file are automatically closed at the end of its content. Palette state does not bleed into the parent.

```
::source ./nav.bu
::source ./components/hero.bu
```

**Inline:** raw substitution, no auto-closing. Palette and style state from the sourced file carries into the parent document. Use for theme files that intentionally set document-wide state.

```
::source ./theme.bu inline
```

**Recursive:** sourced files may themselves contain `::source` directives. Resolution is depth-first.

**Circular detection:** if file A sources file B which sources file A, the cycle is detected and the repeated include is skipped with a warning.

**Example — shared theme:**
```
// theme.bu
^C(midnight, snow, electric)
```

```
// page.bu
::source ./theme.bu inline

^primary[Dark background page]^

^C
```

**Example — shared component:**
```
// nav.bu
^C(midnight, snow, electric)
::[pad=2 bg=primary fg=secondary]
**My Site** — Navigation
::
^C
```

```
// page.bu
::source ./nav.bu

# Page content below the nav
```

---

## Error handling

The compiler tracks open regions and blocks. On EOF with unclosed regions:

- **Default:** warns with line number, auto-closes, emits output
- **`--strict`:** aborts with exit code 1, no output written

```
[bildup] WARNING: unclosed block ::[flex row] at line 42 — auto-closed
[bildup] WARNING: unclosed color region at line 17 — auto-closed
[bildup] WARNING: circular ::source — /path/to/file.bu skipped
[bildup] Auto-closed 2 unclosed region(s). Output may be malformed.
```

---

## Client-side rendering

`bildup-browser.js` renders `.bu` files directly in the browser. No compile step.

**External file:**
```html
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="bildup-browser.js"></script>
<script type="text/bildup" src="page.bu"></script>
```

**Inline:**
```html
<script src="bildup-browser.js"></script>
<script type="text/bildup">
# My Page
^C(crimson, obsidian, amber)
^primary[Hello world]^
^C
</script>
```

**Programmatic:**
```js
const { html, fns, scripts } = await bildup.render(source);
await bildup.mount(source, document.getElementById('app'));
```

`::source` in browser mode fetches files relative to the current page URL. All fetches resolve before render begins.

---

## Color names

In addition to standard CSS color names and hex values (`#rrggbb`):

| Name | Value | Name | Value |
|------|-------|------|-------|
| `midnight` | `#0d1117` | `slate` | `#475569` |
| `snow` | `#f8f9fa` | `cream` | `#fdf6e3` |
| `electric` | `#00eeff` | `gold` | `#f59e0b` |
| `surface` | `#1e1e2e` | `navy` | `#1e3a5f` |
| `muted` | `#6b7280` | `coral` | `#ff6b6b` |
| `crimson` | `#dc2626` | `lime` | `#84cc16` |
| `obsidian` | `#1c1c1e` | `amber` | `#f59e0b` |

---

## LLM system prompt

```
You write in bildup, a superset of markdown. All standard markdown works
unchanged. Additional syntax:

COLOR REGIONS
^C(primary, secondary, accent)  — open; colors are named or hex
^C                               — close
^primary[text]^  ^secondary[text]^  ^accent[text]^  — inline

STYLE REGIONS
^S(flex, row, gap=2)  — open; attrs: flex grid row col gap=N wrap
^S                     — close

BLOCKS
::[attrs]       — open; attrs: pad=N bg= fg= flex grid row col gap=N
::#id[attrs]    — named block
::              — close

TABLES (first row = header)
::table[striped]
Col1, Col2, Col3
Val1, Val2, Val3
::

COMPONENTS (self-closing)
::input#id[text placeholder="..."]/
::input#id[number value=0]/
::input#id[textarea placeholder="..."]/
::button[label="Text" primary]/
::button[label="Text" action=navigate target="#id"]/
::button[label="Text" action=submit target="https://..."]/
::button[label="Text" action=calc targets="out1,out2"]/
::output#id[label="Result:" fn=fnName]/

FUNCTIONS
::fn#name
  expression using input ids as variables
::fn

SOURCE INHERITANCE
::source ./file.bu          — inline substitute, regions auto-closed
::source ./theme.bu inline  — raw substitute, regions bleed into parent

SCRIPT PASSTHROUGH
::script
// raw JS
::script

Color names: midnight, snow, electric, slate, cream, gold, navy,
coral, lime, crimson, obsidian, amber, or any hex value.
Extension: .bu
```
