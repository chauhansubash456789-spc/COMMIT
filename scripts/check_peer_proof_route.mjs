import fs from 'fs';
const indexCode = fs.readFileSync('server/index.js', 'utf8');
const pIdx = indexCode.indexOf('/api/verify/peer/submit-proof');
console.log(indexCode.substring(pIdx, pIdx + 700));
