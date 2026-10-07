import fs from 'fs';
const indexCode = fs.readFileSync('server/index.js', 'utf8');
const authCode = fs.readFileSync('server/auth/routes.js', 'utf8');

console.log('Index admin matches:');
console.log(indexCode.match(/.*admin.*/gi) || []);

console.log('Auth admin matches:');
console.log(authCode.match(/.*admin.*/gi)?.slice(0, 10) || []);
