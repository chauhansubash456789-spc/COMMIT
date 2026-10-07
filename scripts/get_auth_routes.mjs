import fs from 'fs';
const authRoutes = fs.readFileSync('server/auth/routes.js', 'utf8');
const matches = authRoutes.match(/authRouter\.(get|post|put|delete|patch)\(['"][^'"]+/g);
console.log('authRouter routes:', matches);
