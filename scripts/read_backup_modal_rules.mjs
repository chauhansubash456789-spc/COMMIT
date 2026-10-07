import fs from 'fs';
let css = fs.readFileSync('public/css/style.backup.css', 'utf8');
let lines = css.split('\n');
for (let i = 765; i < 830; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
