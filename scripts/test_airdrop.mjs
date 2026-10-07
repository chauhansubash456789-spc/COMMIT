import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { escrowClient } from '../server/solana/escrowClient.js';

async function airdrop() {
  try {
    const pubkey = escrowClient.authority.publicKey;
    console.log('Requesting 1 SOL airdrop for:', pubkey.toBase58());
    const sig = await escrowClient.connection.requestAirdrop(pubkey, 1 * LAMPORTS_PER_SOL);
    console.log('Airdrop tx signature:', sig);
    const latestBh = await escrowClient.connection.getLatestBlockhash();
    await escrowClient.connection.confirmTransaction({
      signature: sig,
      blockhash: latestBh.blockhash,
      lastValidBlockHeight: latestBh.lastValidBlockHeight
    });
    const balance = await escrowClient.connection.getBalance(pubkey);
    console.log(`New Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  } catch (err) {
    console.log('Airdrop error (rate-limited?):', err.message);
  }
}
airdrop();
