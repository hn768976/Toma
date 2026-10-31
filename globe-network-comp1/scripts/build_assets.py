"""
Pre-processing script that generated the files in public/textures and
public/data. It is NOT needed to render the video (the outputs are already
committed); it is included so the assets can be rebuilt/audited.

Inputs (all public-domain NASA-derived or Natural Earth data):
  --land     land-10m GeoJSON (Natural Earth 1:10m land, via world-atlas@2 + topojson-client)
  --water    water_4k.png  (NASA Blue Marble water mask, 4096x2048, white = water)
  --elev     elev_bump_4k.jpg (NASA SRTM/GTOPO-derived elevation, 4096x2048)
  --night    earth_night_4096.jpg (NASA Black Marble city lights, 4096x2048)
  --out      project root

Outputs:
  public/textures/land_8k.png   RGBA: land mask, coastline bevel (G,B), coastal shadow (A)
  public/textures/relief_4k.png RGB:  elevation, terrain normal (east, north)
  public/data/lights.json       [lat, lon, brightness] city-light points

Usage:
  python3 scripts/build_assets.py --land land10m.geojson --water water_4k.png \
      --elev elev_bump_4k.jpg --night earth_night_4096.jpg --out .
"""
import argparse, json, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

p = argparse.ArgumentParser()
p.add_argument("--land", required=True)
p.add_argument("--water", required=True)
p.add_argument("--elev", required=True)
p.add_argument("--night", required=True)
p.add_argument("--out", required=True)
p.add_argument("--lights", type=int, default=7000)
a = p.parse_args()

W, H = 8192, 4096
SS = 2  # supersampling for anti-aliased coastlines
os.makedirs(os.path.join(a.out, "public/textures"), exist_ok=True)
os.makedirs(os.path.join(a.out, "public/data"), exist_ok=True)

# ---- 1. Land mask from vector coastlines (crisp at 4K) -------------------
gj = json.load(open(a.land))
big = Image.new("L", (W * SS, H * SS), 0)
dr = ImageDraw.Draw(big)
def proj(c):
    return ((c[0] + 180.0) / 360.0 * W * SS, (90.0 - c[1]) / 180.0 * H * SS)
for f in gj["features"]:
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    for poly in polys:
        dr.polygon([proj(c) for c in poly[0]], fill=255)
        for hole in poly[1:]:
            dr.polygon([proj(c) for c in hole], fill=0)
land = np.asarray(big.resize((W, H), Image.LANCZOS), dtype=np.float32) / 255.0

# Inland lakes (Great Lakes, Caspian, Victoria...) from the raster water mask
water = Image.open(a.water).convert("L").resize((W, H), Image.BILINEAR)
water = np.asarray(water.filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float32) / 255.0
land = np.clip(land * (1.0 - np.clip((water - 0.35) * 2.5, 0, 1) * (land > 0.99)), 0, 1)
# Bake shading helpers so the real-time shader needs a single fetch:
#   R = land mask, G/B = coastline bevel gradient (east, north; 0.5 = flat),
#   A = soft shadow the "raised" land casts onto the ocean (offset south-east)
o = 3  # texels
gx = (np.roll(land, -o, 1) - np.roll(land, o, 1))
gy = (np.roll(land, o, 0) - np.roll(land, -o, 0))  # +north
sh = np.roll(np.roll(land, 9, 0), -4, 1)  # land 9 texels north / 4 west casts here
lowres = Image.fromarray((sh * 255).astype(np.uint8)).resize((W // 4, H // 4), Image.BILINEAR)
sh = np.asarray(lowres.filter(ImageFilter.GaussianBlur(2)).resize((W, H), Image.BILINEAR), dtype=np.float32) / 255.0
rgba = np.stack([land, gx * 0.5 + 0.5, gy * 0.5 + 0.5, sh], -1)
Image.fromarray((np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA").save(
    os.path.join(a.out, "public/textures/land_8k.png"), optimize=True)

# ---- 2. Relief: height (R) + tangent-space normal (G,B) -------------------
# 8-bit elevation terraces when differentiated; blur in float to remove the
# quantisation steps while keeping mountain ranges.
def fblur(arr, sigma):
    rad = int(np.ceil(sigma * 3))
    x = np.arange(-rad, rad + 1, dtype=np.float32)
    k = np.exp(-x * x / (2 * sigma * sigma)); k /= k.sum()
    out = np.zeros_like(arr)
    for i, w in enumerate(k):  # horizontal (wraps around the dateline)
        out += w * np.roll(arr, i - rad, axis=1)
    pad = np.pad(out, ((rad, rad), (0, 0)), mode="edge")
    res = np.zeros_like(arr)
    for i, w in enumerate(k):  # vertical
        res += w * pad[i:i + arr.shape[0]]
    return res
e = np.asarray(Image.open(a.elev).convert("L"), dtype=np.float32) / 255.0
e = 0.55 * fblur(e, 2.2) + 0.45 * fblur(e, 0.9)
gx = (np.roll(e, -1, 1) - np.roll(e, 1, 1)) * 0.5
gy = (np.roll(e, 1, 0) - np.roll(e, -1, 0)) * 0.5  # +y = north
s = 26.0
nx, ny = -gx * s, -gy * s
nz = np.ones_like(nx)
l = np.sqrt(nx * nx + ny * ny + nz * nz)
rgb = np.stack([e, nx / l * 0.5 + 0.5, ny / l * 0.5 + 0.5], -1)
Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).save(
    os.path.join(a.out, "public/textures/relief_4k.png"), optimize=True)

# ---- 3. City-light point cloud sampled from night-lights luminance -------
n = np.asarray(Image.open(a.night).convert("L"), dtype=np.float32) / 255.0
nh, nw = n.shape
wgt = np.clip(n - 0.12, 0, 1) ** 1.6
wgt *= np.cos(np.radians(90 - (np.arange(nh) + 0.5) / nh * 180))[:, None]  # area weighting
flat = wgt.ravel() / wgt.sum()
rng = np.random.default_rng(1312338598)
idx = rng.choice(flat.size, size=a.lights, replace=False, p=flat)
pts = []
for i in idx:
    y, x = divmod(int(i), nw)
    lon = (x + rng.random()) / nw * 360 - 180
    lat = 90 - (y + rng.random()) / nh * 180
    pts.append([round(lat, 3), round(lon, 3), round(float(n[y, x]), 3)])
json.dump(pts, open(os.path.join(a.out, "public/data/lights.json"), "w"), separators=(",", ":"))
print("done", len(pts))
