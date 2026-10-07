import fs from 'fs';
let html = fs.readFileSync('public/index.html', 'utf8');
let lines = html.split('\n');
console.log('Lines 85 to 200:');
for (let i = 85; i < 160; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
