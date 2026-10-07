import fs from 'fs';
const indexCode = fs.readFileSync('server/index.js', 'utf8');
const mIdx = indexCode.indexOf('/api/auth');
console.log(indexCode.substring(mIdx - 100, mIdx + 500));
