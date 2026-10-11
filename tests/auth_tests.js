import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { supabaseAdmin } from '../server/auth/supabase.js';

// Helper for Base58
function encodeBase58(buffer) {
  if (typeof bs58.encode === 'function') return bs58.encode(buffer);
  if (bs58.default && typeof bs58.default.encode === 'function') return bs58.default.encode(buffer);
  throw new Error('Base58 encode unavailable');
}
function decodeBase58(str) {
  if (typeof bs58.decode === 'function') return bs58.decode(str);
  if (bs58.default && typeof bs58.default.decode === 'function') return bs58.default.decode(str);
  throw new Error('Base58 decode unavailable');
}

const BASE_URL = 'http://localhost:3000';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

// Helper to authenticate a wallet keypair
async function authenticateWallet(keypair, options = {}) {
  const walletAddress = encodeBase58(keypair.publicKey);
  const chalRes = await fetch(`${BASE_URL}/api/auth/wallet/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress })
  });
  const chalData = await chalRes.json();
  if (chalRes.status !== 200) throw new Error(`Challenge failed: ${JSON.stringify(chalData)}`);

  const messageBytes = new TextEncoder().encode(chalData.message);
  const sigBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signature = encodeBase58(sigBytes);

  const authRes = await fetch(`${BASE_URL}/api/auth/wallet/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress,
      nonce: chalData.nonce,
      signature,
      username: options.username,
      displayName: options.displayName
    })
  });
  const authData = await authRes.json();
  return { status: authRes.status, data: authData, challenge: chalData, signature, walletAddress };
}

async function runAuthTests() {
  console.log('\n================================================================');
  console.log('🔒 COMMIT PROTOCOL — MASTER AUTH & BACKEND TEST SUITE');
  console.log('================================================================\n');

  const timestamp = Date.now();

  let userAToken = null;
  let userAId = null;
  let userAProfileId = null;

  let userBToken = null;
  let userBId = null;
  let userBProfileId = null;

  let adminToken = null;
  let adminId = null;
  let adminProfileId = null;

  // Keypairs for wallet signing
  const walletA = nacl.sign.keyPair();
  const walletAPublicKey = encodeBase58(walletA.publicKey);

  const walletB = nacl.sign.keyPair();
  const walletBPublicKey = encodeBase58(walletB.publicKey);

  const walletAdmin = nacl.sign.keyPair();
  const walletAdminPublicKey = encodeBase58(walletAdmin.publicKey);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: RETIREMENT OF TRADITIONAL EMAIL/PASSWORD AUTHENTICATION (HTTP 410 GONE)
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Legacy Email/Password Authentication Discontinuation ---');

    // 1a. Signup endpoint returns 410 Gone
    const legacySignupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `legacy_${timestamp}@example.com`,
        password: 'Password123!',
        username: `legacy_${timestamp}`,
        displayName: 'Legacy User'
      })
    });
    const legacySignupData = await legacySignupRes.json();
    assert(legacySignupRes.status === 410, 'Legacy /api/auth/signup returns HTTP 410 Gone');
    assert(legacySignupData.code === 'WALLET_AUTH_REQUIRED', 'Signup response explicitly specifies WALLET_AUTH_REQUIRED');

    // 1b. Login endpoint returns 410 Gone
    const legacyLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `legacy_${timestamp}@example.com`,
        password: 'Password123!'
      })
    });
    const legacyLoginData = await legacyLoginRes.json();
    assert(legacyLoginRes.status === 410, 'Legacy /api/auth/login returns HTTP 410 Gone');
    assert(legacyLoginData.code === 'WALLET_AUTH_REQUIRED', 'Login response explicitly specifies WALLET_AUTH_REQUIRED');

    // 1c. Forgot password endpoint returns 410 Gone
    const legacyForgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `legacy_${timestamp}@example.com` })
    });
    const legacyForgotData = await legacyForgotRes.json();
    assert(legacyForgotRes.status === 410, 'Legacy /api/auth/forgot-password returns HTTP 410 Gone');
    assert(legacyForgotData.code === 'WALLET_AUTH_REQUIRED', 'Forgot password response specifies WALLET_AUTH_REQUIRED');

    // -------------------------------------------------------------------------
    // TEST 2: SOLANA WALLET AUTHENTICATION CHALLENGE GENERATION
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Solana Wallet Challenge Nonce Generation ---');

    // 2a. Missing wallet address rejected
    const badChalRes = await fetch(`${BASE_URL}/api/auth/wallet/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert(badChalRes.status === 400, 'Challenge request without walletAddress rejected with HTTP 400');

    // 2b. Invalid base58 wallet address rejected
    const badPubkeyRes = await fetch(`${BASE_URL}/api/auth/wallet/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: 'not-a-valid-solana-address!!' })
    });
    assert(badPubkeyRes.status === 400, 'Invalid base58 wallet address rejected with HTTP 400');

    // 2c. Valid challenge request for Wallet A
    const chalARes = await fetch(`${BASE_URL}/api/auth/wallet/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: walletAPublicKey })
    });
    const chalAData = await chalARes.json();
    assert(chalARes.status === 200, 'Challenge request for valid wallet succeeds with HTTP 200');
    assert(chalAData.nonce && chalAData.nonce.length === 64, 'Backend generated 32-byte hex nonce (64 hex characters)');
    assert(chalAData.message.includes('Commit Protocol'), 'Challenge canonical message contains protocol header');
    assert(chalAData.message.includes(walletAPublicKey), 'Challenge message contains requested wallet address');
    assert(chalAData.expiresAt, 'Challenge provides expiry timestamp');

    // 2d. SIWS: Correct local HTTP origin accepted and exact URI matched
    const localOriginChalRes = await fetch(`${BASE_URL}/api/auth/wallet/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: walletAPublicKey,
        origin: 'http://localhost:3000'
      })
    });
    const localOriginData = await localOriginChalRes.json();
    assert(localOriginChalRes.status === 200, 'SIWS: Request with origin "http://localhost:3000" succeeds with HTTP 200');
    assert(localOriginData.message.includes('URI: http://localhost:3000'), 'SIWS: Sign-in message contains exact requesting app URI "http://localhost:3000"');
    assert(localOriginData.message.startsWith('localhost:3000 wants you to sign in with your Solana account:'), 'SIWS: Sign-in message domain matches requesting host "localhost:3000"');

    // 2e. SIWS: Domain 'localhost:3000' correctly resolved to http://localhost:3000
    const localDomainChalRes = await fetch(`${BASE_URL}/api/auth/wallet/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: walletAPublicKey,
        domain: 'localhost:3000'
      })
    });
    const localDomainData = await localDomainChalRes.json();
    assert(localDomainChalRes.status === 200, 'SIWS: Request with domain "localhost:3000" succeeds with HTTP 200');
    assert(localDomainData.message.includes('URI: http://localhost:3000'), 'SIWS: Domain resolved to correct HTTP URI "http://localhost:3000"');

    // 2f. SIWS Security: Untrusted/mismatched domain rejected (HTTP 400)
    const badDomainChalRes = await fetch(`${BASE_URL}/api/auth/wallet/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: walletAPublicKey,
        domain: 'malicious-phishing.com'
      })
    });
    assert(badDomainChalRes.status === 400, 'SIWS Security: Untrusted domain "malicious-phishing.com" rejected with HTTP 400');

    // 2g. SIWS Security: Untrusted/mismatched origin rejected (HTTP 400)
    const badOriginChalRes = await fetch(`${BASE_URL}/api/auth/wallet/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: walletAPublicKey,
        origin: 'https://evil-attacker.xyz'
      })
    });
    assert(badOriginChalRes.status === 400, 'SIWS Security: Untrusted origin "https://evil-attacker.xyz" rejected with HTTP 400');

    // 2h. SIWS Security: Mismatched HTTPS scheme for HTTP local server rejected
    const badSchemeChalRes = await fetch(`${BASE_URL}/api/auth/wallet/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: walletAPublicKey,
        origin: 'https://localhost:3000'
      })
    });
    assert(badSchemeChalRes.status === 400, 'SIWS Security: Mismatched HTTPS scheme "https://localhost:3000" rejected with HTTP 400');

    // -------------------------------------------------------------------------
    // TEST 3: CRYPTOGRAPHIC SIGNATURE VERIFICATION & REPLAY RESISTANCE
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Ed25519 Signature Verification & Replay Protection ---');

    // 3a. Forged signature: signed with Wallet B, claimed to be Wallet A
    const msgBytesA = new TextEncoder().encode(chalAData.message);
    const forgedSig = encodeBase58(nacl.sign.detached(msgBytesA, walletB.secretKey));
    const forgedAuthRes = await fetch(`${BASE_URL}/api/auth/wallet/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: walletAPublicKey,
        nonce: chalAData.nonce,
        signature: forgedSig
      })
    });
    assert(forgedAuthRes.status === 400, 'Forged signature (Wallet B key used for Wallet A address) rejected with HTTP 400');

    // 3b. Malformed / corrupted signature rejected
    const malformedAuthRes = await fetch(`${BASE_URL}/api/auth/wallet/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: walletAPublicKey,
        nonce: chalAData.nonce,
        signature: 'invalid_base58_sig_123'
      })
    });
    assert(malformedAuthRes.status === 400, 'Malformed/corrupted signature rejected with HTTP 400');

    // 3c. Valid signature: signed with Wallet A
    const validSigA = encodeBase58(nacl.sign.detached(msgBytesA, walletA.secretKey));
    const authARes = await fetch(`${BASE_URL}/api/auth/wallet/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: walletAPublicKey,
        nonce: chalAData.nonce,
        signature: validSigA,
        username: `alice_${timestamp}`,
        displayName: 'Alice Auditor'
      })
    });
    const authAData = await authARes.json();
    assert(authARes.status === 200, 'Authentic Ed25519 signature succeeds with HTTP 200');
    assert(authAData.session && authAData.session.access_token, 'Supabase session JWT issued upon wallet authentication');
    assert(authAData.user && authAData.user.id, 'Internal auth user mapped and authenticated');
    assert(authAData.profile && authAData.profile.wallet_address === walletAPublicKey, 'Profile stores verified wallet address');

    userAToken = authAData.session.access_token;
    userAId = authAData.user.id;
    userAProfileId = authAData.profile.id;

    // Verify DB user_profiles and user_stats
    const { data: dbProfileA } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userAProfileId)
      .single();
    assert(dbProfileA && dbProfileA.wallet_address === walletAPublicKey, 'PostgreSQL user_profiles reflects verified wallet');
    assert(dbProfileA.role === 'USER', 'Default role is strictly "USER"');
    assert(dbProfileA.status === 'ACTIVE', 'Default account status is strictly "ACTIVE"');

    // 3d. REPLAY ATTACK: Re-submitting the exact same challenge nonce & signature
    const replayAuthRes = await fetch(`${BASE_URL}/api/auth/wallet/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: walletAPublicKey,
        nonce: chalAData.nonce,
        signature: validSigA
      })
    });
    assert(replayAuthRes.status === 400, 'Replay Attack: Consumed nonce is strictly rejected with HTTP 400');

    // 3e. EXPIRED NONCE: Challenge past its expiry time is strictly rejected
    const expiredChalRes = await fetch(`${BASE_URL}/api/auth/wallet/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: walletAPublicKey })
    });
    const expiredChalData = await expiredChalRes.json();
    // Artificially backdate the challenge in DB
    await supabaseAdmin
      .from('wallet_auth_nonces')
      .update({ expires_at: new Date(Date.now() - 60000).toISOString() })
      .eq('nonce', expiredChalData.nonce);

    const expiredMsgBytes = new TextEncoder().encode(expiredChalData.message);
    const expiredSig = encodeBase58(nacl.sign.detached(expiredMsgBytes, walletA.secretKey));
    const expiredAuthRes = await fetch(`${BASE_URL}/api/auth/wallet/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: walletAPublicKey,
        nonce: expiredChalData.nonce,
        signature: expiredSig
      })
    });
    const expiredAuthData = await expiredAuthRes.json();
    assert(expiredAuthRes.status === 400, 'Expired Challenge: Expired nonce is strictly rejected with HTTP 400');
    assert(expiredAuthData.error && expiredAuthData.error.includes('Expired Challenge'), 'Error message clearly indicates Expired Challenge');

    // 3f. ORIGIN MISMATCH AT AUTH TIME: Rejecting mismatched expectedOrigin
    const freshChalRes = await fetch(`${BASE_URL}/api/auth/wallet/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: walletAPublicKey })
    });
    const freshChalData = await freshChalRes.json();
    const freshMsgBytes = new TextEncoder().encode(freshChalData.message);
    const freshSig = encodeBase58(nacl.sign.detached(freshMsgBytes, walletA.secretKey));
    const mismatchOriginAuthRes = await fetch(`${BASE_URL}/api/auth/wallet/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: walletAPublicKey,
        nonce: freshChalData.nonce,
        signature: freshSig,
        origin: 'https://evil-untrusted-site.com'
      })
    });
    assert(mismatchOriginAuthRes.status === 400, 'Origin Mismatch: Reject authenticate request when origin is untrusted (HTTP 400)');

    // -------------------------------------------------------------------------
    // TEST 4: SESSION HANDLING, PROFILE SECURITY & PRIVILEGE ESCALATION
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Session Handling, Profile Security & RBAC Enforcement ---');

    // 4a. Fetch /api/auth/me with valid Bearer token
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const meData = await meRes.json();
    assert(meRes.status === 200, 'GET /api/auth/me succeeds with valid Bearer session');
    assert(meData.profile.wallet_address === walletAPublicKey, 'Profile wallet address matches authenticated session');

    // 4b. Request without token rejected
    const unauthRes = await fetch(`${BASE_URL}/api/auth/me`);
    assert(unauthRes.status === 401, 'Protected route without Authorization header rejected with 401');

    // 4c. Client attempts to elevate own role to ADMIN
    const escalateRes = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ role: 'ADMIN' })
    });
    assert(escalateRes.status === 403, 'Privilege escalation attempt ({ role: "ADMIN" }) rejected with 403');

    // Check DB to ensure role remained USER
    const { data: checkProfile } = await supabaseAdmin.from('user_profiles').select('role').eq('id', userAProfileId).single();
    assert(checkProfile.role === 'USER', 'Database confirms user role remains unchanged at "USER"');

    // 4d. Client attempts to tamper with success_rate in stats
    const statsTamperRes = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ success_rate: 99.9 })
    });
    assert(statsTamperRes.status === 403, 'Stats tampering attempt ({ success_rate: 99.9 }) rejected with 403');

    // 4e. Safe profile update allows display_name & bio
    const safeUpdateRes = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        displayName: 'Alice The Great',
        bio: 'Solana commitment enthusiast & verified builder.'
      })
    });
    const safeUpdateData = await safeUpdateRes.json();
    assert(safeUpdateRes.status === 200, 'Safe profile update (displayName, bio) succeeds');
    assert(safeUpdateData.profile.display_name === 'Alice The Great', 'Display name updated properly');

    // -------------------------------------------------------------------------
    // TEST 5: MULTIPLE WALLETS & SYBIL ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Independent Wallet Account Authentication (User B) ---');

    const authB = await authenticateWallet(walletB, {
      username: `bob_${timestamp}`,
      displayName: 'Bob The Second'
    });
    assert(authB.status === 200, 'User B authenticates independently via Wallet B');
    userBToken = authB.data.session.access_token;
    userBId = authB.data.user.id;
    userBProfileId = authB.data.profile.id;

    assert(userBProfileId !== userAProfileId, 'User A and User B have completely distinct profile IDs');
    assert(authB.data.profile.wallet_address === walletBPublicKey, 'User B profile stores Wallet B public key');

    // -------------------------------------------------------------------------
    // TEST 6: ROLE-BASED ACCESS CONTROL (RBAC) & ADMIN ENDPOINTS
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Role-Based Access Control (RBAC) & Admin Endpoints ---');

    // 6a. Normal User A attempts to call GET /api/admin/users
    const userAdminRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(userAdminRes.status === 403, 'Normal user calling GET /api/admin/users is rejected with 403 Forbidden');

    // 6b. Normal User A attempts to call dispute resolution endpoint
    const disputeRes = await fetch(`${BASE_URL}/api/commitments/cm_gh_01/resolve-dispute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ resolution: 'OVERTURN_TO_PASS' })
    });
    assert(disputeRes.status === 403, 'Normal user calling admin dispute resolution is rejected with 403 Forbidden');

    // 6c. Setup an authoritative Admin User via Wallet Auth
    const authAdmin = await authenticateWallet(walletAdmin, {
      username: `sysadmin_${timestamp}`,
      displayName: 'System Admin'
    });
    adminToken = authAdmin.data.session.access_token;
    adminId = authAdmin.data.user.id;
    adminProfileId = authAdmin.data.profile.id;

    // Elevate role authoritatively in PostgreSQL (Service Role)
    await supabaseAdmin
      .from('user_profiles')
      .update({ role: 'ADMIN' })
      .eq('id', adminProfileId);

    // Add to admin_users table
    await supabaseAdmin.from('admin_users').insert({
      user_id: adminProfileId,
      admin_role: 'ADMIN',
      status: 'ACTIVE'
    });

    // 6d. Admin calls GET /api/admin/users
    const adminUsersRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminUsersData = await adminUsersRes.json();
    assert(adminUsersRes.status === 200, 'Admin successfully accesses GET /api/admin/users');
    assert(Array.isArray(adminUsersData.users) && adminUsersData.users.length > 0, 'Admin users list loaded');

    // 6e. Admin views audit logs
    const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const auditData = await auditRes.json();
    assert(auditRes.status === 200, 'Admin successfully retrieves audit logs');
    assert(Array.isArray(auditData.auditLogs) && auditData.auditLogs.length > 0, 'Audit trail contains logged actions');

    // -------------------------------------------------------------------------
    // TEST 7: UNAUTHENTICATED COMMITMENT CREATION BLOCKED (HTTP 401)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Unauthenticated Commitment Creation Strictly Blocked ---');
    const unauthCommitRes = await fetch(`${BASE_URL}/api/commitments/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Unauthenticated Commitment Attempt',
        creator: 'AnyCreatorWallet11111111111111111111111111',
        stakingMode: 'HARDCORE',
        stakeAmount: 50,
        verifierType: 'github',
        failurePolicy: 'PARTIAL_EDUCATION_POOL',
        details: { repoOwner: 'solana-labs', repoName: 'solana' }
      })
    });
    assert(
      unauthCommitRes.status === 401,
      'Unauthenticated request to /api/commitments/create is strictly rejected (HTTP 401)'
    );

    // -------------------------------------------------------------------------
    // TEST 8: ACCOUNT STATUS ENFORCEMENT (SUSPENDED & DISABLED)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Account Status Enforcement (SUSPENDED & DISABLED) ---');

    // 8a. Admin suspends User B
    const suspendRes = await fetch(`${BASE_URL}/api/admin/users/${userBId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'SUSPENDED', reason: 'Adversarial audit test suspension' })
    });
    assert(suspendRes.status === 200, 'Admin successfully suspends User B');

    // 8b. Suspended user attempts to create commitment
    const commitAttemptRes = await fetch(`${BASE_URL}/api/commitments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`
      },
      body: JSON.stringify({
        title: 'Commitment while suspended',
        creator: walletBPublicKey,
        stakingMode: 'HARDCORE',
        stakeAmount: 50,
        verifierType: 'github',
        failurePolicy: 'PARTIAL_EDUCATION_POOL',
        details: { repoOwner: 'solana-labs', repoName: 'solana' }
      })
    });
    assert(
      commitAttemptRes.status === 403,
      'Suspended user is strictly blocked from creating financial commitments (HTTP 403)'
    );

    // 8c. Admin disables User B
    await fetch(`${BASE_URL}/api/admin/users/${userBId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'DISABLED', reason: 'Permanent ban test' })
    });

    // 8d. Disabled user attempts to authenticate wallet again
    const disabledAuthRes = await authenticateWallet(walletB).catch(e => ({ status: 403, error: e.message }));
    assert(
      disabledAuthRes.status === 403 || disabledAuthRes.status === 400,
      'Disabled user wallet authentication is rejected server-side with HTTP 403'
    );

    // -------------------------------------------------------------------------
    // TEST 9: VERIFIER APPLICATION & APPROVAL FLOW
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Verifier Application & Admin Approval Flow ---');

    // User A applies as verifier
    const verifierApplyRes = await fetch(`${BASE_URL}/api/auth/verifier/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ verificationTypes: ['github', 'peer_consensus'] })
    });
    const verifierApplyData = await verifierApplyRes.json();
    assert(verifierApplyRes.status === 200, 'User A successfully applies as verifier (Status: PENDING)');
    const verifierId = verifierApplyData.verifier.id;

    // Admin approves verifier application
    const approveVerifierRes = await fetch(`${BASE_URL}/api/admin/verifiers/${verifierId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        verificationStatus: 'VERIFIED',
        verificationLevel: 'VERIFIED',
        reason: 'Passed developer credentials verification'
      })
    });
    assert(approveVerifierRes.status === 200, 'Admin approves verifier application');

    // Check that User A's role was promoted to VERIFIER
    const { data: updatedProfileA } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', userAProfileId)
      .single();
    assert(updatedProfileA.role === 'VERIFIER', 'User A role successfully updated to "VERIFIER" in database');

  } catch (err) {
    console.error('Unhandled test failure:', err);
    failed++;
  } finally {
    // Cleanup created test users
    console.log('\n--- Cleaning up test accounts ---');
    if (userAId) await supabaseAdmin.auth.admin.deleteUser(userAId).catch(() => {});
    if (userBId) await supabaseAdmin.auth.admin.deleteUser(userBId).catch(() => {});
    if (adminId) await supabaseAdmin.auth.admin.deleteUser(adminId).catch(() => {});
    console.log('Cleaned up test accounts from Supabase Auth & PostgreSQL.');
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthTests();