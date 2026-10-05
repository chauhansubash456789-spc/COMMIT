import fs from 'fs';

let js = fs.readFileSync('public/js/app.js', 'utf8');

const oldFetch = `  try {
    const res = await fetch(\`\${API_BASE}/api/commitments/create\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });`;

const newFetch = `  try {
    const headers = { 'Content-Type': 'application/json' };
    if (state.auth && state.auth.token) {
      headers['Authorization'] = \`Bearer \${state.auth.token}\`;
    }
    const res = await fetch(\`\${API_BASE}/api/commitments/create\`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });`;

if (js.includes(oldFetch)) {
  js = js.replace(oldFetch, newFetch);
  fs.writeFileSync('public/js/app.js', js, 'utf8');
  console.log('Successfully updated create commitment headers with auth token');
} else {
  console.log('Target fetch block not found or already patched');
}