import fs from 'fs';
const indexCode = fs.readFileSync('server/index.js', 'utf8');
const dIdx = indexCode.indexOf('// --- DISPUTE ENDPOINTS ---');
console.log(indexCode.substring(dIdx, dIdx + 1200));
