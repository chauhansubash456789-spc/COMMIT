import fs from 'fs';
let css = fs.readFileSync('public/css/style.backup.css', 'utf8');
let lines = css.split('\n');
console.log('--- Modal rules from backup ---');
for (let i = 765; i < 860; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
