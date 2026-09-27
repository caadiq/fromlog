"""Extract only fromlog from an all-databases gzip dump, preserving restore settings."""
import gzip
import os
import sys

source, target = sys.argv[1:]
selected = False
header = True
found = False
# Never overwrite an existing backup or emit SQL contents to stdout.
fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'wb') as output, gzip.open(source, 'rb') as backup:
    for line in backup:
        if line.startswith(b'-- Current Database: '):
            header = False
            selected = b'`fromlog`' in line
            found = found or selected
        if header or selected:
            output.write(line)
    output.write(b'\nSET FOREIGN_KEY_CHECKS=1;\n')
if not found:
    os.unlink(target)
    raise SystemExit('fromlog database not found')
print('Extracted fromlog backup; SQL contents withheld.')
