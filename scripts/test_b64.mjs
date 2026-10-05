import fs from 'fs';

let js = fs.readFileSync('tests/e2e_full_test.js', 'utf8');

const startIdx = js.indexOf('// STEP 7: PEER CONSENSUS_BLOCKHASH');
if (startIdx === -1) {
  const altIdx = js.indexOf('// STEP 7: PEER CONSENSUS');
  console.log('Found alt index;', altIdx);
}
