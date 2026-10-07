import fs from 'fs';
const serverCode = fs.readFileSync('server/index.js', 'utf8');
const disputeIdx = serverCode.indexOf('/dispute');
if (disputeIdx !== -1) {
  console.log(serverCode.substring(disputeIdx - 50, disputeIdx + 1200));
} else {
  console.log('No /dispute found');
}
