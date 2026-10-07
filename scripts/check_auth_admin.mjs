import fs from 'fs';
const authCode = fs.readFileSync('server/auth/routes.js', 'utf8');
const adminIdx = authCode.indexOf('/admin/');
if (adminIdx !== -1) {
  console.log(authCode.substring(adminIdx - 50, adminIdx + 2000));
}
