import fs from 'fs';

let code = fs.readFileSync('server/index.js', 'utf8');

const oldBlock = `app.post('/api/verify/study/finish', async (req, res) => {
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

const newBlock = `app.post('/api/verify/study/finish', async (req, res) => {
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

if (code.includes(oldBlock)) {
  code = code.replace(oldBlock, newBlock);
  fs.writeFileSync('server/index.js', code, 'utf8');
  console.log('Successfully updated /api/verify/study/finish in server/index.js');
} else {
  console.log('Could not find oldBlock by exact match');
}
