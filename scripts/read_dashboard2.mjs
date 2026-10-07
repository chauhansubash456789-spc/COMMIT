import fs from 'fs';
let html = fs.readFileSync('public/index.html', 'utf8');
let lines = html.split('\n');
for (let i = 160; i < 260; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
