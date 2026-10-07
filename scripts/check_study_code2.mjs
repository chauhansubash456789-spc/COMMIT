import fs from 'fs';
console.log(fs.readFileSync('server/verifiers/studyTimerVerifier.js', 'utf8').substring(1500));
