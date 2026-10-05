const fs = require('fs');

let s = fs.readFileSync('tests/e2e_full_test.js', 'utf8');

const p1 = s.indexOf('// STEP 7: PEER CONSENSUS');
const p2 = s.indexOf('// STEP 8: ADMIN AUDIT LOGGING');

const replacement = [
  '// STEP 7: PEER CONSENSUS VERIFICATION & SOLANA BLOCKHASH',
  '    // -------------------------------------------------------------------------',
  "    console.log('\\n📦 [7/8] PEER CONSENSUS VERIFIER & 2/3 THRESHOLD VOTING');",
  '    const peerRes = await fetch(`${BASE_URL}/api/commitments/create`, {',
  "      method: 'POST',",
  "      headers: { 'Content-Type': 'application/json' },",
  '      body: JSON.stringify({',
  "        title: 'Peer Consensus Community Challenge',",
  '        creator: walletPubkey,',
  "        stakingMode: 'HARDCORE',",
  '        stakeAmount: 30,',
  '        penaltyAmount: 10,',
  '        verificationFee: 2,',
  "        verifierType: 'peer_consensus',",
  "        failurePolicy: 'PARTIAL_COMMUNITY_POOL'",
  '      })',
  '    });',
  '    const peerData = await peerRes.json();',
  '    const peerCommitId = peerData.id;',
  "    await fetch(`${BASE_URL}/api/commitments/${peerCommitId}/fund`, { method: 'POST' });",
  '',
  '    const peerChallengeRes = await fetch(`${BASE_URL}/api/verify/peer/challenge/${peerCommitId}`);',
  '    const peerChallengeData = await peerChallengeRes.json();',
  "    assert(peerChallengeRes.status === 200, 'Dynamic Solana blockhash challenge generated');",
  '',
  '    // Submit proof',
  '    const submitProofRes = await fetch(`${BASE_URL}/api/verify/peer/submit-proof`, {',
  "      method: 'POST',",
  "      headers: { 'Content-Type': 'application/json' },",
  '      body: JSON.stringify({',
  '        commitmentId: peerCommitId,',
  "        proof: { description: 'Electronics lab workbench organized and cleaned', checklist: [{ label: 'Cleaned', checked: true }] }",
  '      })',
  '    });',
  "    assert(submitProofRes.status === 200, 'Peer verification proof submitted');",
  '',
  '    // Vote 1 (Alex: PASS)',
  '    const vote1Res = await fetch(`${BASE_URL}/api/verify/peer/vote`, {',
  "      method: 'POST',",
  "      headers: { 'Content-Type': 'application/json' },",
  "      body: JSON.stringify({ commitmentId: peerCommitId, verifierId: 'v_alex', vote: 'PASS', notes: 'Verified cleanly' })",
  '    });',
  '    const vote1Data = await vote1Res.json();',
  "    assert(vote1Data.votesCount === 1 && !vote1Data.consensusReached, 'Vote 1 recorded (1/3 votes, consensus not yet reached)');",
  '',
  '    // Vote 2 (Chen: PASS -> Reaches 2/3 threshold!)',
  '    const vote2Res = await fetch(`${BASE_URL}/api/verify/peer/vote`, {',
  "      method: 'POST',",
  "      headers: { 'Content-Type': 'application/json' },",
  "      body: JSON.stringify({ commitmentId: peerCommitId, verifierId: 'v_chen', vote: 'PASS', notes: 'Seconded, good job' })",
  '    });',
  '    const vote2Data = await vote2Res.json();',
  "    assert(vote2Data.consensusReached === true, '2-of-3 decentralized peer consensus reached');",
  "    assert(vote2Data.attestation.resultCode === 'HUMAN_PASS', 'Attestation generated: HUMAN_PASS');",
  '',
  '    // -------------------------------------------------------------------------',
  '    '
].join('\n');

s = s.slice(0, p1) + replacement + s.slice(p2);
fs.writeFileSync('tests/e2e_full_test.js', s, 'utf8');
console.log('Successfully updated Step 7 via update_e2e.cjs');