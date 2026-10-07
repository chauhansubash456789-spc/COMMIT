async function testNewEndpoints() {
  console.log('Testing newly added endpoints with admin@commit.fun...');

  // 1. Admin login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@commit.fun', password: 'Demo1234!' })
  });
  const loginData = await loginRes.json();
  const token = loginData.session?.access_token;
  console.log('Admin token received:', Boolean(token));

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  // 2. Test GET /api/admin/dashboard
  const dashRes = await fetch('http://localhost:3000/api/admin/dashboard', { headers: authHeaders });
  console.log('Dashboard status:', dashRes.status);
  const dashData = await dashRes.json();
  console.log('Dashboard stats:', dashData.stats);

  // 3. Test GET /api/admin/verifiers
  const verifRes = await fetch('http://localhost:3000/api/admin/verifiers', { headers: authHeaders });
  console.log('Verifiers status:', verifRes.status);
  const verifData = await verifRes.json();
  console.log('Verifiers count:', verifData.verifiers?.length, 'Sample:', verifData.verifiers?.[0]);

  // 4. Test GET /api/admin/system-health
  const healthRes = await fetch('http://localhost:3000/api/admin/system-health', { headers: authHeaders });
  console.log('Health status:', healthRes.status);
  const healthData = await healthRes.json();
  console.log('Health details:', healthData.health);

  // 5. Test GET /api/admin/commitments
  const commRes = await fetch('http://localhost:3000/api/admin/commitments', { headers: authHeaders });
  console.log('Commitments status:', commRes.status);
  const commData = await commRes.json();
  console.log('Commitments count:', commData.commitments?.length);

  // 6. Test GET /api/admin/disputes
  const dispRes = await fetch('http://localhost:3000/api/admin/disputes', { headers: authHeaders });
  console.log('Disputes status:', dispRes.status);
  const dispData = await dispRes.json();
  console.log('Disputes count:', dispData.disputes?.length);
}

testNewEndpoints();
