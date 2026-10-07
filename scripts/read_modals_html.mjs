import fs from 'fs';
let html = fs.readFileSync('public/index.html', 'utf8');
let lines = html.split('\n');
console.log('--- Lines 520 to 670 ---');
for (let i = 520; i < 670 && i < lines.length; i++) {
  if (lines[i].includes('modal') || lines[i].includes('Modal') || lines[i].includes('id=')) {
    console.log((i+1) + ': ' + lines[i]);
  }
}
