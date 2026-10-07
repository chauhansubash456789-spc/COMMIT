import http from 'http';

const req = http.get('http://localhost:3000/api/health', (res) => {
  console.log('Server is UP, status:', res.statusCode);
  process.exit(0);
});

req.on('error', (err) => {
  console.log('Server is DOWN:', err.message);
  process.exit(1);
});
