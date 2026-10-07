import fs from 'fs';
const rustCode = fs.readFileSync('programs/commit-protocol/src/lib.rs', 'utf8');
const lines = rustCode.split('\n');
console.log('Sample instructions:\n', lines.slice(0, 100).join('\n'));
