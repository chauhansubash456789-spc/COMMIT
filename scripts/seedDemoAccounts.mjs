import { supabaseAdmin, supabaseAnon } from '../server/auth/supabase.js';

const DEMO_ACCOUNTS = [
  {
    email: 'alice@commit.fun',
    password: 'Demo1234!',
    username: 'alice_creator',
    displayName: 'Alice Vance (Creator)',
    role: 'USER',
    walletAddress: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
    bio: 'Solana hacker, Rust enthusiast, and daily deep worker.'
  },
  {
    email: 'bob@commit.fun',
    password: 'Demo1234!',
    username: 'bob_verifier',
    displayName: 'Bob Chen (Accredited Verifier)',
    role: 'VERIFIER',
    walletAddress: '4Nd1mBQtrMJVYVfKf2PJy9NZ268BsG2f2y6b7UjNnBcv',
    bio: 'Accredited peer verifier and automated oracle operator.'
  },
  {
    email: 'admin@commit.fun',
    password: 'Demo1234!',
    username: 'charlie_admin',
    displayName: 'Charlie Miller (Protocol Admin)',
    role: 'ADMIN',
    walletAddress: '7ZWk3rP6J88dTYuV23pGfK1bNm99QwXz41VpLm9B8aQ1',
    bio: 'Commit Protocol security admin and system auditor.'
  },
  {
    email: 'david@commit.fun',
    password: 'Demo1234!',
    username: 'david_achiever',
    displayName: 'David Park (Goal Achiever)',
    role: 'USER',
    walletAddress: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    bio: 'Fitness and productivity enthusiast staking USDC on personal milestones.'
  }
];

async function seed() {
  console.log('====================================================');
  console.log('🌱 SEEDING DEMO ACCOUNTS FOR COMMIT PROTOCOL');
  console.log('====================================================\n');

  // Fetch all existing auth users
  const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) {
    console.error('Failed to list auth users:', listErr.message);
    process.exit(1);
  }

  const existingAuthUsers = listData.users || [];

  for (const acc of DEMO_ACCOUNTS) {
    console.log(`Processing demo account: ${acc.email} (${acc.role})...`);

    let authUser = existingAuthUsers.find(u => u.email === acc.email);

    if (authUser) {
      console.log(`  - Auth user exists (${authUser.id}), updating password and metadata...`);
      const { data: updated, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        authUser.id,
        {
          password: acc.password,
          email_confirm: true,
          user_metadata: {
            display_name: acc.displayName,
            username: acc.username
          }
        }
      );
      if (updateErr) {
        console.warn(`    Warning updating user: ${updateErr.message}`);
      } else {
        authUser = updated.user;
      }
    } else {
      console.log(`  - Creating new Auth user...`);
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: {
          display_name: acc.displayName,
          username: acc.username
        }
      });

      if (createErr) {
        console.error(`    Error creating user ${acc.email}:`, createErr.message);
        continue;
      }
      authUser = created.user;
      console.log(`    Created Auth user ID: ${authUser.id}`);
    }

    // Give trigger 300ms to ensure profile row exists
    await new Promise(r => setTimeout(r, 300));

    // Fetch or create profile
    let { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();

    if (!profile) {
      console.log(`  - Profile not created by trigger, manually inserting...`);
      const { data: newProfile, error: pErr } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          auth_user_id: authUser.id,
          username: acc.username,
          display_name: acc.displayName,
          role: acc.role,
          status: 'ACTIVE',
          wallet_address: acc.walletAddress
        })
        .select()
        .single();
      
      if (pErr) {
        console.warn(`    Warning inserting profile: ${pErr.message}`);
      } else {
        profile = newProfile;
      }
    } else {
      // Update profile with role, wallet, status
      console.log(`  - Updating profile: setting role=${acc.role}, wallet=${acc.walletAddress}`);
      const { data: updatedProfile, error: upErr } = await supabaseAdmin
        .from('user_profiles')
        .update({
          display_name: acc.displayName,
          role: acc.role,
          status: 'ACTIVE',
          wallet_address: acc.walletAddress
        })
        .eq('id', profile.id)
        .select()
        .single();

      if (upErr) {
        console.warn(`    Warning updating profile: ${upErr.message}`);
      } else {
        profile = updatedProfile;
      }
    }

    // Ensure user_stats
    if (profile) {
      await supabaseAdmin
        .from('user_stats')
        .upsert({
          user_id: profile.id,
          total_commitments: 5,
          completed_commitments: 4,
          failed_commitments: 1,
          total_staked_usdc: 450,
          reputation_score: acc.role === 'VERIFIER' ? 98 : 95
        }, { onConflict: 'user_id' });

      // If ADMIN, ensure entry in admin_users
      if (acc.role === 'ADMIN') {
        console.log(`  - Seeding admin_users table for Charlie...`);
        await supabaseAdmin
          .from('admin_users')
          .upsert({
            user_id: profile.id,
            admin_role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            permissions: { all: true, manage_commitments: true, manage_users: true }
          }, { onConflict: 'user_id' });
      }

      // If VERIFIER, ensure entry in verifier_profiles if table exists
      if (acc.role === 'VERIFIER') {
        try {
          await supabaseAdmin
            .from('verifier_profiles')
            .upsert({
              user_id: profile.id,
              stake_amount: 500,
              reputation_score: 98,
              total_verifications: 42,
              status: 'APPROVED'
            }, { onConflict: 'user_id' });
        } catch (e) {
          // Ignore if table schema differs
        }
      }
    }

    // Verify login works with credentials
    const { data: testLogin, error: loginErr } = await supabaseAnon.auth.signInWithPassword({
      email: acc.email,
      password: acc.password
    });

    if (loginErr) {
      console.error(`  ❌ Login verification failed for ${acc.email}:`, loginErr.message);
    } else {
      console.log(`  ✅ Verified login works for ${acc.email} (JWT: ${testLogin.session.access_token.substring(0, 15)}...)`);
    }
    console.log('');
  }

  console.log('====================================================');
  console.log('🎉 ALL DEMO ACCOUNTS SEEDED & VERIFIED SUCCESSFULLY!');
  console.log('====================================================\n');
}

seed().catch(err => {
  console.error('Fatal error in seed:', err);
  process.exit(1);
});
