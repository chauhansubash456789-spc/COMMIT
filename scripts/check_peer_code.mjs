import fs from 'fs';
const peerCode = fs.readFileSync('server/verifiers/peerConsensusVerifier.js', 'utf8');
console.log('peerConsensusVerifier.js lines:', peerCode.split('\n').length);
console.log(peerCode.substring(0, 1200));
