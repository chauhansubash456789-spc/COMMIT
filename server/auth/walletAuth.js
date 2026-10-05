import crypto from 'crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { supabaseAdmin } from './supabase.js';
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