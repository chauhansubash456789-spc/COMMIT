import fs from 'fs';
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  const keys = envContent.split('\n').map(l => l.split('=')[0].trim()).filter(Boolean);
  console.log('.env keys:', keys);
} else {
  console.log('No .env file');
}
