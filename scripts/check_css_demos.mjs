import fs from 'fs';
let css = fs.readFileSync('public/css/style.css', 'utf8');
let lines = css.split('\n');
lines.forEach((l, i) => {
  if (l.includes('demo') || l.includes('Demo') || l.includes('modal')) {
    console.log((i+1) + ': ' + l);
  }
});
