import fs from 'fs';
const clientCode = fs.readFileSync('server/solana/escrowClient.js', 'utf8');
const methods = clientCode.match(/async [a-zA-Z0-9_]+\([^\)]*\)/g);
console.log('SolanaEscrowClient methods:', methods);
