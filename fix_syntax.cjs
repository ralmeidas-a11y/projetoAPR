const fs = require('fs');
const code = fs.readFileSync('server/index.js', 'utf8');
const lines = code.split(/\r?\n/);

// Proper try/catch/finally matching with stack
let braceDepth = 0;
let tryStack = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  const hasTry = /\btry\s*\{/.test(line);
  const hasCatch = /\}\s*catch\s*[\({]/.test(line);
  const hasFinally = /\}\s*finally\s*\{/.test(line);
  
  if (hasCatch) {
    const closingDepth = braceDepth - 1;
    let found = false;
    for (let j = tryStack.length - 1; j >= 0; j--) {
      if (tryStack[j].braceDepthBefore === closingDepth && !tryStack[j].caught) {
        tryStack[j].caught = true;
        tryStack[j].catchLine = lineNum;
        found = true;
        break;
      }
    }
    if (!found) {
      console.log(`WARNING: catch at line ${lineNum} depth ${closingDepth} has no matching try!`);
    }
  }
  
  if (hasFinally && !hasCatch) {
    const closingDepth = braceDepth - 1;
    for (let j = tryStack.length - 1; j >= 0; j--) {
      if (tryStack[j].braceDepthBefore === closingDepth && !tryStack[j].finalized) {
        tryStack[j].finalized = true;
        tryStack[j].finallyLine = lineNum;
        break;
      }
    }
  }
  
  if (hasTry) {
    tryStack.push({ line: lineNum, braceDepthBefore: braceDepth, caught: false, finalized: false });
  }

  for (const ch of line) {
    if (ch === '{') braceDepth++;
    if (ch === '}') braceDepth--;
  }
}

const unmatched = tryStack.filter(t => !t.caught && !t.finalized);
console.log(`Total try: ${tryStack.length}, Unmatched: ${unmatched.length}, Final brace depth: ${braceDepth}`);
unmatched.forEach(t => {
  console.log(`  UNMATCHED try at line ${t.line} (depth ${t.braceDepthBefore}): ${lines[t.line-1].trim()}`);
});

console.log('\nAll try/catch pairs near problem area (1600-2400):');
tryStack.filter(t => t.line >= 1600 && t.line <= 2400).forEach(t => {
  const status = t.caught ? `catch@${t.catchLine}` : (t.finalized ? `finally@${t.finallyLine}` : 'UNMATCHED');
  console.log(`  try@${t.line}(depth${t.braceDepthBefore}) -> ${status}`);
});

// Brace depth trace for lines 2368-2385
console.log('\nDetailed brace depth trace (2368-2385):');
let d = 0;
for (let i = 0; i < 2367; i++) {
  for (const ch of lines[i]) { if (ch === '{') d++; if (ch === '}') d--; }
}
for (let i = 2367; i < 2385 && i < lines.length; i++) {
  let prev = d;
  for (const ch of lines[i]) { if (ch === '{') d++; if (ch === '}') d--; }
  console.log(`  L${i+1}: ${prev}->${d}  ${lines[i].trimEnd().substring(0, 80)}`);
}
