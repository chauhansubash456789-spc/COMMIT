import { supabaseAdmin } from '../auth/supabase.js';

/**
 * Calculates authoritative user statistics from actual commitment records.
 * System-generated; cannot be tampered with by clients.
 */
export async function calculateUserStats(userId, walletAddress, commitmentsMap) {
  const allCommitments = Array.from(commitmentsMap.values());
  const userCommitments = allCommitments.filter(c => {
    if (c.auth_user_id && userId && c.auth_user_id === userId) return true;
    if (c.details && c.details.auth_user_id && userId && c.details.auth_user_id === userId) return true;
    if (walletAddress && c.creator && c.creator.toLowerCase() === walletAddress.toLowerCase()) return true;
    return false;
  });

  const total = userCommitments.length;
  let active = 0;
  let pendingVerification = 0;
  let completed = 0;
  let failed = 0;
  let disputed = 0;
  let totalStaked = 0;

  // Sort chronological for streak calculation
  const sorted = [...userCommitments].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  let currentStreak = 0;
  let longestStreak = 0;

  for (const c of sorted) {
    const stake = Number(c.stakeAmount) || 0;
    
    if (c.status === 'ACTIVE' || c.status === 'FUNDED') {
      active++;
      totalStaked += stake;
    } else if (c.status === 'PENDING_VERIFICATION') {
      pendingVerification++;
      totalStaked += stake;
    } else if (c.status === 'DISPUTED') {
      disputed++;
      totalStaked += stake;
    } else if (c.status === 'SETTLED' || c.status === 'VERIFIED') {
      const isPass = c.attestation 
        ? Boolean(c.attestation.isSuccessful) 
        : (c.settlement ? c.settlement.recipientPayout >= c.stakeAmount : true);

      if (isPass) {
        completed++;
        currentStreak++;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        failed++;
        currentStreak = 0;
      }
    }
  }

  const settledCount = completed + failed;
  const successRate = settledCount > 0 
    ? Number(((completed / settledCount) * 100).toFixed(1)) 
    : 100.0;

  const stats = {
    total_commitments: total,
    active_commitments: active,
    pending_verification: pendingVerification,
    successful_commitments: completed,
    failed_commitments: failed,
    disputed_commitments: disputed,
    success_rate: successRate,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    total_staked_usdc: totalStaked,
    updated_at: new Date().toISOString()
  };

  // Persist to Supabase if userId is provided
  if (userId) {
    try {
      let profileId = userId;
      const { data: prof } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
        .maybeSingle();
      if (prof) profileId = prof.id;

      await supabaseAdmin
        .from('user_stats')
        .upsert({
          user_id: profileId,
          total_commitments: total,
          successful_commitments: completed,
          failed_commitments: failed,
          success_rate: successRate,
          current_streak: currentStreak,
          longest_streak: longestStreak,
          total_staked_usdc: totalStaked,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch (err) {
      // In-memory fallback
    }
  }

  return stats;
}
