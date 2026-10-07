import fs from 'fs';
const attackCode = fs.readFileSync('tests/attack_tests.js', 'utf8');
const ghIdx = attackCode.indexOf('GITHUB VERIFIER');
console.log(attackCode.substring(ghIdx, ghIdx + 800));
