# Documentation Audit Plan

## Goal Description

Audit the project's `README.md` and the documentation source `docs/index.bu` (and generated `docs/index.html`) to verify that every language feature described in `SPEC.md` is documented, with examples and usage guidance. Ensure the documentation is organized, complete, and that each feature is encapsulated in its own section.

## User Review Required

- Confirm that the scope (README + docs) matches your expectations.  
- Approve proceeding with the audit and any documentation edits that may be required.

## Open Questions

> [!IMPORTANT]
> 1. Do you want the audit to also update the README automatically, or just provide a report of missing items?
> 2. Should we add any new example files or assets (e.g., screenshots) to illustrate features?
> 3. Are there any sections you consider out of scope (e.g., CI workflow docs) that we should ignore?

## Proposed Changes

---
### Documentation Review

- **Read `SPEC.md`** to extract the complete list of language features (color regions, style regions, blocks, tables, components, functions, source inheritance, script passthrough, inline colors, etc.).
- **Parse `README.md`** and locate existing feature sections.
- **Parse `docs/index.bu`** (source for the documentation site) to locate feature sections.
- Compare the two sets and generate a **gap report** listing any missing or incomplete coverage.

---
### Documentation Updates (contingent on approval)

- For each missing feature, add a dedicated subsection to `README.md` and `docs/index.bu` with:
  - Brief description.
  - Syntax examples.
  - Rendered HTML output screenshot (generated via the compiler).
- Ensure each subsection follows the existing style and includes a **Usage Example** comment block as required by the doctrine.
- Update navigation (`#` headings) to maintain a logical hierarchy.

---
### Verification

- Run `node bildup.js docs/index.bu -o docs/index.html` to generate the HTML after changes.
- Verify that the generated documentation displays correctly in a browser (no console errors).
- Ensure all new examples compile without warnings.

---
## Verification Plan

### Automated Tests
- Execute the documentation build command and capture output.
- Search the generated HTML for each newly added feature header to confirm inclusion.

### Manual Verification
- Open the generated `docs/index.html` locally and visually verify that code snippets render as expected.
- Review the updated README on GitHub (rendered markdown) for proper formatting.

---
