import fs from 'fs';
let code = fs.readFileSync('server/index.js', 'utf8');
let lines = code.split('\n');
lines.forEach((l, i) => {
  if (l.includes('/api/verify/study/finish')) {
    console.log((i+1) + ': ' + l);
    for (let j = i; j < i + 15; j++) {
      console.log('  ' + (j+1) + ': ' + lines[j]);
    }
  }
});
