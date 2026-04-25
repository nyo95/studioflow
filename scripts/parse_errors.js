/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
let raw = fs.readFileSync('lint_report_fixed.json', 'utf8');
// Filter out non-JSON lines (lines starting with > or empty lines at start)
const lines = raw.split('\n');
const jsonStr = lines.filter(l => l.trim().startsWith('[')).join('\n');
const report = JSON.parse(jsonStr);

report.forEach(file => {
  if (file.errorCount > 0) {
    console.log(`\nFile: ${file.filePath}`);
    file.messages.forEach(msg => {
      if (msg.severity === 2) {
        console.log(`  Line ${msg.line}:${msg.column} - ${msg.message} (${msg.ruleId})`);
      }
    });
  }
});
