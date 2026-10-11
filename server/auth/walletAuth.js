import crypto from 'crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { supabaseAdmin, supabaseAnon } from './supabase.js';
import { logAudit } from './middleware.js';

// Safe Base58 decoder supporting varied module exports
function decodeBase58(str) {
  if (typeof bs58.decode === 'function') return bs58.decode(str);
  if (bs58.default && typeof bs58.default.decode === 'function') return bs58.default.decode(str);
  throw new Error('Base58 decoding unavailable');
}

// In-memory rate limiting for nonce generation: max 10 requests per minute per user
const nonceRateLimits = new Map();

/**
 * Validates Solana public key address string
 */
export function isValidSolanaAddress(address) {
  try {
    if (typeof address !== 'string' || address.length < 32 || address.length > 44) {
      return false;
    }
    const decoded = decodeBase58(address);
    return decoded.length === 32;
  } catch (err) {
    return false;
  }
}

/**
 * Generates an authoritative, anti-replay cryptographic wallet nonce challenge
 */
export async function generateWalletChallenge(userId, walletAddress, ipAddress = null) {
  if (!isValidSolanaAddress(walletAddress)) {
    throw new Error('Invalid Solana wallet address format');
  }

  // Rate Limiting check
  const now = Date.now();
  const userRateKey = `${userId}:${walletAddress}`;
  const history = nonceRateLimits.get(userRateKey) || [];
  const recentHistory = history.filter(ts => now - ts < 60000);
  if (recentHistory.length >= 8) {
    throw new Error('Rate limit exceeded: Too many wallet challenge requests. Please wait 1 minute.');
  }
  recentHistory.push(now);
  nonceRateLimits.set(userRateKey, recentHistory);

  // Generate cryptographically secure random 32-byte hex nonce
  const nonce = crypto.randomBytes(32).toString('hex');
  const issuedAt = new Date().toISOString();
  // Strictly 5 minutes expiration
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  // Canonical structured challenge message
  const message = [
    'Commit Wallet Verification',
    '',
    'User:',
    userId,
    '',
    'Wallet:',
    walletAddress,
    '',
    'Nonce:',
    nonce,
    '',
    'Issued:',
    issuedAt,
    '',
    'Expires:',
    expiresAt,
    '',
    'Sign this message with your Solana wallet to verify ownership.'
  ].join('\n');

  // Store in wallet_auth_nonces
  const { data, error } = await supabaseAdmin
    .from('wallet_auth_nonces')
    .insert({
      user_id: userId,
      wallet_address: walletAddress,
      nonce,
      message,
      expires_at: expiresAt
    })
    .select('id, nonce, message, expires_at')
    .single();

  if (error) {
    throw new Error('Failed to record wallet verification challenge: ' + error.message);
  }

  return {
    challengeId: data.id,
    nonce: data.nonce,
    message: data.message,
    expiresAt: data.expires_at
  };
}

/**
 * Verifies signed wallet challenge and associates wallet with user profile
 */
export async function verifyWalletSignature({
  userId,
  walletAddress,
  nonce,
  signature,
  ipAddress = null
}) {
  if (!isValidSolanaAddress(walletAddress)) {
    throw new Error('Invalid Solana wallet address');
  }

  if (!nonce || !signature) {
    throw new Error('Nonce and signature are required');
  }

  // 1. Fetch challenge nonce record
  const { data: record, error: fetchErr } = await supabaseAdmin
    .from('wallet_auth_nonces')
    .select('*')
    .eq('user_id', userId)
    .eq('wallet_address', walletAddress)
    .eq('nonce', nonce)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchErr || !record) {
    throw new Error('Invalid or unissued challenge nonce for this user and wallet');
  }

  // 2. Anti-Replay Check: Was nonce already used?
  if (record.used_at !== null) {
    throw new Error('Replay Attack Rejected: Nonce has already been consumed and cannot be reused');
  }

  // 3. Expiration Check: Is nonce expired?
  if (new Date(record.expires_at) < new Date()) {
    throw new Error('Expired Challenge: Nonce has expired. Please request a new verification challenge');
  }

  // 4. Wallet Uniqueness Check: Prevent User A from stealing User B's already registered wallet
  const { data: existingOwners, error: ownerErr } = await supabaseAdmin
    .from('user_profiles')
    .select('auth_user_id')
    .eq('wallet_address', walletAddress);

  if (!ownerErr && existingOwners && existingOwners.length > 0) {
    const isOwnedByOther = existingOwners.some(p => p.auth_user_id !== userId);
    if (isOwnedByOther) {
      throw new Error('Wallet Uniqueness Violation: This wallet is already linked to another Commit account');
    }
  }

  // 5. Cryptographic Ed25519 Signature Verification
  let isValid = false;
  try {
    const messageBytes = new TextEncoder().encode(record.message);
    const signatureBytes = decodeBase58(signature);
    const publicKeyBytes = decodeBase58(walletAddress);

    if (signatureBytes.length !== 64) {
      throw new Error('Invalid signature byte length (expected 64 bytes for Ed25519)');
    }
    if (publicKeyBytes.length !== 32) {
      throw new Error('Invalid public key byte length (expected 32 bytes)');
    }

    isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (cryptoErr) {
    throw new Error('Cryptographic signature verification failed: ' + cryptoErr.message);
  }

  if (!isValid) {
    throw new Error('Invalid signature: Signature did not originate from the specified wallet keypair');
  }

  // 6. Invalidate nonce immediately (mark used_at)
  await supabaseAdmin
    .from('wallet_auth_nonces')
    .update({ used_at: new Date().toISOString() })
    .eq('id', record.id);

  // 7. Associate wallet with user profile authoritatively
  const { error: profileUpdateErr } = await supabaseAdmin
    .from('user_profiles')
    .update({
      wallet_address: walletAddress,
      updated_at: new Date().toISOString()
    })
    .eq('auth_user_id', userId);

  if (profileUpdateErr) {
    throw new Error('Failed to associate verified wallet with profile: ' + profileUpdateErr.message);
  }

  // 8. Audit Log
  await logAudit({
    actorUserId: userId,
    action: 'WALLET_CONNECTED',
    targetType: 'WALLET',
    targetId: walletAddress,
    metadata: {
      nonceId: record.id,
      verifiedAt: new Date().toISOString()
    },
    ipAddress
  });

  return {
    success: true,
    walletAddress,
    verifiedAt: new Date().toISOString()
  };
}

/**
 * Disconnects wallet from user profile
 */
export async function disconnectWallet(userId, ipAddress = null) {
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('wallet_address')
    .eq('auth_user_id', userId)
    .single();

  const prevWallet = profile?.wallet_address;

  await supabaseAdmin
    .from('user_profiles')
    .update({
      wallet_address: null,
      updated_at: new Date().toISOString()
    })
    .eq('auth_user_id', userId);

  await logAudit({
    actorUserId: userId,
    action: 'WALLET_DISCONNECTED',
    targetType: 'WALLET',
    targetId: prevWallet || 'NONE',
    metadata: { disconnectedAt: new Date().toISOString() },
    ipAddress
  });

  return { success: true };
}

/**
 * Configuration & Whitelist for Trusted Application Origins (SIWS compliance)
 */
export function getTrustedOrigins() {
  const port = process.env.PORT || 3000;
  const configuredAppUrl = process.env.APP_URL || process.env.APP_ORIGIN;

  const origins = [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://commit.fun',
    'http://localhost:5173'
  ];

  if (configuredAppUrl) {
    try {
      const u = new URL(configuredAppUrl);
      origins.push(u.origin);
    } catch {}
  }

  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach(item => {
      const trimmed = item.trim();
      if (trimmed) {
        try {
          const u = new URL(trimmed);
          origins.push(u.origin);
        } catch {
          origins.push(trimmed);
        }
      }
    });
  }

  return Array.from(new Set(origins));
}

/**
 * Resolves and validates requested origin/domain against trusted origins.
 * Generates authoritative domain and URI for SIWS message.
 */
export function resolveAndValidateOrigin(requestedOriginOrDomain) {
  const trustedOrigins = getTrustedOrigins();
  const defaultOrigin = process.env.APP_URL || process.env.APP_ORIGIN || `http://localhost:${process.env.PORT || 3000}`;

  if (!requestedOriginOrDomain) {
    const defaultUrl = new URL(defaultOrigin);
    return {
      origin: defaultUrl.origin,
      domain: defaultUrl.host
    };
  }

  const str = String(requestedOriginOrDomain).trim();

  // If full URI with protocol (e.g. "http://localhost:3000" or "https://commit.fun")
  if (str.startsWith('http://') || str.startsWith('https://')) {
    let parsedUrl;
    try {
      parsedUrl = new URL(str);
    } catch {
      throw new Error(`Invalid URI format: "${str}"`);
    }

    const isTrusted = trustedOrigins.some(to => {
      try {
        return new URL(to).origin.toLowerCase() === parsedUrl.origin.toLowerCase();
      } catch {
        return false;
      }
    });

    if (!isTrusted) {
      throw new Error(`Untrusted origin: "${parsedUrl.origin}". Origin does not match configured application origins.`);
    }

    return {
      origin: parsedUrl.origin,
      domain: parsedUrl.host
    };
  }

  // If host/domain without protocol (e.g. "localhost:3000" or "commit.fun")
  const matchedOrigin = trustedOrigins.find(to => {
    try {
      const u = new URL(to);
      return u.host.toLowerCase() === str.toLowerCase();
    } catch {
      return false;
    }
  });

  if (!matchedOrigin) {
    throw new Error(`Untrusted domain: "${str}". Domain does not match any configured trusted application origin.`);
  }

  const matchedUrl = new URL(matchedOrigin);
  return {
    origin: matchedUrl.origin,
    domain: matchedUrl.host
  };
}

/**
 * Generates an authoritative SIWS-compliant challenge for primary wallet authentication
 */
export async function generateWalletAuthChallenge(walletAddress, originOrDomain = null, ipAddress = null) {
  if (!isValidSolanaAddress(walletAddress)) {
    throw new Error('Invalid Solana wallet address format');
  }

  // Resolve and strictly validate application origin and domain
  const { origin: validUri, domain: validDomain } = resolveAndValidateOrigin(originOrDomain);

  // Rate Limiting check per wallet
  const now = Date.now();
  const rateKey = `auth:${walletAddress}`;
  const history = nonceRateLimits.get(rateKey) || [];
  const recentHistory = history.filter(ts => now - ts < 60000);
  if (recentHistory.length >= 12) {
    throw new Error('Rate limit exceeded: Too many wallet authentication attempts. Please wait 1 minute.');
  }
  recentHistory.push(now);
  nonceRateLimits.set(rateKey, recentHistory);

  // Generate cryptographically secure 32-byte hex nonce
  const nonce = crypto.randomBytes(32).toString('hex');
  const issuedAt = new Date().toISOString();
  // 5 minutes expiration
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  // Canonical SIWS structured message format
  const message = [
    `${validDomain} wants you to sign in with your Solana account:`,
    walletAddress,
    '',
    'Sign in with your Solana wallet to authenticate on Commit Protocol.',
    '',
    `URI: ${validUri}`,
    'Version: 1',
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expiresAt}`
  ].join('\n');

  // Insert challenge into wallet_auth_nonces table (user_id is null before login)
  const { data, error } = await supabaseAdmin
    .from('wallet_auth_nonces')
    .insert({
      wallet_address: walletAddress,
      nonce,
      message,
      expires_at: expiresAt
    })
    .select('id, nonce, message, expires_at')
    .single();

  if (error) {
    throw new Error('Failed to record wallet authentication challenge: ' + error.message);
  }

  return {
    challengeId: data.id,
    nonce: data.nonce,
    message: data.message,
    expiresAt: data.expires_at,
    domain: validDomain,
    uri: validUri
  };
}

/**
 * Authenticates a wallet signature as the PRIMARY authentication method
 * Produces a verified user session and profile
 */
export async function authenticateWalletSignature({
  walletAddress,
  nonce,
  signature,
  expectedOrigin = null,
  ipAddress = null
}) {
  if (!isValidSolanaAddress(walletAddress)) {
    throw new Error('Invalid Solana wallet address format');
  }

  if (!nonce || !signature) {
    throw new Error('Nonce and signature are required for wallet authentication');
  }

  // 1. Fetch challenge nonce record for this wallet
  const { data: record, error: fetchErr } = await supabaseAdmin
    .from('wallet_auth_nonces')
    .select('*')
    .eq('wallet_address', walletAddress)
    .eq('nonce', nonce)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchErr || !record) {
    throw new Error('Invalid or unissued challenge nonce for this wallet');
  }

  // 2. Anti-Replay Check: Was nonce already used?
  if (record.used_at !== null) {
    throw new Error('Replay Attack Rejected: Nonce has already been consumed and cannot be reused');
  }

  // 3. Expiration Check: Is nonce expired?
  if (new Date(record.expires_at) < new Date()) {
    throw new Error('Expired Challenge: Nonce has expired. Please request a new verification challenge');
  }

  // 4. Origin & Domain Verification: Verify challenge message URI belongs to a trusted origin
  const uriMatch = record.message.match(/^URI:\s*([^\s]+)/m);
  const domainMatch = record.message.match(/^([^\s]+) wants you to sign in/m);
  if (!uriMatch || !domainMatch) {
    throw new Error('Malformed challenge message: missing URI or domain in SIWS format');
  }
  const messageUri = uriMatch[1];

  // Ensure the URI in the challenge is still trusted by the server
  resolveAndValidateOrigin(messageUri);

  // If caller supplied expectedOrigin, ensure it matches the challenge URI
  if (expectedOrigin) {
    const validatedExpected = resolveAndValidateOrigin(expectedOrigin);
    if (validatedExpected.origin.toLowerCase() !== messageUri.toLowerCase()) {
      throw new Error(`Origin Mismatch: Challenge URI (${messageUri}) does not match expected origin (${validatedExpected.origin})`);
    }
  }

  // 5. Cryptographic Ed25519 Signature Verification
  let isValid = false;
  try {
    const messageBytes = new TextEncoder().encode(record.message);
    const signatureBytes = decodeBase58(signature);
    const publicKeyBytes = decodeBase58(walletAddress);

    if (signatureBytes.length !== 64) {
      throw new Error('Invalid signature byte length (expected 64 bytes for Ed25519)');
    }
    if (publicKeyBytes.length !== 32) {
      throw new Error('Invalid public key byte length (expected 32 bytes)');
    }

    isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (cryptoErr) {
    throw new Error('Cryptographic signature verification failed: ' + cryptoErr.message);
  }

  if (!isValid) {
    throw new Error('Invalid signature: Signature did not originate from the specified wallet keypair');
  }

  // 6. Invalidate nonce immediately (consume single-use challenge atomically)
  await supabaseAdmin
    .from('wallet_auth_nonces')
    .update({ used_at: new Date().toISOString() })
    .eq('id', record.id);

  // 6. Look up existing profile or provision new account
  const { data: existingProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('wallet_address', walletAddress)
    .maybeSingle();

  // Deterministic server-managed secret for this wallet's internal session account
  const secretKeySeed = process.env.SUPABASE_SERVICE_ROLE_KEY || 'commit_protocol_master_salt_2026';
  const internalPassword = crypto.createHmac('sha256', secretKeySeed)
    .update(walletAddress)
    .digest('hex') + '!W1#';
  const internalEmail = `${walletAddress.toLowerCase()}@wallet.commit.fun`;

  let authUserId = null;
  let userEmail = internalEmail;
  let isNewUser = false;
  let profile = null;

  if (existingProfile) {
    authUserId = existingProfile.auth_user_id;
    profile = existingProfile;

    // Check account status
    if (profile.status === 'DISABLED') {
      throw new Error('Account Disabled: Your account has been permanently disabled. Access denied.');
    }

    // Retrieve user record to get current email
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(authUserId);
    if (userData && userData.user && userData.user.email) {
      userEmail = userData.user.email;
    }

    // Ensure internal password is up to date for session issuance
    await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      password: internalPassword,
      email_confirm: true
    }).catch(() => {});
  } else {
    // First-time wallet user: create new Supabase Auth user & profile
    isNewUser = true;
    const shortAddress = walletAddress.slice(0, 4) + '...' + walletAddress.slice(-4);
    const cleanUsername = 'sol_' + walletAddress.slice(0, 4) + walletAddress.slice(-4) + '_' + Date.now().toString().slice(-4);
    const displayName = 'Solana ' + shortAddress;

    const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: internalPassword,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        username: cleanUsername,
        wallet_address: walletAddress,
        is_wallet_user: true
      }
    });

    if (createError) {
      throw new Error('Failed to create account for wallet: ' + createError.message);
    }

    authUserId = newUserData.user.id;
    userEmail = internalEmail;

    // Update the trigger-created user profile with verified wallet address
    const { data: updatedProfile, error: profileErr } = await supabaseAdmin
      .from('user_profiles')
      .update({
        wallet_address: walletAddress,
        display_name: displayName,
        updated_at: new Date().toISOString()
      })
      .eq('auth_user_id', authUserId)
      .select()
      .single();

    if (!profileErr && updatedProfile) {
      profile = updatedProfile;
    } else {
      const { data: fetchedProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', authUserId)
        .single();
      profile = fetchedProfile;
    }
  }

  // 7. Obtain Supabase session JWT
  const { data: sessionData, error: sessionErr } = await supabaseAnon.auth.signInWithPassword({
    email: userEmail,
    password: internalPassword
  });

  if (sessionErr || !sessionData?.session) {
    throw new Error('Failed to establish authenticated session: ' + (sessionErr?.message || 'Unknown error'));
  }

  // 8. Load user statistics
  const { data: stats } = await supabaseAdmin
    .from('user_stats')
    .select('*')
    .eq('user_id', profile.id)
    .maybeSingle();

  // 9. Check Admin privileges
  const { data: adminRecord } = await supabaseAdmin
    .from('admin_users')
    .select('admin_role, status')
    .eq('user_id', profile.id)
    .maybeSingle();

  const isAdmin = (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN') ||
    (adminRecord && adminRecord.status === 'ACTIVE');

  if (adminRecord && adminRecord.status === 'ACTIVE') {
    await supabaseAdmin
      .from('admin_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', adminRecord.id);
  }

  // 10. Write Audit Log
  await logAudit({
    actorUserId: authUserId,
    action: isNewUser ? 'WALLET_SIGNUP' : 'WALLET_LOGIN',
    targetType: 'WALLET',
    targetId: walletAddress,
    metadata: {
      nonceId: record.id,
      role: profile.role,
      status: profile.status,
      isNewUser
    },
    ipAddress
  });

  if (isNewUser) {
    await logAudit({
      actorUserId: authUserId,
      action: 'SIGNUP',
      targetType: 'USER',
      targetId: authUserId,
      metadata: { method: 'SOLANA_WALLET', walletAddress },
      ipAddress
    });
    await logAudit({
      actorUserId: authUserId,
      action: 'WALLET_CONNECTED',
      targetType: 'WALLET',
      targetId: walletAddress,
      metadata: { initial: true },
      ipAddress
    });
  }

  await logAudit({
    actorUserId: authUserId,
    action: 'LOGIN',
    targetType: 'SESSION',
    targetId: authUserId,
    metadata: { method: 'SOLANA_WALLET' },
    ipAddress
  });

  return {
    session: {
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_at: sessionData.session.expires_at
    },
    user: {
      id: authUserId,
      email: userEmail,
      walletAddress
    },
    profile,
    stats: stats || {},
    isAdmin,
    isNewUser
  };
}