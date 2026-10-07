import fs from 'fs';
const content = fs.readFileSync('tests/auth_tests.js', 'utf8');
console.log('auth_tests.js line count:', content.split('\n').length);
console.log(content.substring(0, 1000));
