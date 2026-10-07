import fs from 'fs';
let css = fs.readFileSync('public/css/style.backup.css', 'utf8');
let lines = css.split('\n');
lines.forEach((l, i) => {
  if (l.includes('btn-demo-card') || l.includes('demo-grid-2x2') || l.includes('demo-card-info')) {
    console.log((i+1) + ': ' + l);
  }
});
