import fs from 'fs';
const rustCode = fs.readFileSync('programs/commit-protocol/src/lib.rs', 'utf8');
const dIdx = rustCode.indexOf('struct OpenDispute');
console.log(rustCode.substring(dIdx - 30, dIdx + 300));
