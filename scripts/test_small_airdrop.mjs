import { escrowClient } from '../server/solana/escrowClient.js';

async function testSmallAirdrop() {
  try {
    const pubkey = escrowClient.authority.publicKey;
    console.log('Requesting 500,000,000 lamports for:', pubkey.toBase58());
    const sig = await escrowClient.connection.requestAirdrop(pubkey, 500000000);
    console.log('Airdrop tx:', sig);
    await escrowClient.connection.confirmTransaction(sig);
    console.log('Airdrop confirmed!');
  } catch (err) {
    console.log('Error:', err.message);
  }
}
testSmallAirdrop();
