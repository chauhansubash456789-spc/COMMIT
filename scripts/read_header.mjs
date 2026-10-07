import fs from 'fs';
let html = fs.readFileSync('public/index.html', 'utf8');
let lines = html.split('\n');
console.log('Total lines:', lines.length);
for (let i = 0; i < 90; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
