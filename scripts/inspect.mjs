import fs from 'fs';

let lines = fs.readFileSync('public/js/app.js', 'utf8').split('\n');
for (let i = 10; i < 28; i++) {
  console.log(i + ': ' + JSON.stringify(lines[i]));
}
