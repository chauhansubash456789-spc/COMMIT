import fs from 'fs';

let code = fs.readFileSync('server/index.js', 'utf8').replace(/\r\n/g, '\n');

let target = `app.post('/api/verify/study/finish', async (req, res) => {
  const { commitmentId } = req.body;
  const c = commitments.get(commitmentId);
  if (!c) return res.status(404).json({ error: 'Commitment not found' });
  if (c.status === 'SETTLED') return res.status(400).json({ error: 'Commitment already settled' });

  const attestation = studyVerifier.finishSession(c.id);
  c.status = 'VERIFIED';
  c.attestation = attestation;

  await dbSaveCommitment(c);

  res.json({ attestation, isSignatureValid: verifyAttestationSignature(attestation) });
});`;

let replacement = `app.post('/api/verify/study/finish', async (req, res) => {
  const { commitmentId, demoForceSeconds } = req.body;
  const c = commitments.get(commitmentId);
  if (!c) return res.status(404).json({ error: 'Commitment not found' });
  if (c.status === 'SETTLED') return res.status(400).json({ error: 'Commitment already settled' });

  const attestation = studyVerifier.finishSession(c.id, demoForceSeconds);
  c.status = 'VERIFIED';
  c.attestation = attestation;

  await dbSaveCommitment(c);

  res.json({ commitment: c, attestation, isSignatureValid: verifyAttestationSignature(attestation) });
});`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('server/index.js', code, 'utf8');
  console.log('Replaced successfully with CRLF normalization');
} else {
  console.log('Still not found, check target');
}
