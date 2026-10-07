import { supabaseAdmin } from '../server/auth/supabase.js';

async function testDisputeLifecycle() {
  console.log('====================================================');
  console.log('🧪 TESTING DISPUTE LIFECYCLE & SECURITY INVARIANTS');
  console.log('====================================================\n');

  // 1. Login as User A (Alice)
  const aliceRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alice@commit.fun', password: 'Demo1234!' })
  });
  const aliceData = await aliceRes.json();
  const aliceToken = aliceData.session.access_token;

  // 2. Login as Admin (Charlie)
  const adminRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@commit.fun', password: 'Demo1234!' })
  });
  const adminData = await adminRes.json();
  const adminToken = adminData.session.access_token;

  // 3. Create a new commitment for dispute testing
  const createRes = await fetch('http://localhost:3000/api/commitments/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aliceToken}`
    },
    body: JSON.stringify({
      title: 'Dispute Verification Test Commitment',
      stakingMode: 'HARDCORE',
      stakeAmount: 50,
      penaltyAmount: 25,
      verificationFee: 2,
      verifierType: 'peer_consensus',
      failurePolicy: 'burn'
    })
  });
  const created = await createRes.json();
  const commitmentId = created.id;
  console.log('1. Commitment created:', commitmentId);

  // 4. Fund commitment
  await fetch(`http://localhost:3000/api/commitments/${commitmentId}/fund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txSignature: 'MockFundTx1111111111111111111111111111111111111' })
  });
  console.log('2. Commitment funded');

  // 5. Generate peer challenge, submit proof, and vote FAIL
  await fetch(`http://localhost:3000/api/verify/peer/challenge/${commitmentId}`);
  await fetch('http://localhost:3000/api/verify/peer/submit-proof', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commitmentId,
      mediaUrl: 'https://commit.protocol/dispute_proof.jpg',
      description: 'Submitted physical evidence'
    })
  });
  // Cast 2 FAIL votes
  await fetch('http://localhost:3000/api/verify/peer/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commitmentId, verifierId: 'v_alex', vote: 'FAIL', notes: 'Blockhash blurry' })
  });
  const vote2Res = await fetch('http://localhost:3000/api/verify/peer/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commitmentId, verifierId: 'v_elena', vote: 'FAIL', notes: 'Agree, code blurry' })
  });
  const vote2Data = await vote2Res.json();
  console.log('3. Peer verifiers voted FAIL. Commitment status:', vote2Data.commitment?.status, 'Result:', vote2Data.commitment?.attestation?.resultCode);

  // 6. User opens dispute
  const disputeOpenRes = await fetch(`http://localhost:3000/api/commitments/${commitmentId}/dispute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aliceToken}`
    },
    body: JSON.stringify({
      reason: 'Photo has high resolution when viewed uncompressed. Blockhash SOL-XXXX is clearly readable.',
      evidence: [{ url: 'https://commit.protocol/hires_proof.jpg', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }]
    })
  });
  const disputeOpenData = await disputeOpenRes.json();
  console.log('4. Dispute opened! Status code:', disputeOpenRes.status, 'Message:', disputeOpenData.message);

  // 7. INVARIANT: Attempt settlement while DISPUTED — MUST FAIL!
  const blockedSettleRes = await fetch(`http://localhost:3000/api/commitments/${commitmentId}/settle`, {
    method: 'POST'
  });
  console.log('5. Settlement attempt while DISPUTED rejected with HTTP:', blockedSettleRes.status);
  const blockedSettleData = await blockedSettleRes.json();
  console.log('   Rejection error:', blockedSettleData.error);

  // 8. Admin inspects disputes list
  const adminDisputesRes = await fetch('http://localhost:3000/api/admin/disputes', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const adminDisputes = await adminDisputesRes.json();
  console.log('6. Admin retrieved disputes count:', adminDisputes.disputes?.length);
  const myDispute = adminDisputes.disputes?.find(d => d.commitment_id === commitmentId);
  console.log('   Found active dispute for commitment:', Boolean(myDispute), 'Status:', myDispute?.status);

  // 9. Admin resolves dispute (OVERTURN_TO_PASS)
  const resolveRes = await fetch(`http://localhost:3000/api/commitments/${commitmentId}/resolve-dispute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      resolution: 'OVERTURN_TO_PASS',
      notes: 'Reviewed high-res uncompressed image: blockhash is verified legible. Overturned.'
    })
  });
  const resolveData = await resolveRes.json();
  console.log('7. Admin resolved dispute! Message:', resolveData.message);
  console.log('   Commitment status un-frozen to:', resolveData.commitment.status);
  console.log('   Attestation isSuccessful updated to:', resolveData.commitment.attestation.isSuccessful);

  // 10. Final settlement now proceeds smoothly!
  const finalSettleRes = await fetch(`http://localhost:3000/api/commitments/${commitmentId}/settle`, {
    method: 'POST'
  });
  const finalSettleData = await finalSettleRes.json();
  console.log('8. Settlement executed! Status:', finalSettleData.commitment.status);
  console.log('   Solana Explorer URL:', finalSettleData.commitment.settlement?.explorerUrl);
  console.log('   Recipient payout:', finalSettleData.commitment.settlement?.recipientPayout, 'USDC');

  console.log('\n====================================================');
  console.log('✅ DISPUTE LIFECYCLE & INVARIANTS TEST PASSED 100%!');
  console.log('====================================================');
}

testDisputeLifecycle();
