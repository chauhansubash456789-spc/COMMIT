import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { supabaseAdmin, createUserClient } from '../server/auth/supabase.js';

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

async function runAuthTests() {
  console.log('\n================================================================');
  console.log('🔒 COMMIT PROTOCOL — MASTER AUTH & BACKEND TEST SUITE');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const testUserAEmail = `auditor_a_${timestamp}@example.com`;
  const testUserBEmail = `auditor_b_${timestamp}@example.com`;
  const testAdminEmail = `auditor_admin_${timestamp}@example.com`;
  const defaultPassword = 'Password123!Secure';

  let userAToken = null;
  let userAId = null;
  let userAProfileId = null;

  let userBToken = null;
  let userBId = null;

  let adminToken = null;
  let adminId = null;
  let adminProfileId = null;

  // Keypairs for wallet signing
  const walletA = nacl.sign.keyPair();
  const walletAPublicKey = encodeBase58(walletA.publicKey);

  const walletB = nacl.sign.keyPair();
  const walletBPublicKey = encodeBase58(walletB.publicKey);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: SIGNUP VALIDATION & ACCOUNT CREATION
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: User Signup & Input Validation ---');

    // 1a. Weak password rejection
    const weakRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `weak_${timestamp}@example.com`,
        password: 'short',
        username: `weak_${timestamp}`,
        displayName: 'Weak User'
      })
    });
    assert(weakRes.status === 400, 'Weak password (<8 chars) is rejected');

    // 1b. Reserved username rejection
    const reservedRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `admin_impersonator_${timestamp}@example.com`,
        password: defaultPassword,
        username: 'admin',
        displayName: 'Fake Admin'
      })
    });
    assert(reservedRes.status === 400, 'Reserved username "admin" is rejected');

    // 1c. Valid Signup for User A
    const signupARes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUserAEmail,
        password: defaultPassword,
        confirmPassword: defaultPassword,
        username: `alice_${timestamp}`,
        displayName: 'Alice Auditor'
      })
    });
    const signupAData = await signupARes.json();
    assert(signupARes.status === 201, 'User A signup succeeds with status 201');
    assert(signupAData.user && signupAData.user.id, 'User A received valid user ID');
    userAId = signupAData.user.id;

    // Confirm email automatically for testing
    await supabaseAdmin.auth.admin.updateUserById(userAId, { email_confirm: true });

    // 1d. Duplicate Email rejection
    const dupEmailRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUserAEmail,
        password: defaultPassword,
        username: `different_${timestamp}`,
        displayName: 'Duplicate Email User'
      })
    });
    assert(dupEmailRes.status >= 400, 'Duplicate email registration is rejected');

    // 1e. Duplicate Username rejection
    const dupUserRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `another_${timestamp}@example.com`,
        password: defaultPassword,
        username: `alice_${timestamp}`,
        displayName: 'Duplicate Username User'
      })
    });
    assert(dupUserRes.status === 409, 'Duplicate username is rejected with HTTP 409 Conflict');

    // 1f. Verify automatic creation of public.user_profiles and user_stats
    const { data: profileA } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', userAId)
      .single();
    assert(profileA && profileA.username === `alice_${timestamp}`, 'user_profiles row automatically created with correct username');
    assert(profileA.role === 'USER', 'Default role is strictly "USER"');
    assert(profileA.status === 'ACTIVE', 'Default account status is strictly "ACTIVE"');
    userAProfileId = profileA.id;

    const { data: statsA } = await supabaseAdmin
      .from('user_stats')
      .select('*')
      .eq('user_id', userAProfileId)
      .single();
    assert(statsA && statsA.total_commitments === 0, 'user_stats row automatically created with 0 commitments');

    // -------------------------------------------------------------------------
    // TEST 2: LOGIN & SESSION HANDLING
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Login, Session Handling & Logout ---');

    // 2a. Wrong password rejection
    const wrongPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserAEmail, password: 'WrongPassword999!' })
    });
    assert(wrongPassRes.status === 401, 'Login with incorrect password rejected with 401');

    // 2b. Successful login
    const loginARes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserAEmail, password: defaultPassword })
    });
    const loginAData = await loginARes.json();
    assert(loginARes.status === 200, 'Login with correct credentials succeeds');
    assert(loginAData.session && loginAData.session.access_token, 'Session JWT token issued');
    userAToken = loginAData.session.access_token;

    // 2c. Fetch /api/auth/me with valid Bearer token
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const meData = await meRes.json();
    assert(meRes.status === 200, 'GET /api/auth/me succeeds with valid Bearer session');
    assert(meData.profile.username === `alice_${timestamp}`, 'Profile data matches authenticated session');

    // 2d. Request without token rejected
    const unauthRes = await fetch(`${BASE_URL}/api/auth/me`);
    assert(unauthRes.status === 401, 'Protected route without Authorization header rejected with 401');

    // -------------------------------------------------------------------------
    // TEST 3: PRIVILEGE ESCALATION ATTACKS (CRITICAL AUDIT)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Privilege Escalation & Stats Tampering Attacks ---');

    // 3a. Client attempts to elevate own role to ADMIN
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
    const { data: checkProfile } = await supabaseAdmin.from('user_profiles').select('role').eq('auth_user_id', userAId).single();
    assert(checkProfile.role === 'USER', 'Database confirms user role remains unchanged at "USER"');

    // 3b. Client attempts to tamper with success_rate in stats
    const statsTamperRes = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ success_rate: 99.9 })
    });
    assert(statsTamperRes.status === 403, 'Stats tampering attempt ({ success_rate: 99.9 }) rejected with 403');

    // 3c. Safe profile update allows display_name & bio
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
    // TEST 4: FORGOT PASSWORD & PRIVACY
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Forgot Password & Account Privacy ---');

    // 4a. Request password reset for existing email
    const resetExistRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserAEmail })
    });
    const resetExistData = await resetExistRes.json();
    assert(resetExistRes.status === 200, 'Password reset request succeeds');

    // 4b. Request password reset for NON-EXISTENT email
    const resetNonExistRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `nonexistent_${timestamp}@example.com` })
    });
    const resetNonExistData = await resetNonExistRes.json();
    assert(resetNonExistRes.status === 200, 'Non-existent email also returns HTTP 200');
    assert(
      resetExistData.message === resetNonExistData.message,
      'Email enumeration prevented: Generic identical response returned regardless of email existence'
    );

    // -------------------------------------------------------------------------
    // TEST 5: SOLANA WALLET NONCE & ED25519 SIGNATURE VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Solana Wallet Cryptographic Verification ---');

    // 5a. Request wallet challenge nonce
    const nonceRes = await fetch(`${BASE_URL}/api/auth/wallet/nonce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ walletAddress: walletAPublicKey })
    });
    const nonceData = await nonceRes.json();
    assert(nonceRes.status === 200, 'Wallet challenge nonce requested successfully');
    assert(nonceData.nonce && nonceData.nonce.length === 64, 'Generated random 32-byte hex nonce');
    assert(nonceData.message.includes('Commit Wallet Verification'), 'Canonical challenge message contains protocol header');
    assert(nonceData.message.includes(walletAPublicKey), 'Challenge contains target wallet public key');

    // 5b. Sign challenge message using Phantom/ed25519 keypair
    const messageBytes = new TextEncoder().encode(nonceData.message);
    const signatureBytes = nacl.sign.detached(messageBytes, walletA.secretKey);
    const signatureBase58 = encodeBase58(signatureBytes);

    // 5c. Submit signature to verify and associate wallet
    const verifyRes = await fetch(`${BASE_URL}/api/auth/wallet/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        walletAddress: walletAPublicKey,
        nonce: nonceData.nonce,
        signature: signatureBase58
      })
    });
    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200 && verifyData.success, 'Wallet signature verified and associated successfully');

    // Verify wallet in user profile DB
    const { data: profileWithWallet } = await supabaseAdmin
      .from('user_profiles')
      .select('wallet_address')
      .eq('auth_user_id', userAId)
      .single();
    assert(profileWithWallet.wallet_address === walletAPublicKey, 'User profile accurately reflects verified wallet address');

    // 5d. REPLAY ATTACK: Attempt to reuse the same nonce again
    const replayRes = await fetch(`${BASE_URL}/api/auth/wallet/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        walletAddress: walletAPublicKey,
        nonce: nonceData.nonce,
        signature: signatureBase58
      })
    });
    assert(replayRes.status === 400, 'Replay Attack: Reusing consumed nonce is strictly rejected with HTTP 400');

    // 5e. WRONG WALLET SIGNATURE ATTACK: Sign with Wallet B, claim to be Wallet A
    const nonceRes2 = await fetch(`${BASE_URL}/api/auth/wallet/nonce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ walletAddress: walletAPublicKey })
    });
    const nonceData2 = await nonceRes2.json();
    const wrongSigBytes = nacl.sign.detached(new TextEncoder().encode(nonceData2.message), walletB.secretKey);
    const wrongSigBase58 = encodeBase58(wrongSigBytes);

    const wrongSigRes = await fetch(`${BASE_URL}/api/auth/wallet/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        walletAddress: walletAPublicKey,
        nonce: nonceData2.nonce,
        signature: wrongSigBase58
      })
    });
    assert(wrongSigRes.status === 400, 'Forged/Wrong wallet signature is strictly rejected');

    // -------------------------------------------------------------------------
    // TEST 6: WALLET UNIQUENESS & SYBIL ATTACHMENT
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Wallet Uniqueness (One Wallet = One Account) ---');

    // Create User B
    const signupBRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUserBEmail,
        password: defaultPassword,
        username: `bob_${timestamp}`,
        displayName: 'Bob The Second'
      })
    });
    const signupBData = await signupBRes.json();
    userBId = signupBData.user.id;
    await supabaseAdmin.auth.admin.updateUserById(userBId, { email_confirm: true });

    const loginBRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserBEmail, password: defaultPassword })
    });
    const loginBData = await loginBRes.json();
    userBToken = loginBData.session.access_token;

    // User B tries to link User A's already linked wallet (walletAPublicKey)
    const nonceBRes = await fetch(`${BASE_URL}/api/auth/wallet/nonce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`
      },
      body: JSON.stringify({ walletAddress: walletAPublicKey })
    });
    const nonceBData = await nonceBRes.json();
    const sigBBytes = nacl.sign.detached(new TextEncoder().encode(nonceBData.message), walletA.secretKey);

    const duplicateWalletRes = await fetch(`${BASE_URL}/api/auth/wallet/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`
      },
      body: JSON.stringify({
        walletAddress: walletAPublicKey,
        nonce: nonceBData.nonce,
        signature: encodeBase58(sigBBytes)
      })
    });
    assert(
      duplicateWalletRes.status === 400,
      'Duplicate wallet assignment rejected: One wallet cannot be bound to two accounts'
    );

    // -------------------------------------------------------------------------
    // TEST 7: ROLE-BASED ACCESS CONTROL (RBAC) & ADMIN ENDPOINTS
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Role-Based Access Control (RBAC) & Admin Endpoints ---');

    // 7a. Normal User A attempts to call GET /api/admin/users
    const userAdminRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(userAdminRes.status === 403, 'Normal user calling GET /api/admin/users is rejected with 403 Forbidden');

    // 7b. Normal User A attempts to call dispute resolution endpoint
    const disputeRes = await fetch(`${BASE_URL}/api/commitments/cm_gh_01/resolve-dispute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ resolution: 'OVERTURN_TO_PASS' })
    });
    assert(disputeRes.status === 403, 'Normal user calling admin dispute resolution is rejected with 403 Forbidden');

    // 7c. Setup an authoritative Admin User
    const signupAdminRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testAdminEmail,
        password: defaultPassword,
        username: `sysadmin_${timestamp}`,
        displayName: 'System Admin'
      })
    });
    const signupAdminData = await signupAdminRes.json();
    adminId = signupAdminData.user.id;
    await supabaseAdmin.auth.admin.updateUserById(adminId, { email_confirm: true });

    // Elevate role authoritatively in PostgreSQL (Service Role)
    const { data: adminProfile } = await supabaseAdmin
      .from('user_profiles')
      .update({ role: 'ADMIN' })
      .eq('auth_user_id', adminId)
      .select()
      .single();
    adminProfileId = adminProfile.id;

    // Add to admin_users table
    await supabaseAdmin.from('admin_users').insert({
      user_id: adminProfileId,
      admin_role: 'ADMIN',
      status: 'ACTIVE'
    });

    // Login as Admin
    const loginAdminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testAdminEmail, password: defaultPassword })
    });
    const loginAdminData = await loginAdminRes.json();
    adminToken = loginAdminData.session.access_token;
    assert(loginAdminData.isAdmin === true, 'Admin login response identifies user as authorized admin');

    // 7d. Admin calls GET /api/admin/users
    const adminUsersRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminUsersData = await adminUsersRes.json();
    assert(adminUsersRes.status === 200, 'Admin successfully accesses GET /api/admin/users');
    assert(Array.isArray(adminUsersData.users) && adminUsersData.users.length > 0, 'Admin users list loaded');

    // 7e. Admin views audit logs
    const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const auditData = await auditRes.json();
    assert(auditRes.status === 200, 'Admin successfully retrieves audit logs');
    assert(Array.isArray(auditData.auditLogs) && auditData.auditLogs.length > 0, 'Audit trail contains logged actions');

    // -------------------------------------------------------------------------
    // TEST 8: ACCOUNT STATUS ENFORCEMENT (SUSPENDED & DISABLED)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Account Status Enforcement (SUSPENDED & DISABLED) ---');

    // 8a. Admin suspends User B
    const suspendRes = await fetch(`${BASE_URL}/api/admin/users/${signupBData.user.id}/status`, {
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
        creator: 'AnyCreatorWallet11111111111111111111111111',
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
    await fetch(`${BASE_URL}/api/admin/users/${signupBData.user.id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'DISABLED', reason: 'Permanent ban test' })
    });

    // 8d. Disabled user attempts to login
    const disabledLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserBEmail, password: defaultPassword })
    });
    assert(
      disabledLoginRes.status === 403,
      'Disabled user login attempt is rejected server-side with HTTP 403'
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
      .eq('auth_user_id', userAId)
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