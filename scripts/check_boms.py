with open('public/css/style.css', 'rb') as f:
    raw = f.read()

import re
boms = [m.start() for m in re.finditer(b'\xef\xbb\xbf', raw)]
print('BOM count:', len(boms))
print('BOM byte positions:', boms)
