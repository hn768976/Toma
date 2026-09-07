#!/usr/bin/env python3
"""
Bake the Natural Earth land polygons into src/globe/landmask.ts.

Source data: Natural Earth 1:110m "land" (public domain, no attribution
required), taken from the canonical nvkelso/natural-earth-vector repository:

  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson

Run this only when you want to change the mask resolution. The result is
committed into the project, so a render never touches the network and no
third-party basemap is embedded anywhere.

  python3 tools/bake-mask.py ne_110m_land.geojson
"""
import json, base64, sys

RES = 2                     # cells per degree  -> 0.5 deg
NX, NY = 360 * RES, 180 * RES   # 720 x 360

SRC = sys.argv[1] if len(sys.argv) > 1 else 'ne_110m_land.geojson'
d = json.load(open(SRC))

# Collect every ring as a list of (lon, lat) vertices.
rings = []
for feat in d['features']:
    g = feat['geometry']
    if g['type'] == 'Polygon':
        for ring in g['coordinates']:
            rings.append(ring)
    else:
        for poly in g['coordinates']:
            for ring in poly:
                rings.append(ring)

# Pre-split rings into edges with their lat range, for scanline crossing tests.
edges = []
for ring in rings:
    for k in range(len(ring) - 1):
        x0, y0 = ring[k]
        x1, y1 = ring[k + 1]
        if y0 == y1:
            continue                      # horizontal edges never cross a scanline
        edges.append((y0, y1, x0, x1))
print(f'rings={len(rings)} edges={len(edges)}', file=sys.stderr)

mask = bytearray(NX * NY)                 # 1 byte per cell while building

for j in range(NY):
    lat = 90.0 - (j + 0.5) / RES          # cell-centre latitude
    xs = []
    for (y0, y1, x0, x1) in edges:
        # half-open rule on latitude avoids double-counting shared vertices
        if (y0 <= lat) != (y1 <= lat):
            xs.append(x0 + (lat - y0) * (x1 - x0) / (y1 - y0))
    if not xs:
        continue
    xs.sort()
    row = j * NX
    # even-odd fill: land between crossing pairs. Holes (lakes) fall out for free.
    for a in range(0, len(xs) - 1, 2):
        xa, xb = xs[a], xs[a + 1]
        ia = int((xa + 180.0) * RES - 0.5) + 1
        ib = int((xb + 180.0) * RES - 0.5)
        if ia < 0: ia = 0
        if ib > NX - 1: ib = NX - 1
        for i in range(ia, ib + 1):
            mask[row + i] = 1

land = sum(mask)
print(f'land cells {land}/{NX*NY} = {100.0*land/(NX*NY):.1f}%', file=sys.stderr)

# Bit-pack MSB-first, 8 cells per byte, then base64.
packed = bytearray((NX * NY + 7) // 8)
for idx in range(NX * NY):
    if mask[idx]:
        packed[idx >> 3] |= 0x80 >> (idx & 7)
b64 = base64.b64encode(bytes(packed)).decode('ascii')
print(f'packed {len(packed)} bytes -> base64 {len(b64)} chars', file=sys.stderr)

open('mask.b64', 'w').write(b64)
print('wrote mask.b64 - paste it into MASK_B64 in src/globe/landmask.ts', file=sys.stderr)
