import fs from 'fs';
const code = fs.readFileSync('public/js/app.js', 'utf8');
const idMatches = [...code.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
const qsMatches = [...code.matchAll(/querySelector(?:All)?\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
console.log('Unique IDs count:', new Set(idMatches).size);
console.log('Unique IDs:', [...new Set(idMatches)].sort().join(', '));
console.log('Unique QuerySelectors:', [...new Set(qsMatches)].sort().join(', '));
