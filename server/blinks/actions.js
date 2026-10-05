/**
 * SOLANA ACTIONS & BLINKS IMPLEMENTATION
 * Enables commitments to be unfurled and funded directly from X/Twitter or Telegram.
 */

export function getActionsJson() {
  return {
    rules: [
      {
        pathPattern: "/commit/*",
        apiPath: "/api/actions/commit/*"
      },
      {
        pathPattern: "/api/actions/commit",
        apiPath: "/api/actions/commit"
      }
    ]
  };
}

export function getCommitActionMetadata(commitment) {
  const isNoLoss = commitment.stakingMode === 'NOLOSS';
  const modeBadge = isNoLoss ? '🛡️ NO-LOSS YIELD' : '🔥 HARDCORE';

  return {
    type: 'action',
    icon: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=80',
    title: `${modeBadge}: ${commitment.title}`,
    description: `Stake: ${commitment.stakeAmount} USDC | Verifier: ${commitment.verifierType.toUpperCase()} | Consequence: ${commitment.failurePolicyText}. Put your money behind your promise.`,
    label: `Lock ${commitment.stakeAmount} USDC`,
    disabled: commitment.status !== 'CREATED',
    links: {
      actions: [
        {
          label: `Lock ${commitment.stakeAmount} USDC Escrow`,
          href: `/api/actions/commit?id=${commitment.id}&action=fund`
        },
        {
          label: `Challenge Friend (Double Stake)`,
          href: `/api/actions/commit?id=${commitment.id}&action=challenge`
        }
      ]
    }
  };
}

export function buildActionTransaction(account, commitment) {
  // Simulates serialized Solana transaction payload for Dialect Blink wallets
  const simulatedTxBase64 = Buffer.from(`COMMIT_SOLANA_ACTION_TX_${commitment.id}_${account}`).toString('base64');
  
  return {
    transaction: simulatedTxBase64,
    message: `Successfully locked ${commitment.stakeAmount} USDC into Commit Escrow! Your goal is now Active.`
  };
}
