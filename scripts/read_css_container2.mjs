import fs from 'fs';
let css = fs.readFileSync('public/css/style.css', 'utf8');
let lines = css.split('\n');
for (let i = 220; i < 300; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
