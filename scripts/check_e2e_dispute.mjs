import fs from 'fs';
const e2eCode = fs.readFileSync('tests/e2e_full_test.js', 'utf8');
const dIdx = e2eCode.indexOf('dispute');
console.log('e2e dispute match:', dIdx !== -1 ? e2eCode.substring(dIdx - 50, dIdx + 200) : 'None');
