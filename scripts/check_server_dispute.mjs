import fs from 'fs';
const indexCode = fs.readFileSync('server/index.js', 'utf8');
const dIdx = indexCode.indexOf('/dispute');
console.log(indexCode.substring(dIdx - 100, dIdx + 1200));
