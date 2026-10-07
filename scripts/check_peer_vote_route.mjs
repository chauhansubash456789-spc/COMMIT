import fs from 'fs';
const indexCode = fs.readFileSync('server/index.js', 'utf8');
const vIdx = indexCode.indexOf('/api/verify/peer/vote');
console.log(indexCode.substring(vIdx, vIdx + 800));
