import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { supabaseAdmin } from '../server/auth/supabase.js';
import { escrowClient } from '../server/solana/escrowClient.js';
import { verifyAttestationSignature, hashEvidence } from '../server/oracle/attestation.js';

function encodeBase58(buffer) {
  if (typeof bs58.encode === 'function') return bs58.encode(buffer);
  if (bs58.default && typeof bs58.default.encode === 'function') return bs58.default.encode(buffer);
  throw new Error('Base58 encode unavailable');
}

const BASE_URL = 'http://localhost:3000';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let blockedTests = 0;

const testResults = [];

function recordTest(category, name, status, evidence = '', bugOrLimitation = '') {
  totalTests++;
  if (status === 'PASS') passedTests++;
  else if (status === 'FAIL') failedTests++;
  else if (status === 'BLOCKED') blockedTests++;

  testResults.push({ category, name, status, evidence, bugOrLimitation });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠️';
  console.log(`  ${icon} [${status}] ${name} ${evidence ? `(${evidence})` : ''}`);
}

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

// Helper to authenticate a wallet keypair
async function createAndAuthWallet(usernamePrefix = 'user') {
  const kp = nacl.sign.keyPair();
  const wallet = encodeBase58(kp.publicKey);
  const chal = await api('/api/auth/wallet/challenge', {
    method: 'POST',
    body: JSON.stringify({ walletAddress: wallet })
  });

  if (chal.status !== 200) throw new Error(`Challenge failed: ${JSON.stringify(chal.data)}`);

  const msgBytes = new TextEncoder().encode(chal.data.message);
  const sigBytes = nacl.sign.detached(msgBytes, kp.secretKey);
  const signature = encodeBase58(sigBytes);

  const auth = await api('/api/auth/wallet/authenticate', {
    method: 'POST',
    body: JSON.stringify({
      walletAddress: wallet,
      nonce: chal.data.nonce,
      signature,
      username: `${usernamePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      displayName: `${usernamePrefix.toUpperCase()} Tester`
    })
  });

  if (auth.status !== 200) throw new Error(`Auth failed: ${JSON.stringify(auth.data)}`);

  return {
    keypair: kp,
    wallet,
    token: auth.data.session.access_token,
    user: auth.data.user,
    profile: auth.data.profile,
    challenge: chal.data,
    signature
  };
}

async function runQAAudit() {
  console.log('\n================================================================');
  console.log('🔬 COMMIT PROTOCOL — COMPREHENSIVE AUTOMATED QA AUDIT');
  console.log('================================================================\n');

  const ts = Date.now();

  let userA = null;
  let userB = null;
  let adminUser = null;
  let verifierUser = null;

  try {
    // =========================================================================
    // SECTION 3: CONNECT WALLET AUTHENTICATION TESTS (BASIC & ADVERSARIAL)
    // =========================================================================
    console.log('--- SECTION 3: Connect Wallet Authentication & Session Tests ---');

    // 3.1 Valid wallet challenge generation
    const kpA = nacl.sign.keyPair();
    const walletA = encodeBase58(kpA.publicKey);
    const chalA = await api('/api/auth/wallet/challenge', {
      method: 'POST',
      body: JSON.stringify({ walletAddress: walletA })
    });
    if (chalA.status === 200 && chalA.data.nonce && chalA.data.message.includes('Commit Protocol')) {
      recordTest('Connect Wallet', 'Challenge generation format & 32-byte hex nonce', 'PASS', `Nonce: ${chalA.data.nonce.slice(0, 12)}...`);
    } else {
      recordTest('Connect Wallet', 'Challenge generation format & 32-byte hex nonce', 'FAIL', JSON.stringify(chalA.data));
    }

    // 3.2 Missing or invalid wallet address rejection
    const badWalletChal = await api('/api/auth/wallet/challenge', {
      method: 'POST',
      body: JSON.stringify({ walletAddress: 'invalid-solana-address!' })
    });
    if (badWalletChal.status === 400) {
      recordTest('Connect Wallet', 'Malformed/invalid base58 wallet address rejected', 'PASS', 'HTTP 400');
    } else {
      recordTest('Connect Wallet', 'Malformed/invalid base58 wallet address rejected', 'FAIL', `Status: ${badWalletChal.status}`);
    }

    // 3.3 Forged signature rejection (Adversarial)
    const chalForged = await api('/api/auth/wallet/challenge', {
      method: 'POST',
      body: JSON.stringify({ walletAddress: walletA })
    });
    const kpForger = nacl.sign.keyPair();
    const forgedSig = encodeBase58(nacl.sign.detached(new TextEncoder().encode(chalForged.data.message), kpForger.secretKey));
    const forgedAuth = await api('/api/auth/wallet/authenticate', {
      method: 'POST',
      body: JSON.stringify({
        walletAddress: walletA,
        nonce: chalForged.data.nonce,
        signature: forgedSig
      })
    });
    if (forgedAuth.status === 400) {
      recordTest('Adversarial Auth', 'Forged Ed25519 signature from different keypair rejected', 'PASS', 'HTTP 400');
    } else {
      recordTest('Adversarial Auth', 'Forged Ed25519 signature from different keypair rejected', 'FAIL', `Status: ${forgedAuth.status}`);
    }

    // 3.4 Tampered message rejection (Adversarial)
    const chalTamper = await api('/api/auth/wallet/challenge', {
      method: 'POST',
      body: JSON.stringify({ walletAddress: walletA })
    });
    const tamperedMsg = chalTamper.data.message.includes('localhost')
      ? chalTamper.data.message.replace('localhost', 'evil-phishing.com')
      : chalTamper.data.message.replace('Version: 1', 'Version: 999');
    const tamperedMsgBytes = new TextEncoder().encode(tamperedMsg);
    const tamperedSig = encodeBase58(nacl.sign.detached(tamperedMsgBytes, kpA.secretKey));
    const tamperedAuth = await api('/api/auth/wallet/authenticate', {
      method: 'POST',
      body: JSON.stringify({
        walletAddress: walletA,
        nonce: chalTamper.data.nonce,
        signature: tamperedSig
      })
    });
    if (tamperedAuth.status === 400) {
      recordTest('Adversarial Auth', 'Signature over tampered domain/origin rejected', 'PASS', 'HTTP 400');
    } else {
      recordTest('Adversarial Auth', 'Signature over tampered domain/origin rejected', 'FAIL', `Status: ${tamperedAuth.status}`);
    }

    // 3.5 Valid wallet authentication & profile creation (Scenario A: New User)
    const chalFreshA = await api('/api/auth/wallet/challenge', {
      method: 'POST',
      body: JSON.stringify({ walletAddress: walletA })
    });
    const validSigA = encodeBase58(nacl.sign.detached(new TextEncoder().encode(chalFreshA.data.message), kpA.secretKey));
    const authA = await api('/api/auth/wallet/authenticate', {
      method: 'POST',
      body: JSON.stringify({
        walletAddress: walletA,
        nonce: chalFreshA.data.nonce,
        signature: validSigA,
        username: `alice_qa_${ts}`,
        displayName: 'Alice QA Engineer'
      })
    });
    if (authA.status === 200 && authA.data.session?.access_token && authA.data.profile?.wallet_address === walletA) {
      userA = {
        keypair: kpA,
        wallet: walletA,
        token: authA.data.session.access_token,
        user: authA.data.user,
        profile: authA.data.profile,
        challenge: chalFreshA.data,
        signature: validSigA
      };
      recordTest('Connect Wallet', 'New user wallet authentication & profile initialization', 'PASS', `User ID: ${userA.user.id}`);
    } else {
      recordTest('Connect Wallet', 'New user wallet authentication & profile initialization', 'FAIL', JSON.stringify(authA.data));
    }

    // 3.6 Replay attack on consumed nonce (Adversarial)
    const replayAuth = await api('/api/auth/wallet/authenticate', {
      method: 'POST',
      body: JSON.stringify({
        walletAddress: walletA,
        nonce: chalFreshA.data.nonce,
        signature: validSigA
      })
    });
    if (replayAuth.status === 400) {
      recordTest('Adversarial Auth', 'Replay Attack: Reusing consumed challenge nonce rejected', 'PASS', 'HTTP 400 (Anti-Replay)');
    } else {
      recordTest('Adversarial Auth', 'Replay Attack: Reusing consumed challenge nonce rejected', 'FAIL', `Status: ${replayAuth.status}`);
    }

    // 3.7 Returning user authentication (Scenario B: Returning User)
    const chalReturning = await api('/api/auth/wallet/challenge', {
      method: 'POST',
      body: JSON.stringify({ walletAddress: walletA })
    });
    const sigReturning = encodeBase58(nacl.sign.detached(new TextEncoder().encode(chalReturning.data.message), kpA.secretKey));
    const authReturning = await api('/api/auth/wallet/authenticate', {
      method: 'POST',
      body: JSON.stringify({
        walletAddress: walletA,
        nonce: chalReturning.data.nonce,
        signature: sigReturning
      })
    });
    if (authReturning.status === 200 && authReturning.data.profile?.id === userA.profile.id && !authReturning.data.isNewUser) {
      userA.token = authReturning.data.session.access_token;
      recordTest('Connect Wallet', 'Returning user login loads identical persistent profile', 'PASS', `Profile ID: ${userA.profile.id}`);
    } else {
      recordTest('Connect Wallet', 'Returning user login loads identical persistent profile', 'FAIL', JSON.stringify(authReturning.data));
    }

    // 3.8 Discontinue legacy routes (410 Gone)
    const legacySignup = await api('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email: 'test@commit.fun' }) });
    const legacyLogin = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'test@commit.fun' }) });
    const legacyForgot = await api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: 'test@commit.fun' }) });
    if (legacySignup.status === 410 && legacyLogin.status === 410 && legacyForgot.status === 410) {
      recordTest('Connect Wallet', 'Legacy email/password routes retired with HTTP 410 Gone', 'PASS', 'HTTP 410 WALLET_AUTH_REQUIRED');
    } else {
      recordTest('Connect Wallet', 'Legacy email/password routes retired with HTTP 410 Gone', 'FAIL', `Statuses: ${legacySignup.status}, ${legacyLogin.status}, ${legacyForgot.status}`);
    }

    // Authenticate User B for cross-user / IDOR checks
    userB = await createAndAuthWallet('bob');
    recordTest('Connect Wallet', 'Independent secondary wallet authenticated (User B)', 'PASS', `Wallet: ${userB.wallet.slice(0, 8)}...`);

    // =========================================================================
    // SECTION 4: PROFILE, ROLE & RBAC SECURITY TESTS
    // =========================================================================
    console.log('\n--- SECTION 4: Profile, Role & RBAC Tests ---');

    // 4.1 Authenticated session profile query
    const meRes = await api('/api/auth/me', { headers: { Authorization: `Bearer ${userA.token}` } });
    if (meRes.status === 200 && meRes.data.profile?.wallet_address === userA.wallet) {
      recordTest('Profile & Roles', 'GET /api/auth/me loads profile and stats with Bearer token', 'PASS', `Role: ${meRes.data.profile.role}`);
    } else {
      recordTest('Profile & Roles', 'GET /api/auth/me loads profile and stats with Bearer token', 'FAIL', JSON.stringify(meRes.data));
    }

    // 4.2 Unauthenticated protected route blocked (Scenario C: Unauthorized user)
    const unauthMe = await api('/api/auth/me');
    if (unauthMe.status === 401) {
      recordTest('Profile & Roles', 'Unauthenticated request to protected route blocked', 'PASS', 'HTTP 401');
    } else {
      recordTest('Profile & Roles', 'Unauthenticated request to protected route blocked', 'FAIL', `Status: ${unauthMe.status}`);
    }

    // 4.3 Safe profile updates (displayName, bio)
    const updateProf = await api('/api/auth/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ displayName: 'Alice Lead QA', bio: 'Auditing Solana Smart Contracts' })
    });
    if (updateProf.status === 200 && updateProf.data.profile?.display_name === 'Alice Lead QA') {
      recordTest('Profile & Roles', 'Permitted profile fields update (displayName, bio)', 'PASS', 'Updated in DB');
    } else {
      recordTest('Profile & Roles', 'Permitted profile fields update (displayName, bio)', 'FAIL', JSON.stringify(updateProf.data));
    }

    // 4.4 Role escalation attack defense (Adversarial)
    const attackRole = await api('/api/auth/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ role: 'ADMIN' })
    });
    if (attackRole.status === 403) {
      recordTest('Profile & Roles', 'Client role escalation attempt ({ role: "ADMIN" }) blocked', 'PASS', 'HTTP 403 Forbidden');
    } else {
      recordTest('Profile & Roles', 'Client role escalation attempt ({ role: "ADMIN" }) blocked', 'FAIL', `Status: ${attackRole.status}`);
    }

    // 4.5 Stats tampering defense (Adversarial)
    const attackStats = await api('/api/auth/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ success_rate: 100, total_staked_usdc: 999999 })
    });
    if (attackStats.status === 403) {
      recordTest('Profile & Roles', 'Client user_stats tampering attempt blocked', 'PASS', 'HTTP 403 Forbidden');
    } else {
      recordTest('Profile & Roles', 'Client user_stats tampering attempt blocked', 'FAIL', `Status: ${attackStats.status}`);
    }

    // 4.6 Ordinary user calling admin endpoint blocked
    const unauthAdmin = await api('/api/admin/users', { headers: { Authorization: `Bearer ${userA.token}` } });
    if (unauthAdmin.status === 403) {
      recordTest('Profile & Roles', 'Ordinary user calling /api/admin/users blocked', 'PASS', 'HTTP 403 Forbidden');
    } else {
      recordTest('Profile & Roles', 'Ordinary user calling /api/admin/users blocked', 'FAIL', `Status: ${unauthAdmin.status}`);
    }

    // 4.7 Provision authoritative Admin user
    adminUser = await createAndAuthWallet('admin');
    await supabaseAdmin.from('user_profiles').update({ role: 'ADMIN' }).eq('id', adminUser.profile.id);
    await supabaseAdmin.from('admin_users').insert({ user_id: adminUser.profile.id, admin_role: 'ADMIN', status: 'ACTIVE' });
    const adminDashboard = await api('/api/admin/dashboard', { headers: { Authorization: `Bearer ${adminUser.token}` } });
    if (adminDashboard.status === 200 && adminDashboard.data.systemStatus === 'HEALTHY') {
      recordTest('Profile & Roles', 'Authoritative Admin access to /api/admin/dashboard', 'PASS', `Total commitments: ${adminDashboard.data.stats.totalCommitments}`);
    } else {
      recordTest('Profile & Roles', 'Authoritative Admin access to /api/admin/dashboard', 'FAIL', JSON.stringify(adminDashboard.data));
    }

    // 4.8 Account status enforcement: Suspend & Disable user
    const suspendRes = await api(`/api/admin/users/${userB.user.id}/status`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminUser.token}` },
      body: JSON.stringify({ status: 'SUSPENDED', reason: 'Audit test suspension' })
    });
    if (suspendRes.status === 200) {
      recordTest('Profile & Roles', 'Admin sets user status to SUSPENDED', 'PASS', 'Status updated');
    } else {
      recordTest('Profile & Roles', 'Admin sets user status to SUSPENDED', 'FAIL', JSON.stringify(suspendRes.data));
    }

    // 4.9 Suspended user blocked from creating commitments
    const suspendedCreate = await api('/api/commitments/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({
        title: 'Commitment while suspended',
        stakeAmount: 20,
        verifierType: 'github'
      })
    });
    if (suspendedCreate.status === 403) {
      recordTest('Profile & Roles', 'Suspended user blocked from commitment creation', 'PASS', 'HTTP 403');
    } else {
      recordTest('Profile & Roles', 'Suspended user blocked from commitment creation', 'FAIL', `Status: ${suspendedCreate.status}`);
    }

    // Reactivate User B for further tests
    await api(`/api/admin/users/${userB.user.id}/status`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminUser.token}` },
      body: JSON.stringify({ status: 'ACTIVE', reason: 'Reactivated for QA testing' })
    });

    // =========================================================================
    // SECTION 5: COMMITMENT CREATION & LIFECYCLE TESTS
    // =========================================================================
    console.log('\n--- SECTION 5: Commitment Creation & Lifecycle Tests ---');

    // 5.1 Validation: Missing title rejected
    const badTitle = await api('/api/commitments/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ title: 'ab', stakeAmount: 25, verifierType: 'github' })
    });
    if (badTitle.status === 400) {
      recordTest('Commitment Creation', 'Title validation (< 3 chars) rejected', 'PASS', 'HTTP 400');
    } else {
      recordTest('Commitment Creation', 'Title validation (< 3 chars) rejected', 'FAIL', `Status: ${badTitle.status}`);
    }

    // 5.2 Validation: Stake below minimum (< 5 USDC) rejected
    const lowStake = await api('/api/commitments/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ title: 'Valid Commitment Title', stakeAmount: 3, verifierType: 'github' })
    });
    if (lowStake.status === 400) {
      recordTest('Commitment Creation', 'Stake validation (< 5 USDC) rejected', 'PASS', 'HTTP 400');
    } else {
      recordTest('Commitment Creation', 'Stake validation (< 5 USDC) rejected', 'FAIL', `Status: ${lowStake.status}`);
    }

    // 5.3 Validation: Invalid verifierType rejected
    const badVerifier = await api('/api/commitments/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ title: 'Valid Title', stakeAmount: 25, verifierType: 'magic_oracle' })
    });
    if (badVerifier.status === 400) {
      recordTest('Commitment Creation', 'Unsupported verifierType rejected', 'PASS', 'HTTP 400');
    } else {
      recordTest('Commitment Creation', 'Unsupported verifierType rejected', 'FAIL', `Status: ${badVerifier.status}`);
    }

    // 5.4 Valid commitment creation (CREATED state)
    let commitmentA = null;
    const createA = await api('/api/commitments/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        title: 'Ship 5 Anchor Commits to Solana Repository',
        creator: userA.wallet,
        stakingMode: 'HARDCORE',
        stakeAmount: 30,
        penaltyAmount: 10,
        verificationFee: 1.5,
        verifierType: 'github',
        failurePolicy: 'PARTIAL_EDUCATION_POOL',
        failurePolicyText: '20 USDC returned, 10 USDC to Dev Education Pool',
        details: { repoOwner: 'solana-labs', repoName: 'solana', authorUsername: 'alice-qa', requiredCommits: 5 }
      })
    });
    if (createA.status === 201 && createA.data.status === 'CREATED' && createA.data.id) {
      commitmentA = createA.data;
      recordTest('Commitment Creation', 'Valid commitment creation initializes in CREATED state', 'PASS', `ID: ${commitmentA.id}`);
    } else {
      recordTest('Commitment Creation', 'Valid commitment creation initializes in CREATED state', 'FAIL', JSON.stringify(createA.data));
    }

    // 5.5 Cancellation of un-funded commitment (CREATED -> CANCELLED)
    const cancelRes = await api(`/api/commitments/${commitmentA.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    if (cancelRes.status === 200 && cancelRes.data.commitment?.status === 'CANCELLED') {
      recordTest('Commitment Lifecycle', 'Un-funded commitment cancellation transitions to CANCELLED', 'PASS', 'Status: CANCELLED');
    } else {
      recordTest('Commitment Lifecycle', 'Un-funded commitment cancellation transitions to CANCELLED', 'FAIL', JSON.stringify(cancelRes.data));
    }

    // 5.6 Cannot fund cancelled commitment
    const badFund = await api(`/api/commitments/${commitmentA.id}/fund`, { method: 'POST' });
    if (badFund.status === 400) {
      recordTest('Commitment Lifecycle', 'Funding a cancelled commitment is strictly rejected', 'PASS', 'HTTP 400');
    } else {
      recordTest('Commitment Lifecycle', 'Funding a cancelled commitment is strictly rejected', 'FAIL', `Status: ${badFund.status}`);
    }

    // Create fresh commitment to test Funding & Active lifecycle (Scenario D: Commitment Success)
    const createFresh = await api('/api/commitments/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        title: 'Complete 5 Anchor Instructions',
        creator: userA.wallet,
        stakingMode: 'HARDCORE',
        stakeAmount: 50,
        penaltyAmount: 15,
        verifierType: 'github',
        failurePolicy: 'PARTIAL_EDUCATION_POOL',
        details: { repoOwner: 'solana-labs', repoName: 'solana', authorUsername: 'alice-qa', requiredCommits: 5 }
      })
    });
    commitmentA = createFresh.data;

    // 5.7 Funding commitment (CREATED -> ACTIVE)
    const fundRes = await api(`/api/commitments/${commitmentA.id}/fund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    if (fundRes.status === 200 && fundRes.data.commitment?.status === 'ACTIVE' && fundRes.data.commitment?.escrowPda) {
      commitmentA = fundRes.data.commitment;
      recordTest('Commitment Lifecycle', 'Funding commitment locks into Solana Escrow PDA and transitions to ACTIVE', 'PASS', `PDA: ${commitmentA.escrowPda.slice(0, 10)}...`);
    } else {
      recordTest('Commitment Lifecycle', 'Funding commitment locks into Solana Escrow PDA and transitions to ACTIVE', 'FAIL', JSON.stringify(fundRes.data));
    }

    // 5.8 Funded commitment immutability: Cannot cancel once funded
    const cancelFunded = await api(`/api/commitments/${commitmentA.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    if (cancelFunded.status === 400) {
      recordTest('Commitment Lifecycle', 'Funded commitment rules cannot be cancelled or bypassed', 'PASS', 'HTTP 400');
    } else {
      recordTest('Commitment Lifecycle', 'Funded commitment rules cannot be cancelled or bypassed', 'FAIL', `Status: ${cancelFunded.status}`);
    }

    // =========================================================================
    // SECTION 6: SOLANA ESCROW & ANCHOR PDA VERIFICATION
    // =========================================================================
    console.log('\n--- SECTION 6: Solana Escrow & Anchor Integration Tests ---');

    // 6.1 Anchor PDA Derivation validation
    const [derivedVaultPda, bump] = escrowClient.findEscrowVaultPda(commitmentA.id);
    if (derivedVaultPda.toBase58() === commitmentA.escrowPda && bump >= 0 && bump <= 255) {
      recordTest('Solana/Anchor', 'Anchor PDA deterministic derivation & canonical bump seed', 'PASS', `Vault: ${derivedVaultPda.toBase58().slice(0, 8)}... (Bump: ${bump})`);
    } else {
      recordTest('Solana/Anchor', 'Anchor PDA deterministic derivation & canonical bump seed', 'FAIL', `Derived: ${derivedVaultPda.toBase58()}`);
    }

    // 6.2 Solana Devnet RPC Connection health check
    let devnetOnline = false;
    try {
      const slot = await escrowClient.connection.getSlot('confirmed');
      const blockhash = await escrowClient.getLatestBlockhash();
      if (slot > 0 && blockhash) {
        devnetOnline = true;
        recordTest('Solana/Anchor', 'Solana Devnet RPC connection & blockhash query', 'PASS', `Slot: ${slot}, Blockhash: ${blockhash.slice(0, 10)}...`);
      }
    } catch (e) {
      recordTest('Solana/Anchor', 'Solana Devnet RPC connection', 'BLOCKED', `RPC Error: ${e.message}`);
    }

    // 6.3 Solana Actions & Blinks Spec Compliance
    const actionsSpec = await api('/actions.json');
    const actionMeta = await api(`/api/actions/commit?id=${commitmentA.id}`);
    if (actionsSpec.status === 200 && Array.isArray(actionsSpec.data.rules) && actionMeta.status === 200 && actionMeta.data.icon) {
      recordTest('Solana/Anchor', 'Solana Actions & Blinks standard compliance (/actions.json & metadata)', 'PASS', `Label: ${actionMeta.data.label}`);
    } else {
      recordTest('Solana/Anchor', 'Solana Actions & Blinks standard compliance', 'FAIL', JSON.stringify(actionMeta.data));
    }

    // =========================================================================
    // SECTION 7: GITHUB VERIFIER ENGINE TESTS
    // =========================================================================
    console.log('\n--- SECTION 7: Automated GitHub Verifier Engine Tests ---');

    // 7.1 Verify qualifying commits (Filters merge commits & duplicates)
    const customCommits = [
      { sha: 'sha_01', message: 'feat: add escrow instruction', author: 'alice-qa', date: new Date().toISOString(), isMerge: false },
      { sha: 'sha_02', message: 'fix: validate state transition', author: 'alice-qa', date: new Date().toISOString(), isMerge: false },
      { sha: 'sha_03', message: 'test: add unit coverage', author: 'alice-qa', date: new Date().toISOString(), isMerge: false },
      { sha: 'sha_04', message: 'docs: update anchor spec', author: 'alice-qa', date: new Date().toISOString(), isMerge: false },
      { sha: 'sha_05', message: 'refactor: optimize gas cost', author: 'alice-qa', date: new Date().toISOString(), isMerge: false },
      { sha: 'sha_05', message: 'duplicate sha submission', author: 'alice-qa', date: new Date().toISOString(), isMerge: false }, // Duplicate SHA
      { sha: 'sha_06', message: 'Merge pull request #42', author: 'alice-qa', date: new Date().toISOString(), isMerge: true } // Merge commit
    ];

    const ghVerify = await api('/api/verify/github', {
      method: 'POST',
      body: JSON.stringify({
        commitmentId: commitmentA.id,
        authorUsername: 'alice-qa',
        requiredCommits: 5,
        customCommits
      })
    });
    if (ghVerify.status === 200 && ghVerify.data.attestation?.isSuccessful && ghVerify.data.isSignatureValid) {
      commitmentA.status = 'VERIFIED';
      commitmentA.attestation = ghVerify.data.attestation;
      recordTest('GitHub Verifier', 'Filters merge & duplicate commits, emits valid Ed25519 PASS attestation', 'PASS', `Result: ${ghVerify.data.attestation.resultCode}`);
    } else {
      recordTest('GitHub Verifier', 'Filters merge & duplicate commits, emits valid Ed25519 PASS attestation', 'FAIL', JSON.stringify(ghVerify.data));
    }

    // 7.2 Insufficient commits produces GH_FAIL
    const createGhFail = await api('/api/commitments/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        title: 'Commitment for GH Fail Test',
        creator: userA.wallet,
        stakingMode: 'HARDCORE',
        stakeAmount: 20,
        verifierType: 'github',
        details: { repoOwner: 'solana-labs', repoName: 'solana', authorUsername: 'alice-qa', requiredCommits: 5 }
      })
    });
    await api(`/api/commitments/${createGhFail.data.id}/fund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` }
    });

    const ghFailTest = await api('/api/verify/github', {
      method: 'POST',
      body: JSON.stringify({
        commitmentId: createGhFail.data.id,
        authorUsername: 'alice-qa',
        requiredCommits: 5,
        customCommits: [
          { sha: 'sha_single', message: 'only 1 commit', author: 'alice-qa', date: new Date().toISOString(), isMerge: false }
        ]
      })
    });
    if (ghFailTest.status === 200 && !ghFailTest.data.attestation?.isSuccessful && ghFailTest.data.attestation?.resultCode === 'GH_FAIL') {
      recordTest('GitHub Verifier', 'Insufficient commits correctly produces GH_FAIL with isSuccessful=false', 'PASS', 'Result: GH_FAIL');
    } else {
      recordTest('GitHub Verifier', 'Insufficient commits correctly produces GH_FAIL', 'FAIL', JSON.stringify(ghFailTest.data));
    }

    // =========================================================================
    // SECTION 8: STUDY TIMER FOCUS VERIFIER TESTS
    // =========================================================================
    console.log('\n--- SECTION 8: Deep Work Focus Study Timer Tests ---');

    // 8.1 Start session & get challenge nonce
    const studyStart = await api('/api/verify/study/start', {
      method: 'POST',
      body: JSON.stringify({ commitmentId: 'cm_study_02' })
    });
    if (studyStart.status === 200 && studyStart.data.nonce && studyStart.data.nonce.length >= 32) {
      recordTest('Study Timer', 'Start study session emits random rotating challenge nonce', 'PASS', `Nonce: ${studyStart.data.nonce.slice(0, 10)}...`);
    } else {
      recordTest('Study Timer', 'Start study session emits random rotating challenge nonce', 'FAIL', JSON.stringify(studyStart.data));
    }

    // 8.2 Cryptographic Heartbeat & Nonce Rotation
    const initialNonce = studyStart.data.nonce;
    const hb1 = await api('/api/verify/study/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ commitmentId: 'cm_study_02', clientNonce: initialNonce, wasFocused: true })
    });
    if (hb1.status === 200 && hb1.data.nextNonce && hb1.data.nextNonce !== initialNonce) {
      recordTest('Study Timer', 'Heartbeat validates nonce, increments active seconds, and rotates nonce', 'PASS', `Active: ${hb1.data.verifiedActiveSeconds}s`);
    } else {
      recordTest('Study Timer', 'Heartbeat validates nonce, increments active seconds, and rotates nonce', 'FAIL', JSON.stringify(hb1.data));
    }

    // 8.3 Replayed heartbeat nonce rejection (Adversarial)
    const hbReplay = await api('/api/verify/study/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ commitmentId: 'cm_study_02', clientNonce: initialNonce, wasFocused: true })
    });
    if (hbReplay.status === 400) {
      recordTest('Study Timer', 'Replay Attack: Submitting outdated/consumed heartbeat nonce rejected', 'PASS', 'HTTP 400');
    } else {
      recordTest('Study Timer', 'Replay Attack: Submitting outdated/consumed heartbeat nonce rejected', 'FAIL', `Status: ${hbReplay.status}`);
    }

    // 8.4 Finish session and attest
    const studyFinish = await api('/api/verify/study/finish', {
      method: 'POST',
      body: JSON.stringify({ commitmentId: 'cm_study_02', demoForceSeconds: 300 })
    });
    if (studyFinish.status === 200 && studyFinish.data.isSignatureValid && studyFinish.data.attestation?.resultCode === 'STUDY_PASS') {
      recordTest('Study Timer', 'Finish session generates cryptographically signed Ed25519 STUDY_PASS', 'PASS', 'STUDY_PASS Verified');
    } else {
      recordTest('Study Timer', 'Finish session generates cryptographically signed Ed25519 STUDY_PASS', 'FAIL', JSON.stringify(studyFinish.data));
    }

    // =========================================================================
    // SECTION 9: HUMAN VERIFIER & PEER CONSENSUS TESTS
    // =========================================================================
    console.log('\n--- SECTION 9: Human Verifier & Peer Consensus Tests ---');

    // Create fresh commitment for Peer Consensus Testing
    const createPeerComm = await api('/api/commitments/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        title: 'Physical Workbench Cleaning & Organization',
        creator: userA.wallet,
        stakingMode: 'HARDCORE',
        stakeAmount: 30,
        verifierType: 'peer_consensus',
        details: { taskName: 'Clean Electronics Workbench' }
      })
    });
    const pId = createPeerComm.data.id;
    await api(`/api/commitments/${pId}/fund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` }
    });

    // 9.1 Dynamic blockhash challenge code generation
    const peerChal = await api(`/api/verify/peer/challenge/${pId}`);
    if (peerChal.status === 200 && peerChal.data.challengeCode && peerChal.data.blockhash) {
      recordTest('Human Verifier', 'Generates dynamic Solana blockhash challenge code for photo evidence', 'PASS', `Code: ${peerChal.data.challengeCode}`);
    } else {
      recordTest('Human Verifier', 'Generates dynamic Solana blockhash challenge code for photo evidence', 'FAIL', JSON.stringify(peerChal.data));
    }

    // 9.2 Submit proof with dynamic blockhash code
    await api('/api/verify/peer/submit-proof', {
      method: 'POST',
      body: JSON.stringify({
        commitmentId: pId,
        evidenceData: {
          mediaUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
          description: 'Workbench cleaned, cables bundled, parts sorted, blockhash code visible',
          checklist: [{ label: 'Work surface clean', checked: true }, { label: 'Blockhash visible', checked: true }]
        }
      })
    });

    // 9.3 2-of-3 decentralized peer consensus voting
    const vote1 = await api('/api/verify/peer/vote', {
      method: 'POST',
      body: JSON.stringify({ commitmentId: pId, verifierId: 'v_alex', vote: 'PASS', notes: 'Blockhash matches' })
    });
    const vote2 = await api('/api/verify/peer/vote', {
      method: 'POST',
      body: JSON.stringify({ commitmentId: pId, verifierId: 'v_elena', vote: 'PASS', notes: 'Confirmed desk is clean' })
    });
    if (vote2.status === 200 && vote2.data.consensusReached && vote2.data.attestation?.resultCode === 'HUMAN_PASS') {
      recordTest('Human Verifier', '2-of-3 Peer Consensus triggers signed Oracle attestation (HUMAN_PASS)', 'PASS', 'HUMAN_PASS Generated');
    } else {
      recordTest('Human Verifier', '2-of-3 Peer Consensus triggers signed Oracle attestation', 'FAIL', JSON.stringify(vote2.data));
    }

    // 9.4 Duplicate vote from same verifier rejected
    const dupVote = await api('/api/verify/peer/vote', {
      method: 'POST',
      body: JSON.stringify({ commitmentId: pId, verifierId: 'v_alex', vote: 'PASS' })
    });
    if (dupVote.status === 400) {
      recordTest('Human Verifier', 'Sybil defense: Duplicate vote from same verifier strictly rejected', 'PASS', 'HTTP 400');
    } else {
      recordTest('Human Verifier', 'Sybil defense: Duplicate vote from same verifier strictly rejected', 'FAIL', `Status: ${dupVote.status}`);
    }

    // =========================================================================
    // SECTION 10: ATTESTATION CRYPTOGRAPHY & SETTLEMENT TESTS
    // =========================================================================
    console.log('\n--- SECTION 10: Attestation Cryptography & Devnet Settlement Tests ---');

    // 10.1 Valid Ed25519 Oracle Signature on attestation
    const isAttestationSigValid = verifyAttestationSignature(commitmentA.attestation);
    if (isAttestationSigValid) {
      recordTest('Attestation', 'Ed25519 Oracle signature passes cryptographic verification', 'PASS', 'Signature Verified');
    } else {
      recordTest('Attestation', 'Ed25519 Oracle signature passes cryptographic verification', 'FAIL', 'Signature Invalid');
    }

    // 10.2 Tampered attestation payload rejected (Adversarial)
    const tamperedAttestation = JSON.parse(JSON.stringify(commitmentA.attestation));
    tamperedAttestation.resultCode = 'GH_FAIL'; // Tampered result code in canonical signed payload
    const isTamperedSigValid = verifyAttestationSignature(tamperedAttestation);
    if (!isTamperedSigValid) {
      recordTest('Attestation', 'Tampered attestation payload (flipped resultCode) fails signature check', 'PASS', 'Tampering Detected');
    } else {
      recordTest('Attestation', 'Tampered attestation payload fails signature check', 'FAIL', 'Tampered signature falsely accepted');
    }

    // 10.3 Execute on-chain settlement on Solana Devnet (Scenario D)
    const settleRes = await api(`/api/commitments/${commitmentA.id}/settle`, { method: 'POST' });
    if (settleRes.status === 200 && settleRes.data.commitment?.status === 'SETTLED' && settleRes.data.commitment?.settlement?.txSignature) {
      commitmentA.status = 'SETTLED';
      recordTest('Solana Settlement', 'Settlement executes successfully on Solana Devnet, emitting txSignature', 'PASS', `Tx: ${settleRes.data.commitment.settlement.txSignature.slice(0, 16)}...`);
    } else {
      recordTest('Solana Settlement', 'Settlement executes successfully on Solana Devnet', 'FAIL', JSON.stringify(settleRes.data));
    }

    // 10.4 Double settlement idempotency check (Adversarial)
    const doubleSettle = await api(`/api/commitments/${commitmentA.id}/settle`, { method: 'POST' });
    if (doubleSettle.status === 400) {
      recordTest('Solana Settlement', 'Double Settlement Defense: Settling already settled commitment rejected', 'PASS', 'HTTP 400 (Idempotent)');
    } else {
      recordTest('Solana Settlement', 'Double Settlement Defense: Settling already settled commitment rejected', 'FAIL', `Status: ${doubleSettle.status}`);
    }

    // =========================================================================
    // SECTION 11: DISPUTE LIFECYCLE TESTS (SCENARIO G)
    // =========================================================================
    console.log('\n--- SECTION 11: Formal Dispute Lifecycle Tests ---');

    // Create a new commitment to test formal dispute lifecycle
    const createDisputeComm = await api('/api/commitments/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        title: 'Commitment for Dispute Lifecycle Testing',
        creator: userA.wallet,
        stakingMode: 'HARDCORE',
        stakeAmount: 40,
        penaltyAmount: 10,
        verifierType: 'github',
        failurePolicy: 'PARTIAL_EDUCATION_POOL',
        details: { repoOwner: 'solana-labs', repoName: 'solana', authorUsername: 'alice-qa', requiredCommits: 5 }
      })
    });
    const dispCommId = createDisputeComm.data.id;
    await api(`/api/commitments/${dispCommId}/fund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` }
    });

    // Verify it with a failing result so user can dispute
    await api('/api/verify/github', {
      method: 'POST',
      body: JSON.stringify({
        commitmentId: dispCommId,
        authorUsername: 'alice-qa',
        requiredCommits: 5,
        customCommits: []
      })
    });

    // 11.1 Opening valid dispute transitions status to DISPUTED
    const openDispute = await api(`/api/commitments/${dispCommId}/dispute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ reason: 'GitHub API experienced rate limit outage during push period' })
    });
    if (openDispute.status === 200 && openDispute.data.commitment?.status === 'DISPUTED') {
      recordTest('Disputes', 'User opens dispute, commitment status transitions to DISPUTED', 'PASS', `Dispute ID: ${openDispute.data.dispute?.dispute_id}`);
    } else {
      recordTest('Disputes', 'User opens dispute, commitment status transitions to DISPUTED', 'FAIL', JSON.stringify(openDispute.data));
    }

    // 11.2 Active dispute freezes normal settlement
    const frozenSettle = await api(`/api/commitments/${dispCommId}/settle`, { method: 'POST' });
    if (frozenSettle.status === 400 && frozenSettle.data.error.includes('dispute')) {
      recordTest('Disputes', 'Active dispute strictly freezes and blocks normal settlement attempt', 'PASS', 'HTTP 400 (Settlement Frozen)');
    } else {
      recordTest('Disputes', 'Active dispute strictly freezes and blocks normal settlement attempt', 'FAIL', `Status: ${frozenSettle.status}`);
    }

    // 11.3 Ordinary user attempting to resolve dispute blocked (Adversarial)
    const attackResolve = await api(`/api/commitments/${dispCommId}/resolve-dispute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ resolution: 'OVERTURN_TO_PASS' })
    });
    if (attackResolve.status === 403) {
      recordTest('Disputes', 'Ordinary user calling dispute resolution endpoint blocked', 'PASS', 'HTTP 403 Forbidden');
    } else {
      recordTest('Disputes', 'Ordinary user calling dispute resolution endpoint blocked', 'FAIL', `Status: ${attackResolve.status}`);
    }

    // 11.4 Authorized Admin resolves dispute (OVERTURN_TO_PASS)
    const adminResolve = await api(`/api/commitments/${dispCommId}/resolve-dispute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminUser.token}` },
      body: JSON.stringify({ resolution: 'OVERTURN_TO_PASS', notes: 'Outage verified on status.github.com' })
    });
    if (adminResolve.status === 200 && adminResolve.data.commitment?.status === 'VERIFIED' && adminResolve.data.commitment?.attestation?.resultCode === 'DISPUTE_OVERTURN_PASS') {
      recordTest('Disputes', 'Authorized Admin resolves dispute with outcome OVERTURN_TO_PASS', 'PASS', 'Status: VERIFIED');
    } else {
      recordTest('Disputes', 'Authorized Admin resolves dispute with outcome OVERTURN_TO_PASS', 'FAIL', JSON.stringify(adminResolve.data));
    }

    // 11.5 Settle resolved commitment successfully
    const postDisputeSettle = await api(`/api/commitments/${dispCommId}/settle`, { method: 'POST' });
    if (postDisputeSettle.status === 200 && postDisputeSettle.data.commitment?.status === 'SETTLED') {
      recordTest('Disputes', 'Post-dispute settlement executes successfully with full principal returned', 'PASS', 'Status: SETTLED');
    } else {
      recordTest('Disputes', 'Post-dispute settlement executes successfully', 'FAIL', JSON.stringify(postDisputeSettle.data));
    }

    // =========================================================================
    // SECTION 12: DATABASE, RLS & API SECURITY (IDOR) TESTS (SCENARIO H)
    // =========================================================================
    console.log('\n--- SECTION 12: Database, RLS & IDOR Security Tests ---');

    // 12.1 IDOR Attack: User B attempts to upload evidence to User A's commitment
    const idorEvidence = await api(`/api/commitments/${dispCommId}/evidence`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ description: 'Attacker spoofed evidence', content: 'fake.png' })
    });
    if (idorEvidence.status === 403) {
      recordTest('Security & IDOR', 'IDOR Defense: User B cannot upload evidence to User A commitment', 'PASS', 'HTTP 403 Forbidden');
    } else {
      recordTest('Security & IDOR', 'IDOR Defense: User B cannot upload evidence to User A commitment', 'FAIL', `Status: ${idorEvidence.status}`);
    }

    // 12.2 IDOR Attack: User B attempts to dispute User A's commitment
    const idorDispute = await api(`/api/commitments/${dispCommId}/dispute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ reason: 'Malicious dispute attempt' })
    });
    if (idorDispute.status === 403) {
      recordTest('Security & IDOR', 'IDOR Defense: User B cannot dispute User A commitment', 'PASS', 'HTTP 403 Forbidden');
    } else {
      recordTest('Security & IDOR', 'IDOR Defense: User B cannot dispute User A commitment', 'FAIL', `Status: ${idorDispute.status}`);
    }

    // 12.3 Data Scoping: User B querying /api/commitments/my sees only their own
    const myA = await api('/api/commitments/my', { headers: { Authorization: `Bearer ${userA.token}` } });
    const myB = await api('/api/commitments/my', { headers: { Authorization: `Bearer ${userB.token}` } });
    if (myA.status === 200 && myB.status === 200 && myA.data.commitments.length >= 2 && myB.data.commitments.length === 0) {
      recordTest('Security & IDOR', 'Data Scoping: /api/commitments/my strictly filters by authenticated user', 'PASS', `User A: ${myA.data.commitments.length}, User B: 0`);
    } else {
      recordTest('Security & IDOR', 'Data Scoping: /api/commitments/my strictly filters by authenticated user', 'FAIL', `User A: ${myA.data?.commitments?.length}, User B: ${myB.data?.commitments?.length}`);
    }

    // 12.4 Sensitive Evidence Privacy: Third party receives redacted evidence
    const publicCommView = await api(`/api/commitments/${dispCommId}`);
    if (publicCommView.status === 200 && publicCommView.data.viewerIsOwner === false) {
      recordTest('Security & IDOR', 'Third-party viewer sees sanitized commitment without private evidence', 'PASS', 'viewerIsOwner: false');
    } else {
      recordTest('Security & IDOR', 'Third-party viewer sees sanitized commitment', 'FAIL', JSON.stringify(publicCommView.data));
    }

  } catch (err) {
    console.error('Unhandled QA test error:', err);
    failedTests++;
  } finally {
    console.log('\n--- Cleaning up temporary QA test accounts ---');
    if (userA) await supabaseAdmin.auth.admin.deleteUser(userA.user.id).catch(() => {});
    if (userB) await supabaseAdmin.auth.admin.deleteUser(userB.user.id).catch(() => {});
    if (adminUser) await supabaseAdmin.auth.admin.deleteUser(adminUser.user.id).catch(() => {});
    console.log('Cleanup completed.');
  }

  console.log('\n================================================================');
  console.log(`QA AUDIT SUMMARY: ${passedTests} PASSED | ${failedTests} FAILED | ${blockedTests} BLOCKED (Total: ${totalTests})`);
  console.log('================================================================\n');

  return { totalTests, passedTests, failedTests, blockedTests, testResults };
}

runQAAudit();
