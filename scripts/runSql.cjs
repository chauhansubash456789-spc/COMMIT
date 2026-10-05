const https = require('https');
const fs = require('fs');

const token = process.env.SUPABASE_ACCESS_TOKEN || "";
const ref = 'gkfuywaflismvlggypkp';

async function runQuery(sql) {
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
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.message || body));
          } else {
            resolve(parsed);
          }
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

const file = process.argv[2];
if (file) {
  const sql = fs.readFileSync(file, 'utf8');
  console.log('Running SQL from', file, '...');
  runQuery(sql)
    .then(res => {
      console.log('Success!');
      if (Array.isArray(res)) console.log('Returned rows:', res.length);
      else console.log(res);
    })
    .catch(err => {
      console.error('SQL Execution Error:', err.message);
      process.exit(1);
    });
} else {
  module.exports = { runQuery };
}