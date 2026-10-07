import fs from 'fs';
const authTests = fs.readFileSync('tests/auth_tests.js', 'utf8');
const wIdx = authTests.indexOf('walletAddress');
if (wIdx !== -1) {
  console.log(authTests.substring(wIdx - 50, wIdx + 300));
} else {
  console.log('walletAddress not in auth_tests.js');
}
