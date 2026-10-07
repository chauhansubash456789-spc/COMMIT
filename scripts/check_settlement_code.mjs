import fs from 'fs';
const clientCode = fs.readFileSync('server/solana/escrowClient.js', 'utf8');
const sIdx = clientCode.indexOf('executeSettlement');
if (sIdx !== -1) {
  console.log(clientCode.substring(sIdx, sIdx + 1500));
}
