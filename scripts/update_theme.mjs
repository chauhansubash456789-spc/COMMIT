import fs from 'fs';

let code = fs.readFileSync('public/js/app.js', 'utf8');

code = code.replace(
  "const saved = localStorage.getItem('commit_theme') || 'light';",
  "const saved = localStorage.getItem('commit_theme') || 'dark';"
);

code = code.replace(
  /if \(theme === 'light'\) \{\s*icon\.textContent = '[^']+';\s*text\.textContent = 'Dark';\s*\} else \{\s*icon\.textContent = '[^']+';\s*text\.textContent = 'Light';\s*\}/,
  `if (theme === 'light') {\n      icon.textContent = '🌙';\n      text.textContent = 'Dark';\n    } else {\n      icon.textContent = '☀️';\n      text.textContent = 'Light';\n    }`
);

fs.writeFileSync('public/js/app.js', code, 'utf8');
console.log('Successfully updated app.js theme defaults');
