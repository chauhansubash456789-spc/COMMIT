import fs from 'fs';
console.log(fs.readFileSync('server/verifiers/githubVerifier.js', 'utf8').substring(0, 1500));
