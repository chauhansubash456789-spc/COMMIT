import sys
sys.stdout.reconfigure(encoding='utf-8')

# 1. Update server/verifiers/peerConsensusVerifier.js
with open('server/verifiers/peerConsensusVerifier.js', 'r', encoding='utf-8') as f:
    peer_code = f.read()

old_evidence = '''    task.evidence = {
      mediaUrl: evidenceData.mediaUrl || 'https://commit.protocol/proofs/demo_storage_clean.jpg',
      description: evidenceData.description || 'Completed physical task with blockhash displayed','''

new_evidence = '''    task.evidence = {
      walletAddress: evidenceData.walletAddress || 'USER_WALLET_DEMO',
      mediaUrl: evidenceData.mediaUrl || 'https://commit.protocol/proofs/demo_storage_clean.jpg',
      description: evidenceData.description || 'Completed physical task with blockhash displayed','''

if old_evidence in peer_code:
    peer_code = peer_code.replace(old_evidence, new_evidence)
    with open('server/verifiers/peerConsensusVerifier.js', 'w', encoding='utf-8') as f:
        f.write(peer_code)
    print('Updated peerConsensusVerifier.js')
else:
    print('old_evidence not found in peerConsensusVerifier.js')

# 2. Update server/index.js
with open('server/index.js', 'r', encoding='utf-8') as f:
    index_code = f.read()

# Update attestation import
old_import = "import { ORACLE_PUBLIC_KEY, verifyAttestationSignature } from './oracle/attestation.js';"
new_import = "import { ORACLE_PUBLIC_KEY, verifyAttestationSignature, signVerificationResult, hashEvidence } from './oracle/attestation.js';"
if old_import in index_code:
    index_code = index_code.replace(old_import, new_import)
    print('Updated attestation import in server/index.js')

# Update submit-proof and vote in server/index.js
old_submit = '''app.post('/api/verify/peer/submit-proof', (req, res) => {
  try {
    const { commitmentId, evidenceData } = req.body;
    const result = peerVerifier.submitProof(commitmentId, evidenceData || {});
    const c = commitments.get(commitmentId);
    if (c) c.status = 'PENDING_VERIFICATION';
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});'''

new_submit = '''app.post('/api/verify/peer/submit-proof', (req, res) => {
  try {
    const { commitmentId, evidenceData } = req.body;
    const c = commitments.get(commitmentId);
    const data = {
      ...(evidenceData || {}),
      walletAddress: c ? c.creator : (evidenceData?.walletAddress || 'USER_WALLET_DEMO')
    };
    const result = peerVerifier.submitProof(commitmentId, data);
    if (c) c.status = 'PENDING_VERIFICATION';
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});'''

if old_submit in index_code:
    index_code = index_code.replace(old_submit, new_submit)
    print('Updated submit-proof in server/index.js')

# Update dispute resolution re-signing in server/index.js
old_resolve_block = '''    if (resolution === 'OVERTURN_TO_PASS' || resolution === 'RESOLVED_USER') {
      c.attestation.isSuccessful = true;
      c.attestation.resultCode = 'DISPUTE_OVERTURN_PASS';
    } else {
      c.attestation.isSuccessful = false;
      c.attestation.resultCode = 'DISPUTE_UPHELD_FAIL';
    }'''

new_resolve_block = '''    const isSuccessful = (resolution === 'OVERTURN_TO_PASS' || resolution === 'RESOLVED_USER');
    const resultCode = isSuccessful ? 'DISPUTE_OVERTURN_PASS' : 'DISPUTE_UPHELD_FAIL';
    const evidencePayload = {
      ...(c.attestation ? c.attestation.evidencePayload : {}),
      disputeResolution: resolution,
      resolvedBy: req.user.id,
      notes: notes || 'Dispute resolution'
    };
    const evidenceHash = hashEvidence(evidencePayload);

    c.attestation = signVerificationResult({
      commitmentId: c.id,
      walletAddress: c.creator,
      verifierType: c.verifierType,
      verifierVersion: 'dispute-v1.0',
      resultCode,
      isSuccessful,
      verifiedMetric: isSuccessful ? 1 : 0,
      requiredMetric: 1,
      evidencePayload,
      evidenceHash
    });'''

if old_resolve_block in index_code:
    index_code = index_code.replace(old_resolve_block, new_resolve_block)
    print('Updated dispute resolve re-signing in server/index.js')

with open('server/index.js', 'w', encoding='utf-8') as f:
    f.write(index_code)

print('Patch completed successfully')
