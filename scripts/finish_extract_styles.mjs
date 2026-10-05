import fs from 'fs';

let html = fs.readFileSync('public/index.html', 'utf8');
let css = fs.readFileSync('public/css/style.css', 'utf8');

// Add .btn-submit-large to css if needed
if (!css.includes('.btn-submit-large')) {
  css += `\n.btn-submit-large {\n  padding: 1rem;\n}\n`;
  fs.writeFileSync('public/css/style.css', css, 'utf8');
}

// 1. Line 201: wizardConsequencePreview
html = html.replace(
  '<div class="consequence-box" id="wizardConsequencePreview" style="margin:1.5rem 0;">',
  '<div class="consequence-box wizard-preview-box" id="wizardConsequencePreview">'
);

// 2. Line 205: btn-submit-large
html = html.replace(
  '<button type="submit" class="btn btn-primary btn-full" style="padding:1rem;">',
  '<button type="submit" class="btn btn-primary btn-full btn-submit-large">'
);

// 3. Line 315: peer avatar circle with whatever emoji / text
html = html.replace(
  /<div style="width:64px;height:64px;border-radius:50%;background:var\(--gradient-cyber\);margin:0 auto 0\.75rem;display:flex;align-items:center;justify-content:center;font-size:1\.5rem;">([^<]*)<\/div>/,
  '<div class="peer-avatar-circle">$1</div>'
);

fs.writeFileSync('public/index.html', html, 'utf8');

const remaining = (html.match(/style="[^"]+"/g) || []);
console.log('Final remaining inline styles count in public/index.html:', remaining.length);
if (remaining.length > 0) {
  console.log('Remaining:', remaining);
}
