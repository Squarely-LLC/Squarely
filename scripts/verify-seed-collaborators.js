const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'src', 'data', 'seed-todos.ts');
if (!fs.existsSync(filePath)) {
  console.error('seed-todos.ts not found at', filePath);
  process.exit(2);
}

const content = fs.readFileSync(filePath, 'utf8');
const regex = /collaborators:\s*\[([^\]]*)\]/g;
let match;
const issues = [];
while ((match = regex.exec(content)) !== null) {
  const inner = match[1].trim();
  const startIndex = match.index;
  const before = content.slice(0, startIndex);
  const line = before.split('\n').length;

  // empty array or only whitespace is okay
  if (inner.length === 0) continue;

  // If it contains at least one C.<name> token, consider ok
  if (/\bC\.[a-zA-Z0-9_]+\b/.test(inner)) continue;

  // Otherwise flag as issue
  issues.push({ line, snippet: inner });
}

if (issues.length === 0) {
  console.log('OK: all collaborator arrays reference C.* aliases or are empty.');
  process.exit(0);
}

console.error('Found collaborator arrays without C.* references:');
for (const it of issues) {
  console.error(`  line ${it.line}: ${it.snippet}`);
}
process.exit(3);
