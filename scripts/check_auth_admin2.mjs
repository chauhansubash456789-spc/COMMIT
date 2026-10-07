import fs from 'fs';
const authCode = fs.readFileSync('server/auth/routes.js', 'utf8');
const verifierIdx = authCode.indexOf('/admin/verifiers');
if (verifierIdx !== -1) {
  console.log(authCode.substring(verifierIdx, verifierIdx + 2000));
}
