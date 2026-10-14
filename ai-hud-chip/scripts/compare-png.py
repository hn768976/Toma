#!/usr/bin/env python3
"""Byte/pixel comparison of two PNGs (decoded RGBA). usage: compare-png.py a.png b.png"""
import sys, zlib, struct

def decode(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    pos, idat, w = 8, b'', 0
    while pos < len(data):
        ln, = struct.unpack('>I', data[pos:pos+4]); typ = data[pos+4:pos+8]
        body = data[pos+8:pos+8+ln]; pos += 12 + ln
        if typ == b'IHDR':
            w, h, bd, ct = struct.unpack('>IIBB', body[:10])
        elif typ == b'IDAT':
            idat += body
    ch = {2: 3, 6: 4, 0: 1, 4: 2}[ct]
    raw = zlib.decompress(idat); stride = w * ch
    out = bytearray(); prev = bytearray(stride); i = 0
    for _ in range(h):
        f = raw[i]; line = bytearray(raw[i+1:i+1+stride]); i += 1 + stride
        for x in range(stride):
            a = line[x-ch] if x >= ch else 0; b = prev[x]; c = prev[x-ch] if x >= ch else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c; pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else (b if pb <= pc else c))) & 255
        out += line; prev = line
    return w, h, ch, bytes(out)

a, b = decode(sys.argv[1]), decode(sys.argv[2])
if a[:3] != b[:3]:
    print(f"DIFFERENT SIZE {a[:3]} vs {b[:3]}"); sys.exit(1)
if a[3] == b[3]:
    print(f"IDENTICAL pixels ({a[0]}x{a[1]}x{a[2]})"); sys.exit(0)
diff = sum(1 for x, y in zip(a[3], b[3]) if x != y)
mx = max(abs(x - y) for x, y in zip(a[3], b[3]))
print(f"DIFFERENT: {diff} channel values differ, max delta {mx}"); sys.exit(1)
