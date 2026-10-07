import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('scripts/seedDemoAccounts.mjs', 'r', encoding='utf-8') as f:
    print(f.read())
