import fs from 'fs';
let css = fs.readFileSync('public/css/style.backup.css', 'utf8');
let lines = css.split('\n');
console.log('--- Auth Modal rules from backup ---');
for (let i = 855; i < 975; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
