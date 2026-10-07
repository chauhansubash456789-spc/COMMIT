import fs from 'fs';
let code = fs.readFileSync('tests/e2e_full_test.js', 'utf8');
let lines = code.split('\n');
for (let i = 390; i < 430; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
