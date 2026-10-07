import fs from 'fs';
const rustCode = fs.readFileSync('programs/commit-protocol/src/lib.rs', 'utf8');
const lines = rustCode.split('\n');
console.log('Lines 260-350:\n', lines.slice(260, 350).join('\n'));
