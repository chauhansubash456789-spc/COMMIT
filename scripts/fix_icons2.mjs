import fs from 'fs';

let lines = fs.readFileSync('public/js/app.js', 'utf8').split('\n');

for (let i = 0; i < 30; i++) {
  if (lines[i].includes("text.textContent = 'Dark';")) {
    lines[i-1] = "      icon.textContent = '\u{1F319}';"; // Moon
  }
  if (lines[i].includes("text.textContent = 'Light';")) {
    lines[i-1] = "      icon.textContent = '\u{2600}\u{FE0F}';"; // Sun
  }
}

fs.writeFileSync('public/js/app.js', lines.join('\n'), 'utf8');
console.log('Fixed icon glyphs with unicode escapes');
