import fs from 'fs';
const rustCode = fs.readFileSync('programs/commit-protocol/src/lib.rs', 'utf8');
const errIdx = rustCode.indexOf('#[error_code]');
console.log(rustCode.substring(errIdx, errIdx + 1200));
