import fs from 'fs';
let js = fs.readFileSync('public/js/app.js', 'utf8');
let start = js.indexOf('function renderCommitments');
let end = js.indexOf('function setupWizard');
console.log(js.substring(start, end));
