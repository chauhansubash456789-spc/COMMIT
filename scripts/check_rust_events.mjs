import fs from 'fs';
const rustCode = fs.readFileSync('programs/commit-protocol/src/lib.rs', 'utf8');
const evIdx = rustCode.indexOf('// EVENTS');
if (evIdx !== -1) {
  console.log(rustCode.substring(evIdx));
} else {
  console.log(rustCode.substring(rustCode.length - 800));
}
