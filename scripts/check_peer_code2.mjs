import fs from 'fs';
const peerCode = fs.readFileSync('server/verifiers/peerConsensusVerifier.js', 'utf8');
console.log(peerCode.substring(1200, 3000));
