import fs from 'fs';
let html = fs.readFileSync('public/index.html', 'utf8');
let lines = html.split('\n');
lines.forEach((l, i) => {
  if (l.includes('receiptModal') || l.includes('authModalOverlay') || l.includes('walletChallengeModal')) {
    console.log((i + 1) + ': ' + l);
  }
});
