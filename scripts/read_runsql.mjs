import fs from 'fs';
console.log(fs.readFileSync('scripts/runSql.cjs', 'utf8').substring(0, 500));
