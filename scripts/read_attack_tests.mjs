import fs from 'fs';
const content = fs.readFileSync('tests/attack_tests.js', 'utf8');
console.log('attack_tests.js line count:', content.split('\n').length);
console.log(content.substring(0, 800));
