import { dbSaveCommitment } from '../server/db/supabase.js';

const DEMO_COMMITMENTS = [
  {
    id: 'cm_alice_gh_01',
    title: 'Ship 5 Qualifying Commits to Solana Anchor Repo',
    creator: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
    stakingMode: 'HARDCORE',
    stakeAmount: 50,
    penaltyAmount: 15,
    verificationFee: 1.5,
    verifierType: 'github',
    failurePolicy: 'PARTIAL_EDUCATION_POOL',
    failurePolicyText: '35 USDC returned, 15 USDC to Solana Developer Education Pool',
    status: 'ACTIVE',
    details: {
      repoOwner: 'solana-labs',
      repoName: 'solana',
      authorUsername: 'alice-sol',
      requiredCommits: 5,
      startDate: new Date(Date.now() - 3600000 * 24).toISOString().split('T')[0],
      endDate: new Date(Date.now() + 3600000 * 72).toISOString().split('T')[0]
    },
    escrowPda: 'EscrowPDA_Alice_GH_01_Devnet',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: 'cm_alice_focus_02',
    title: 'Complete 3 Hours Deep Focus Study Block',
    creator: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
    stakingMode: 'NOLOSS',
    stakeAmount: 100,
    penaltyAmount: 8,
    verificationFee: 1.0,
    verifierType: 'study_timer',
    failurePolicy: 'YIELD_FORFEIT_TO_VERIFIERS',
    failurePolicyText: 'Principal 100% safe! Accrued yield forfeited to verifiers on failure',
    status: 'ACTIVE',
    details: {
      requiredMinutes: 180,
      environment: 'Commit Focus Terminal'
    },
    escrowPda: 'EscrowPDA_Alice_Focus_02_Devnet',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 'cm_david_peer_03',
    title: 'Clean & Organize Electronics Lab Workbench',
    creator: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    stakingMode: 'HARDCORE',
    stakeAmount: 30,
    penaltyAmount: 10,
    verificationFee: 2.0,
    verifierType: 'peer_consensus',
    failurePolicy: 'PARTIAL_COMMUNITY_POOL',
    failurePolicyText: '20 USDC returned, 10 USDC to Community Hardware Fund',
    status: 'PENDING_VERIFICATION',
    details: {
      taskName: 'Clean & Organize Workbench',
      requirements: ['Clean desk surface', 'Sort electronic components', 'Dynamic blockhash visible']
    },
    escrowPda: 'EscrowPDA_David_Peer_03_Devnet',
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString()
  },
  {
    id: 'cm_alice_settled_04',
    title: 'Deploy Zero-Knowledge Commitment Prover on Solana Devnet',
    creator: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
    stakingMode: 'HARDCORE',
    stakeAmount: 150,
    penaltyAmount: 50,
    verificationFee: 2.5,
    verifierType: 'github',
    failurePolicy: 'FULL_SLASH_CHARITY',
    failurePolicyText: '100% Slashed to The Water Project on failure',
    status: 'SETTLED',
    details: {
      repoOwner: 'commit-protocol',
      repoName: 'zk-prover',
      authorUsername: 'alice-sol',
      requiredCommits: 3
    },
    escrowPda: 'EscrowPDA_Alice_Settled_04_Devnet',
    attestation: {
      outcome: 'PASS',
      verifierId: 'github_oracle',
      confidenceScore: 100,
      timestamp: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    settlement: {
      txHash: '5K2bW78V4h7Y89N41LpQ3xZ8129NmP901V2b489Xwz41K',
      payoutAmount: 150,
      slashedAmount: 0,
      recipient: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
      timestamp: new Date(Date.now() - 3600000 * 3).toISOString()
    },
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString()
  }
];

async function seed() {
  console.log('Seeding demo commitments into Supabase...');
  for (const c of DEMO_COMMITMENTS) {
    const res = await dbSaveCommitment(c);
    console.log(`Saved: ${c.id} (${c.title}) -> ${res ? 'OK' : 'FAIL'}`);
  }
  console.log('Finished seeding demo commitments.');
}

seed();
