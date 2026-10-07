import fs from 'fs';
const rustCode = fs.readFileSync('programs/commit-protocol/src/lib.rs', 'utf8');
const dIdx = rustCode.indexOf('pub fn open_dispute');
console.log(rustCode.substring(dIdx, dIdx + 800));
