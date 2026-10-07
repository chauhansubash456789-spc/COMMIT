import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('tests/attack_tests.js', 'r', encoding='utf-8') as f:
    code = f.read()

lines = code.split('\n')
for line in lines:
    if 'testAttack(' in line:
        print(line.strip())
