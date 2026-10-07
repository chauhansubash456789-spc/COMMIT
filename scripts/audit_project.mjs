import fs from 'fs';

console.log('=== AUDITING PROJECT ===');
const serverIndex = fs.readFileSync('server/index.js', 'utf8');
const routes = serverIndex.match(/app\.(get|post|put|delete|patch)\(['"][^'"]+/g);
console.log('Server Index Routes:', routes);

const authRoutes = fs.readFileSync('server/auth/routes.js', 'utf8');
const authRouteMatches = authRoutes.match(/router\.(get|post|put|delete|patch)\(['"][^'"]+/g);
console.log('Auth Routes:', authRouteMatches);
