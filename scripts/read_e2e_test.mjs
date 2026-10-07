import fs from 'fs';
const content = fs.readFileSync('tests/e2e_full_test.js', 'utf8');
console.log('e2e_full_test.js line count:', content.split('\n').length);
console.log(content.substring(0, 1000));
