import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('tests/e2e_full_test.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = """    const actions = auditData.auditLogs.map(l => l.action);
    assert(actions.includes('SIGNUP'), 'Audit log includes SIGNUP event');
    assert(actions.includes('LOGIN'), 'Audit log includes LOGIN event');
    assert(actions.includes('WALLET_CONNECTED'), 'Audit log includes WALLET_CONNECTED event');"""

new_sections = """    const actions = auditData.auditLogs.map(l => l.action);
    assert(actions.includes('SIGNUP'), 'Audit log includes SIGNUP event');
    assert(actions.includes('LOGIN'), 'Audit log includes LOGIN event');
    assert(actions.includes('WALLET_CONNECTED'), 'Audit log includes WALLET_CONNECTED event');

    // =========================================================================
    // 9. STUDY FAIL & FAILURE SETTLEMENT (STAKE PENALTY TRANSFER)
    // =========================================================================
    console.log('\\n📦 [9/10] STUDY FAIL & FAILURE SETTLEMENT (STAKE PENALTY TRANSFER)');
    const studyFailCommRes = await fetch(`${BASE_URL}/api/commitments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify({
        title: 'E2E Daily Focus Requirement (Failure Test)',
        stakingMode: 'HARDCORE',
        stakeAmount: 20,
        penaltyAmount: 10,
        verificationFee: 1,
        verifierType: 'study_timer',
        failurePolicy: 'burn'
      })
    });
    const studyFailComm = await studyFailCommRes.json();
    assert(studyFailCommRes.status === 201, 'Study failure test commitment created');

    // Fund
    await fetch(`${BASE_URL}/api/commitments/${studyFailComm.id}/fund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txSignature: 'MockStudyFundTx111111111111111111111111111111111' })
    });

    // Finish session with 0 seconds (fails required daily focus)
    const studyFinishRes = await fetch(`${BASE_URL}/api/verify/study/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitmentId: studyFailComm.id, demoForceSeconds: 0 })
    });
    const studyFinishData = await studyFinishRes.json();
    assert(studyFinishRes.status === 200, 'Study finish endpoint returned successfully');
    assert(studyFinishData.commitment.status === 'VERIFIED', 'Commitment transitioned to VERIFIED status');
    assert(studyFinishData.commitment.attestation.resultCode === 'STUDY_FAIL', 'Attestation outcome strictly reflects STUDY_FAIL');
    assert(studyFinishData.commitment.attestation.isSuccessful === false, 'Attestation isSuccessful is false');

    // Settle failure on Devnet
    const studySettleRes = await fetch(`${BASE_URL}/api/commitments/${studyFailComm.id}/settle`, { method: 'POST' });
    const studySettleData = await studySettleRes.json();
    assert(studySettleRes.status === 200, 'Settlement executed successfully on Solana Devnet for failed commitment');
    assert(studySettleData.commitment.status === 'SETTLED', 'Commitment status transitioned to SETTLED');
    assert(studySettleData.commitment.settlement.penaltyTransferred === 10, 'Penalty of 10 USDC transferred to failure destination pool');
    assert(studySettleData.commitment.settlement.recipientPayout === 10, 'Partial refund of 10 USDC safely returned to creator');

    // =========================================================================
    // 10. FORMAL DISPUTE LIFECYCLE & ADMIN RESOLUTION
    // =========================================================================
    console.log('\\n📦 [10/10] FORMAL DISPUTE LIFECYCLE & ADMIN RESOLUTION');
    const dispCommRes = await fetch(`${BASE_URL}/api/commitments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify({
        title: 'E2E Full Dispute Lifecycle Commitment',
        stakingMode: 'HARDCORE',
        stakeAmount: 30,
        penaltyAmount: 15,
        verificationFee: 2,
        verifierType: 'peer_consensus',
        failurePolicy: 'burn'
      })
    });
    const dispComm = await dispCommRes.json();

    // Fund
    await fetch(`${BASE_URL}/api/commitments/${dispComm.id}/fund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txSignature: 'MockDispFundTx111111111111111111111111111111111' })
    });

    // Peer submit proof & vote FAIL
    await fetch(`${BASE_URL}/api/verify/peer/challenge/${dispComm.id}`);
    await fetch(`${BASE_URL}/api/verify/peer/submit-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitmentId: dispComm.id, evidenceData: { walletAddress: walletPublicKey, description: 'Submitted Proof' } })
    });
    await fetch(`${BASE_URL}/api/verify/peer/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitmentId: dispComm.id, verifierId: 'v_alex', vote: 'FAIL' })
    });
    await fetch(`${BASE_URL}/api/verify/peer/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitmentId: dispComm.id, verifierId: 'v_elena', vote: 'FAIL' })
    });

    // User opens formal dispute
    const openDisputeRes = await fetch(`${BASE_URL}/api/commitments/${dispComm.id}/dispute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify({
        reason: 'Blockhash challenge was clearly documented in full-resolution image',
        evidence: [{ url: 'https://commit.protocol/dispute.png', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }]
      })
    });
    const openDisputeData = await openDisputeRes.json();
    assert(openDisputeRes.status === 200, 'Dispute opened successfully (HTTP 200)');
    assert(openDisputeData.commitment.status === 'DISPUTED', 'Commitment status strictly changed to DISPUTED');

    // INVARIANT: Settlement blocked during dispute
    const disputeBlockedRes = await fetch(`${BASE_URL}/api/commitments/${dispComm.id}/settle`, { method: 'POST' });
    assert(disputeBlockedRes.status === 400, 'Settlement attempt strictly BLOCKED with HTTP 400 during active dispute');

    // Admin resolves dispute (OVERTURN_TO_PASS)
    const resolveDisputeRes = await fetch(`${BASE_URL}/api/commitments/${dispComm.id}/resolve-dispute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        resolution: 'OVERTURN_TO_PASS',
        notes: 'Reviewed uncompressed high-resolution proof: blockhash visible. Overturned to PASS.'
      })
    });
    const resolveDisputeData = await resolveDisputeRes.json();
    assert(resolveDisputeRes.status === 200, 'Admin successfully resolves dispute via /api/commitments/:id/resolve-dispute');
    assert(resolveDisputeData.commitment.status === 'VERIFIED', 'Commitment un-frozen to VERIFIED state');
    assert(resolveDisputeData.commitment.attestation.isSuccessful === true, 'Attestation updated to isSuccessful = true');
    assert(resolveDisputeData.commitment.attestation.resultCode === 'DISPUTE_OVERTURN_PASS', 'Attestation resultCode = DISPUTE_OVERTURN_PASS');

    // Settle commitment successfully
    const dispSettleRes = await fetch(`${BASE_URL}/api/commitments/${dispComm.id}/settle`, { method: 'POST' });
    const dispSettleData = await dispSettleRes.json();
    assert(dispSettleRes.status === 200, 'Settlement executed successfully after dispute resolution');
    assert(dispSettleData.commitment.status === 'SETTLED', 'Commitment status is SETTLED');
    assert(dispSettleData.commitment.settlement.recipientPayout === 30, 'Full principal of 30 USDC returned to creator');"""

if target in code:
    code = code.replace(target, new_sections)
    with open('tests/e2e_full_test.js', 'w', encoding='utf-8') as f:
        f.write(code)
    print('Successfully expanded tests/e2e_full_test.js to 10 comprehensive modules!')
else:
    print('target not found in tests/e2e_full_test.js')
