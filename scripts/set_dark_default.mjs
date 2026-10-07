import fs from 'fs';

let html = fs.readFileSync('public/index.html', 'utf8');
html = html.replace('<html lang="en" data-theme="light">', '<html lang="en" data-theme="dark">');
fs.writeFileSync('public/index.html', html, 'utf8');
console.log('✅ Set default data-theme="dark"');
