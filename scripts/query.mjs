import vm from 'vm';
import fs from 'fs';
import https from 'https';

const token = process.env.SUPABASE_ACCESS_TOKEN || "";
const ref = 'gkfuywaflismvlggypkp';

export async function runSQL(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com',
      port: 443,
      path: '/v1/projects/' + ref + '/database/query',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(body);
          if (res.statusCode >= 400) reject(new Error(p.message || body));
          else resolve(p);
        } catch (e) {
          if (res.statusCode >= 400) reject(new Error(body));
          else resolve(body);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

if (process.argv[2]) {
  const sql = fs.readFileSync(process.argv[2], 'utf8');
  console.log('Executing:', process.argv[2]);
  runSQL(sql)
    .then(res => {
      console.log('Result:', JSON.stringify(res, null, 2));
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}
