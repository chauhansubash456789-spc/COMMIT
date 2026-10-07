import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { escrowClient } from '../server/solana/escrowClient.js';

async function checkDevnet() {
  try {
    const pubkey = escrowClient.authority.publicKey;
    console.log('Escrow Authority Pubkey:', pubkey.toBase58());
    const balance = await escrowClient.connection.getBalance(pubkey);
    console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL (${balance} lamports)`);
    const slot = await escrowClient.connection.getSlot();
    console.log('Current Devnet Slot:', slot);
  } catch (err) {
    console.error('Devnet Error:', err.message);
  }
}
checkDevnet();
