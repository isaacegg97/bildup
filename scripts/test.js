const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const examplesDir = path.join(__dirname, '../examples');
const examples = fs.readdirSync(examplesDir).filter(f => f.endsWith('.bu'));

let failed = false;

console.log('--- Running Bildup Compiler Tests ---');

examples.forEach(example => {
  const input = path.join(examplesDir, example);
  const output = path.join(examplesDir, example.replace('.bu', '.html'));
  
  try {
    console.log(`Testing: ${example}...`);
    // Run with --strict to ensure no warnings/errors
    execSync(`node bildup.js "${input}" -o "${output}" --strict`, { stdio: 'inherit' });
    console.log(`✅ ${example} compiled successfully.`);
    
    // Clean up
    if (fs.existsSync(output)) fs.unlinkSync(output);
  } catch (err) {
    console.error(`❌ ${example} failed to compile.`);
    failed = true;
  }
});

if (failed) {
  process.exit(1);
} else {
  console.log('--- All tests passed! ---');
}
