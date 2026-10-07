import fs from 'fs';
const clientCode = fs.readFileSync('server/solana/escrowClient.js', 'utf8');
const bhIdx = clientCode.indexOf('getLatestBlockhash');
console.log(clientCode.substring(bhIdx, bhIdx + 600));
