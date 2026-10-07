import fs from 'fs';
const indexCode = fs.readFileSync('server/index.js', 'utf8');
const sIdx = indexCode.indexOf('/settle');
console.log(indexCode.substring(sIdx + 1100, sIdx + 2200));
