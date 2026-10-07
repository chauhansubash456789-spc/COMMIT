import fs from 'fs';

let lines = fs.readFileSync('public/js/app.js', 'utf8').split('\n');

for (let i = 0; i < 35; i++) {
  if (lines[i].includes("icon.textContent = 'dYOT'")) {
    lines[i] = "      icon.textContent = '🌙';";
  }
  if (lines[i].includes("text.textContent = 'Light';") && i > 0 && lines[i-1].includes("icon.textContent")) {
    lines[i-1] = "      icon.textContent = '☀️';";
  }
}

fs.writeFileSync('public/js/app.js', lines.join('\n'), 'utf8');
console.log('Fixed icon glyphs');
