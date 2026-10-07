with open('public/css/style.css', 'rb') as f:
    raw = f.read()

import re
boms = [m.start() for m in re.finditer(b'\xef\xbb\xbf', raw)]
for pos in boms:
    snippet = raw[pos:pos+60].decode('utf-8', errors='replace')
    print(f"At {pos}: {repr(snippet)}")
