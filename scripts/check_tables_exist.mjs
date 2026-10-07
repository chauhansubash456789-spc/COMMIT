import { supabaseAdmin } from '../server/auth/supabase.js';

async function check() {
  const tables = ['user_profiles', 'user_stats', 'verifier_profiles', 'commitments', 'audit_logs', 'verifier_reputation_events', 'disputes', 'admin_users'];
  for (const t of tables) {
    const { count, error } = await supabaseAdmin.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`Table [${t}]: NOT FOUND (${error.message})`);
    } else {
      console.log(`Table [${t}]: EXISTS, count = ${count}`);
    }
  }
}
check();
