import fs from 'fs';
const authRoutes = fs.readFileSync('server/auth/routes.js', 'utf8');
const pIdx = authRoutes.indexOf('/profile');
console.log(authRoutes.substring(pIdx, pIdx + 700));
