"""Step 4 (visual): crop gradient-only patches from frame 300 of the ENCODED
mp4, stretch contrast x8 around their mean, and tile them. Banding shows
as hard contour steps; smooth grain-covered ramps mean no banding. Also
prints, per patch, how many distinct 8-bit levels its smoothed row
profile passes through and the largest step between neighbours."""
import subprocess, sys
from PIL import Image, ImageFilter
P = {  # id: (x, y, w, h) gradient-only regions at 1280x720
 "CloudUpload-Blue": (930, 20, 340, 70),
 "DataPills-Blue": (940, 0, 330, 60),
 "DataPills-Amber": (940, 0, 330, 60),
 "DiamondFrames-BlackGold": (560, 470, 160, 120),
 "DiamondFrames-BlackSilver": (560, 470, 160, 120),
 "TopoLines-Silver": "auto", "TopoLines-Cyan": "auto",
 "FacetedRelief-MidnightBlue": (600, 300, 120, 60),
}
ids = sys.argv[1:]
tiles = []
for cid in ids:
    png = f"out/checks/{cid}_mp4_f300.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"out/previews/{cid.replace('-', '_')}.mp4",
                    "-vf", "select=eq(n\\,300)", "-frames:v", "1", png], check=True)
    im = Image.open(png).convert("RGB")
    box = P.get(cid)
    if box == "auto":
        # darkest 120x60 window = black between contour lines + glow falloff
        g = im.convert("L").resize((64, 36), Image.BOX)
        best = min(((g.getpixel((i, j)) + g.getpixel((i + 3, j)) + g.getpixel((i, j + 2)) + g.getpixel((i + 3, j + 2)), i, j)
                    for i in range(0, 60) for j in range(0, 33)))
        box = (best[1] * 20, best[2] * 20, 120, 60)
    x, y, w, h = box
    c = im.crop((x, y, x + w, y + h))
    L = c.convert("L")
    # column means (average over rows removes grain) -> horizontal profile
    px = L.load()
    prof = [sum(px[i, j] for j in range(h)) / h for i in range(w)]
    steps = max(abs(prof[i + 1] - prof[i]) for i in range(w - 1))
    mean = sum(prof) / w
    s = c.point(lambda v: max(0, min(255, int((v - mean) * 8 + 128))))
    tiles.append(s.resize((w * 2, h * 2), Image.NEAREST))
    print(f"{cid}: patch {box} mean={mean:.2f} profile {min(prof):.2f}..{max(prof):.2f} max column-mean step={steps:.2f}")
W = max(t.width for t in tiles); H = sum(t.height + 6 for t in tiles)
out = Image.new("RGB", (W, H), (255, 0, 255)); yy = 0
for t in tiles: out.paste(t, (0, yy)); yy += t.height + 6
out.save("out/checks/banding_stretch.png")
