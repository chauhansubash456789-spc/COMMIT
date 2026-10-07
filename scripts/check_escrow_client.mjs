import fs from 'fs';
console.log(fs.readFileSync('server/solana/escrowClient.js', 'utf8').substring(0, 1500));
