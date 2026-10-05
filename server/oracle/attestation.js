import crypto from 'crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

/**
 * COMMIT PROTOCOL ATTESTATION ORACLE
 * Manages Ed25519 signing keys, canonical payload serialization,
 * SHA-256 evidence hashing, and signature verification.
 */

// Generate or use a deterministic master Oracle keypair for signing
const SEED = crypto.createHash('sha256').update('COMMIT_ORACLE_DEVNET_MASTER_SEED_2026').digest();
const oracleKeypair = nacl.sign.keyPair.fromSeed(SEED);
export const ORACLE_PUBLIC_KEY = bs58.encode(oracleKeypair.publicKey);

/**
 * Computes deterministic SHA-256 hash of any evidence payload
 * @param {object|string} payload 
 * @returns {string} hex-encoded SHA-256 hash
 */
export function hashEvidence(payload) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return '0x' + crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Creates canonical string for signing:
 * commitment_id | wallet_address | verifier_type | result_code | verified_metric | required_metric | evidence_hash | timestamp
 */
export function buildCanonicalMessage(result) {
  return [
    result.commitmentId,
    result.walletAddress,
    result.verifierType,
    result.resultCode,
    result.verifiedMetric.toString(),
    result.requiredMetric.toString(),
    result.evidenceHash,
    result.verifiedAt
  ].join('|');
}

/**
 * Signs verification result with Oracle Ed25519 private key
 * @param {object} verificationData 
 * @returns {object} Full signed attestation object
 */
export function signVerificationResult(verificationData) {
  const evidenceHash = verificationData.evidenceHash || hashEvidence(verificationData.evidencePayload || {});
  
  const result = {
    commitmentId: verificationData.commitmentId,
    walletAddress: verificationData.walletAddress,
    verifierType: verificationData.verifierType,
    resultCode: verificationData.resultCode,
    isSuccessful: verificationData.isSuccessful,
    verifiedMetric: verificationData.verifiedMetric,
    requiredMetric: verificationData.requiredMetric,
    evidenceHash: evidenceHash,
    evidencePayload: verificationData.evidencePayload || null,
    verifierVersion: verificationData.verifierVersion || 'v1.0.0',
    verifiedAt: verificationData.verifiedAt || new Date().toISOString(),
    oraclePublicKey: ORACLE_PUBLIC_KEY,
  };

  const canonicalMessage = buildCanonicalMessage(result);
  const messageBytes = Buffer.from(canonicalMessage, 'utf-8');
  const signatureBytes = nacl.sign.detached(messageBytes, oracleKeypair.secretKey);
  const signatureBase58 = bs58.encode(signatureBytes);

  return {
    ...result,
    canonicalMessage,
    signature: signatureBase58
  };
}

/**
 * Cryptographically verifies an attestation signature
 * @param {object} attestation 
 * @returns {boolean} true if valid Ed25519 signature
 */
export function verifyAttestationSignature(attestation) {
  try {
    const canonicalMessage = buildCanonicalMessage(attestation);
    const messageBytes = Buffer.from(canonicalMessage, 'utf-8');
    const signatureBytes = bs58.decode(attestation.signature);
    const publicKeyBytes = bs58.decode(attestation.oraclePublicKey);

    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}
