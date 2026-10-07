import fs from 'fs';
const authRoutes = fs.readFileSync('server/auth/routes.js', 'utf8');
const pIdx = authRoutes.indexOf('/profile');
if (pIdx !== -1) {
  console.log(authRoutes.substring(pIdx + 1100, pIdx + 2200));
}
