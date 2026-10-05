import fs from 'fs';

let e2e = fs.readFileSync('tests/e2e_full_test.js', 'utf8');
const target = `    const peerRes = await fetch(\`\${BASE_URL}/api/commitments/create\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },`;

const replacement = `    const peerRes = await fetch(\`\${BASE_URL}/api/commitments/create\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: \`Bearer \${userToken}\`
      },`;

if (e2e.includes(target)) {
  e2e = e2e.replace(target, replacement);
  fs.writeFileSync('tests/e2e_full_test.js', e2e, 'utf8');
  console.log('✅ Updated e2e_full_test.js to send Authorization header in Step 7');
}
