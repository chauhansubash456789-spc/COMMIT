import fs from 'fs';
const authRoutes = fs.readFileSync('server/auth/routes.js', 'utf8');
const vIdx = authRoutes.indexOf('/verifier/apply');
if (vIdx !== -1) {
  console.log(authRoutes.substring(vIdx - 50, vIdx + 2000));
}
