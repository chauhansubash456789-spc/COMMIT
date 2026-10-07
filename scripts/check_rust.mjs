import fs from 'fs';
const rustCode = fs.readFileSync('programs/commit-protocol/src/lib.rs', 'utf8');
console.log('Rust program line count:', rustCode.split('\n').length);
const instructions = rustCode.match(/pub fn [a-zA-Z0-9_]+/g);
console.log('Rust instructions:', instructions);
