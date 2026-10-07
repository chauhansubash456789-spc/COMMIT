import fs from 'fs';
const rustCode = fs.readFileSync('programs/commit-protocol/src/lib.rs', 'utf8');
const lines = rustCode.split('\n');
console.log('Instructions continued:\n', lines.slice(100, 260).join('\n'));
