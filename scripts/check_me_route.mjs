import fs from 'fs';
const authRoutes = fs.readFileSync('server/auth/routes.js', 'utf8');
const meIdx = authRoutes.indexOf('/me');
if (meIdx !== -1) {
  console.log(authRoutes.substring(meIdx - 50, meIdx + 2000));
}
