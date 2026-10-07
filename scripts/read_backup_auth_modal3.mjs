import fs from 'fs';
let css = fs.readFileSync('public/css/style.backup.css', 'utf8');
let lines = css.split('\n');
for (let i = 975; i < 1080; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
