import fs from 'fs';
const authRoutes = fs.readFileSync('server/auth/routes.js', 'utf8');
console.log('authRoutes length:', authRoutes.length);
console.log('Sample auth routes:\n', authRoutes.substring(0, 1500));
