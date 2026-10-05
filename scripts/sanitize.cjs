const fs = require('fs');

['scripts/query.mjs', 'scripts/runSql.cjs'].forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/const token = '[^']+';/, 'const token = process.env.SUPABASE_ACCESS_TOKEN || "";');
    fs.writeFileSync(f, content, 'utf8');
    console.log('Sanitized:', f);
  }
});