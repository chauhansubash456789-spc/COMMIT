import fs from 'fs';
const peerCode = fs.readFileSync('server/verifiers/peerConsensusVerifier.js', 'utf8');
const sIdx = peerCode.indexOf('submitProof(');
console.log(peerCode.substring(sIdx, sIdx + 600));
