import fs from 'fs';

let html = fs.readFileSync('public/index.html', 'utf8');

html = html.replace('<span>Solana Devnet</span>', '<span>Devnet</span>');
html = html.replace('<span>🔑 Sign In / Register</span>', '<span>🔑 Sign In</span>');

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Header refined');
