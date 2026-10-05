import fs from 'fs';

let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Set data-theme="light" on html
html = html.replace('<html lang="en">', '<html lang="en" data-theme="light">');

// 2. Add Theme Toggle button in header
if (!html.includes('id="btnThemeToggle"')) {
  const targetHeaderMeta = '<div class="header-meta">';
  const newHeaderMeta = `<div class="header-meta">
      <!-- THEME TOGGLE BUTTON -->
      <button class="theme-toggle-btn" id="btnThemeToggle" onclick="toggleTheme()" title="Toggle Light / Dark Theme">
        <span id="themeToggleIcon">🌙</span>
        <span id="themeToggleText">Dark</span>
      </button>`;
  html = html.replace(targetHeaderMeta, newHeaderMeta);
}

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Successfully updated public/index.html with data-theme="light" and theme toggle button');