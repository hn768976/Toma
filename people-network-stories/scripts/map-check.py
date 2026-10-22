"""World map check: no people in the oceans, no continent missing.
usage: python3 scripts/map-check.py out/previews/PeopleWorldMap_Red.mp4 light|dark"""
import json, math, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

path, kind = sys.argv[1], sys.argv[2]
W, H = 1280, 720
LAT_TOP, LAT_BOTTOM = 84, -56.5


def project(lon, lat):
    mapW = W * 0.95
    x = (W - mapW) / 2 + (lon + 180) / 360 * mapW
    py = (mapW / 360) / math.cos(math.radians(31))
    mapH = (LAT_TOP - LAT_BOTTOM) * py
    top = (H - mapH) / 2
    return x, top + (LAT_TOP - lat) * py


land = json.load(open("public/land-110m.json"))
mask = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(mask)
for poly in land:
    if not any(lat > -60 for _, lat in poly[0]):
        continue
    for shift in (-360, 0, 360):
        for k, ring in enumerate(poly):
            pts, off, prev = [], 0, ring[0][0]
            for i, (lon, lat) in enumerate(ring):
                if i and abs(lon - prev) > 180:
                    off += 360 if lon < prev else -360
                prev = lon
                pts.append(project(lon + off + shift, lat))
            d.polygon(pts, fill=255 if k == 0 else 0)
landm = np.array(mask) > 127
# Icons stand on their sample point and extend upwards (~16 px tall at 720p, plus a
# tight glow on the cyan map): allow 18 px above the land and 6 px around it.
base = np.array(mask.filter(ImageFilter.MaxFilter(13))) > 127
near = base.copy()
for dy in range(1, 19):
    near[:-dy] |= base[dy:]

raw = subprocess.check_output(["ffmpeg", "-v", "error", "-sseof", "-0.5", "-i", path, "-frames:v", "1",
                               "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
img = np.frombuffer(raw, np.uint8).reshape(H, W, 3).astype(int)
bg = np.array([251, 251, 250]) if kind == "light" else np.array([0, 0, 0])
drawn = np.abs(img - bg).max(axis=2) > 40
ocean = drawn & ~near
print("drawn pixels:", int(drawn.sum()), "far out in the ocean:", int(ocean.sum()))


def region(name, lon0, lon1, lat0, lat1):
    x0, y0 = project(lon0, lat1)
    x1, y1 = project(lon1, lat0)
    sl = (slice(int(y0), int(y1)), slice(int(x0), int(x1)))
    lm = landm[sl]
    cov = (drawn[sl] & lm).sum() / max(1, lm.sum())
    print(f"{name}: land px {int(lm.sum())}, covered {cov:.0%}")
    return cov


ok = ocean.sum() < 30
for args in [("Australia", 113, 154, -39, -11), ("Greenland", -73, -12, 60, 83), ("Madagascar", 43, 51, -26, -12),
             ("Africa", -17, 51, -35, 37), ("South America", -81, -35, -55, 12), ("North America", -168, -52, 15, 72),
             ("Eurasia", -10, 180, 10, 77)]:
    ok &= region(*args) > 0.5
print("MAP CHECK", "PASS" if ok else "FAIL")
if len(sys.argv) > 3:
    vis = img.astype(np.uint8).copy()
    vis[ocean] = [0, 160, 255]
    Image.fromarray(vis).save(sys.argv[3])
