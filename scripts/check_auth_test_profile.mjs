import fs from 'fs';
const authTests = fs.readFileSync('tests/auth_tests.js', 'utf8');
const pIdx = authTests.indexOf('/api/auth/profile');
if (pIdx !== -1) {
  console.log(authTests.substring(pIdx - 50, pIdx + 700));
} else {
  console.log('No /api/auth/profile in auth_tests.js');
}
