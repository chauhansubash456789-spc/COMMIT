import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('public/js/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

start = js.find('function renderCommitments')
print(js[start:start+1800])
