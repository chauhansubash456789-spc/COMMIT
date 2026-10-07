import fs from 'fs';

let js = fs.readFileSync('public/js/app.js', 'utf8');

js = js.replace(
  "document.addEventListener('DOMContentLoaded', () => {\n  initAuth();\n});",
  "document.addEventListener('DOMContentLoaded', () => {\n  initAuth();\n  if (new URLSearchParams(window.location.search).has('auth')) {\n    setTimeout(() => { if (typeof openAuthModal === 'function') openAuthModal('signin'); }, 150);\n  }\n});"
);

fs.writeFileSync('public/js/app.js', js, 'utf8');
console.log('Added ?auth param handler in app.js');
