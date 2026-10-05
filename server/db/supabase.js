import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gkfuywaflismvlggypkp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Checks if Supabase database tables are initialized
 */
export async function isDatabaseReady() {
  try {
    const { error } = await supabase.from('commitments').select('id').limit(1);
    if (error && error.code === 'PGRST205') { // Table not found
      return false;
    }
    return !error;
  } catch (err) {
    return false;
  }
}

/**
 * Fetch all commitments from Supabase
 */
export async function dbGetCommitments() {
  try {
    const { data, error } = await supabase
      .from('commitments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(formatFromDb);
  } catch (err) {
    console.warn('[Supabase] Falling back to local store:', err.message);
    return null;
  }
}

/**
 * Upsert commitment in Supabase
 */
export async function dbSaveCommitment(commitment) {
  try {
    const payload = formatForDb(commitment);
    const { data, error } = await supabase
      .from('commitments')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return formatFromDb(data);
  } catch (err) {
    console.warn('[Supabase] Upsert failed, saving in memory:', err.message);
    return commitment;
  }
}

/**
 * Formats camelCase commitment object to database snake_case columns
 */
function formatForDb(c) {
  return {
    id: c.id,
    title: c.title,
    creator: c.creator,
    staking_mode: c.stakingMode,
    stake_amount: c.stakeAmount,
    penalty_amount: c.penaltyAmount,
    verification_fee: c.verificationFee,
    verifier_type: c.verifierType,
    failure_policy: c.failurePolicy,
    failure_policy_text: c.failurePolicyText,
    status: c.status,
    escrow_pda: c.escrowPda || null,
    details: c.details || {},
    attestation: c.attestation || null,
    settlement: c.settlement || null,
    updated_at: new Date().toISOString()
  };
}

/**
 * Formats snake_case database row back to frontend camelCase
 */
function formatFromDb(row) {
  return {
    id: row.id,
    title: row.title,
    creator: row.creator,
    stakingMode: row.staking_mode,
    stakeAmount: Number(row.stake_amount),
    penaltyAmount: Number(row.penalty_amount),
    verificationFee: Number(row.verification_fee),
    verifierType: row.verifier_type,
    failurePolicy: row.failure_policy,
    failurePolicyText: row.failure_policy_text,
    status: row.status,
    escrowPda: row.escrow_pda,
    details: row.details || {},
    attestation: row.attestation,
    settlement: row.settlement,
    createdAt: row.created_at,
    expiresAt: row.expires_at || new Date(Date.now() + 7 * 86400000).toISOString()
  };
}
