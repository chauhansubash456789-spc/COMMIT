import { supabaseAdmin } from '../server/auth/supabase.js';

async function checkCols() {
  const { data: dData, error: dErr } = await supabaseAdmin.from('disputes').select('*').limit(1);
  console.log('disputes select:', dData, dErr);

  const { data: rData, error: rErr } = await supabaseAdmin.from('verifier_reputation_events').select('*').limit(1);
  console.log('reputation select:', rData, rErr);
}
checkCols();
