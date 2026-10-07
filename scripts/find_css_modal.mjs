import fs from 'fs';
let css = fs.readFileSync('public/css/style.css', 'utf8');
let lines = css.split('\n');
lines.forEach((l, i) => {
  if (l.includes('modal-overlay') || l.includes('auth-modal-overlay')) {
    console.log((i+1) + ': ' + l);
  }
});
