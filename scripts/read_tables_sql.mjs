import fs from 'fs';
const checkTables = fs.readFileSync('scripts/check_tables.sql', 'utf8');
console.log('check_tables.sql:\n', checkTables);
