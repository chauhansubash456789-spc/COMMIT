import fs from 'fs';
let code = fs.readFileSync('server/index.js', 'utf8');
let lines = code.split('\n');
for (let i = 425; i < 450; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
