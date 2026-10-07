import http from 'http';

const req = http.get('http://localhost:3000/api/commitments', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode, 'Data length:', data.length);
  });
});
