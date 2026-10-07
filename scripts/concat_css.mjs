import fs from 'fs';

const p1 = fs.readFileSync('scripts/part1.txt', 'utf8');
const p2 = fs.readFileSync('scripts/part2.txt', 'utf8');
const p3 = fs.readFileSync('scripts/part3.txt', 'utf8');
const p4 = fs.readFileSync('scripts/part4.txt', 'utf8');

const finalCss = [p1, p2, p3, p4].join('\n\n');
fs.writeFileSync('public/css/style.css', finalCss, 'utf8');

console.log('Concatenated style.css successfully! Length:', finalCss.length);
