import fs from 'fs';
const attackCode = fs.readFileSync('tests/attack_tests.js', 'utf8');
const dIdx = attackCode.indexOf('DISPUTED status blocks normal settlement');
console.log(attackCode.substring(dIdx - 100, dIdx + 500));
