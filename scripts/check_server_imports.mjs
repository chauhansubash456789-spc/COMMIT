import fs from 'fs';
const indexCode = fs.readFileSync('server/index.js', 'utf8');
console.log(indexCode.substring(0, 1000));
