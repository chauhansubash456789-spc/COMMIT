import fs from 'fs';
const runnerCode = fs.readFileSync('tests/runner.js', 'utf8');
const stIdx = runnerCode.indexOf('DEEP WORK STUDY FOCUS VERIFIER');
console.log(runnerCode.substring(stIdx, stIdx + 800));
