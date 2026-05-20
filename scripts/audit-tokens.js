/**
 * Purpose: Computes token consumption of Bildup vs HTML/Tailwind templates and updates the README badge.
 * Authors: Antigravity
 * Timestamp: 2026-05-20
 * Footguns:
 *   - The cl100k_base encoder requires node to have network or local access to cache if not pre-bundled.
 *   - README.md must exist and contain the badge string pattern.
 * Usage Example:
 *   node scripts/audit-tokens.js
 */
const fs = require('fs');
const path = require('path');
const { getEncoding } = require('js-tiktoken');

const encoding = getEncoding('cl100k_base');

const pairs = [
  {
    name: 'Dashboard',
    bu: 'benchmarks/bildup/dashboard.bu',
    html: 'benchmarks/html-tailwind/dashboard.html'
  },
  {
    name: 'Datagrid',
    bu: 'benchmarks/bildup/datagrid.bu',
    html: 'benchmarks/html-tailwind/datagrid.html'
  },
  {
    name: 'Settings',
    bu: 'benchmarks/bildup/settings.bu',
    html: 'benchmarks/html-tailwind/settings.html'
  }
];

function runAudit() {
  let totalHtmlTokens = 0;
  let totalBuTokens = 0;
  const results = [];

  console.log('--- Bildup vs HTML/Tailwind Token Audit ---');

  for (const pair of pairs) {
    const buPath = path.join(__dirname, '..', pair.bu);
    const htmlPath = path.join(__dirname, '..', pair.html);

    if (!fs.existsSync(buPath) || !fs.existsSync(htmlPath)) {
      console.error(`Error: missing files for ${pair.name}`);
      continue;
    }

    const buText = fs.readFileSync(buPath, 'utf8');
    const htmlText = fs.readFileSync(htmlPath, 'utf8');

    const buTokens = encoding.encode(buText).length;
    const htmlTokens = encoding.encode(htmlText).length;

    totalBuTokens += buTokens;
    totalHtmlTokens += htmlTokens;

    const savings = ((htmlTokens - buTokens) / htmlTokens) * 100;
    results.push({
      Name: pair.name,
      'HTML (Tailwind)': htmlTokens,
      Bildup: buTokens,
      'Savings %': `${savings.toFixed(1)}%`
    });
  }

  console.table(results);

  const avgSavings = ((totalHtmlTokens - totalBuTokens) / totalHtmlTokens) * 100;
  console.log(`\nCombined HTML Tokens: ${totalHtmlTokens}`);
  console.log(`Combined Bildup Tokens: ${totalBuTokens}`);
  console.log(`Weighted Token Savings: ${avgSavings.toFixed(2)}%\n`);

  // Update README.md badge
  const readmePath = path.join(__dirname, '..', 'README.md');
  if (fs.existsSync(readmePath)) {
    let readmeText = fs.readFileSync(readmePath, 'utf8');
    const badgeRegex = /https:\/\/img\.shields\.io\/badge\/token_savings-[\w%]+-blue/g;
    const newBadge = `https://img.shields.io/badge/token_savings-${avgSavings.toFixed(1)}%25-blue`;
    
    if (badgeRegex.test(readmeText)) {
      readmeText = readmeText.replace(badgeRegex, newBadge);
      fs.writeFileSync(readmePath, readmeText, 'utf8');
      console.log(`Updated README.md token savings badge to: ${avgSavings.toFixed(1)}%`);
    } else {
      console.warn('Warning: Could not find badge placeholder in README.md.');
    }
  }
}

runAudit();
