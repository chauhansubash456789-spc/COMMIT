import fs from 'fs';
let css = fs.readFileSync('public/css/style.backup.css', 'utf8');
let lines = css.split('\n');
for (let i = 2050; i < 2120 && i < lines.length; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
