import fs from 'fs';

let js = fs.readFileSync('public/js/app.js', 'utf8');

if (!js.includes('function initTheme()')) {
  const themeCode = `
// =============================================================================
// THEME CONTROLLER (DEFAULT LIGHT THEME)
// =============================================================================
function initTheme() {
  const saved = localStorage.getItem('commit_theme') || 'light';
  setTheme(saved);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('commit_theme', theme);
  const icon = document.getElementById('themeToggleIcon');
  const text = document.getElementById('themeToggleText');
  if (icon && text) {
    if (theme === 'light') {
      icon.textContent = '🌙';
      text.textContent = 'Dark';
    } else {
      icon.textContent = '☀️';
      text.textContent = 'Light';
    }
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  setTheme(next);
  if (typeof showToast === 'function') {
    showToast(\`Switched to \${next.toUpperCase()} mode\`);
  }
}

// Initialize theme immediately on script load
initTheme();
`;
  js = themeCode + '\n' + js;
  fs.writeFileSync('public/js/app.js', js, 'utf8');
  console.log('Successfully added theme controller to public/js/app.js');
} else {
  console.log('initTheme() already present in public/js/app.js');
}