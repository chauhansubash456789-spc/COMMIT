import fs from 'fs';
const runnerCode = fs.readFileSync('tests/runner.js', 'utf8');
const ghIdx = runnerCode.indexOf('AUTOMATED GITHUB VERIFIER');
console.log(runnerCode.substring(ghIdx, ghIdx + 800));
