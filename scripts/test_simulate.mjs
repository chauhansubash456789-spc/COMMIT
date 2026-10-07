import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  TransactionInstruction
} from '@solana/web3.js';
import { escrowClient } from '../server/solana/escrowClient.js';

async function testSimulate() {
  try {
    const { blockhash, lastValidBlockHeight } = await escrowClient.getLatestBlockhash();
    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: escrowClient.authority.publicKey
    });

    // Add Memo instruction representing settlement attestation
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
    console.log('Transaction signed! Signature:', tx.signature.toString('base64'));

    const simulation = await escrowClient.connection.simulateTransaction(tx);
    console.log('Simulation result:', simulation.value);
  } catch (err) {
    console.error('Simulation error:', err.message);
  }
}
testSimulate();
