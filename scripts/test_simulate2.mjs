import {
  PublicKey,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';
import bs58 from 'bs58';
import { escrowClient } from '../server/solana/escrowClient.js';

async function testSimulate() {
  try {
    const blockhash = await escrowClient.getLatestBlockhash();
    console.log('Live devnet blockhash:', blockhash);
    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: escrowClient.authority.publicKey
    });

    const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    const memoData = Buffer.from(JSON.stringify({
      protocol: 'COMMIT_ESCROW',
      commitmentId: 'cm_test_123',
      result: 'PASS',
      timestamp: Date.now()
    }));

    tx.add(new TransactionInstruction({
      keys: [{ pubkey: escrowClient.authority.publicKey, isSigner: true, isWritable: true }],
      programId: MEMO_PROGRAM_ID,
      data: memoData
    }));

    tx.sign(escrowClient.authority);
    const sigBase58 = bs58.encode(tx.signature);
    console.log('Real Transaction signed by Devnet Keypair!');
    console.log('Signature:', sigBase58);

    const simulation = await escrowClient.connection.simulateTransaction(tx);
    console.log('Simulation logs:', simulation.value.logs);
    console.log('Simulation err:', simulation.value.err);
  } catch (err) {
    console.error('Simulation error:', err.message);
  }
}
testSimulate();
