#!/usr/bin/env python3
"""Verify loop for the 720p previews. Run from the project root after rendering out/previews.

Checks: ffprobe format, loop seam (frame 0 vs 300), background levels, chroma-key test,
boil cadence, and cold-start determinism. Writes images to out/verify/.
"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out", "verify")
PREV = os.path.join(ROOT, "out", "previews")
BUNDLE = os.path.join(ROOT, "out", "bundle")
SCALE = "0.3333333333333333"
os.makedirs(OUT, exist_ok=True)

GREEN = {"DoodleFrame_Crayon", "BoilArrow_Cream", "ChalkArrow_Curved", "ChalkHearts", "ChalkArrows_Down", "BrushArrowPack_Green"}
LOOPS = ["DoodleFrame_Crayon", "DoodleFrame_ChalkBlack", "BoilArrow_Cream", "ChalkArrow_Curved", "ChalkHearts", "ChalkArrows_Down"]
PACKS = ["BrushArrowPack_Black", "BrushArrowPack_Green"]
ALL = LOOPS + PACKS
comp = lambda name: name.replace("_", "-", 1)
results = {}

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
    if r.returncode:
        print(r.stdout[-2000:], r.stderr[-2000:])
        raise SystemExit(f"failed: {' '.join(cmd)}")
    return r.stdout

def still(name, frame, path, props=None):
    cmd = ["npx", "remotion", "still", BUNDLE, comp(name), path, f"--frame={frame}", f"--scale={SCALE}"]
    if props:
        cmd.append(f"--props={json.dumps(props)}")
    run(cmd)
    return np.asarray(Image.open(path).convert("RGB")).astype(int)

def seq(name, a, b, d):
    os.makedirs(d, exist_ok=True)
    run(["npx", "remotion", "render", BUNDLE, comp(name), d, "--sequence", f"--frames={a}-{b}", f"--scale={SCALE}", "--image-format=png"])
    files = sorted(f for f in os.listdir(d) if f.endswith(".png"))
    return [os.path.join(d, f) for f in files]

def mp4_frame(name, frame):
    p = os.path.join(OUT, f"{name}-mp4-{frame}.png")
    run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(PREV, name + ".mp4"), "-vf", f"select=eq(n\\,{frame})", "-vsync", "0", "-frames:v", "1", p])
    return np.asarray(Image.open(p).convert("RGB")).astype(int)

def dilate(mask, r):
    m = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            m |= np.roll(np.roll(mask, dy, 0), dx, 1)
    return m

def erode(mask, r):
    return ~dilate(~mask, r)

def bg_of(name):
    return np.array([0, 255, 0] if name in GREEN else [0, 0, 0])

def check(which):
    return which == "all" or which in sys.argv[1:] or len(sys.argv) == 1

# 1. ffprobe
if check("probe"):
    for n in ALL:
        o = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", os.path.join(PREV, n + ".mp4")]))
        v = [s for s in o["streams"] if s["codec_type"] == "video"][0]
        audio = [s for s in o["streams"] if s["codec_type"] == "audio"]
        dur = float(o["format"]["duration"])
        want = 8.0 if n in PACKS else 10.0
        ok = (v["width"], v["height"], v["r_frame_rate"], v["codec_name"], v["pix_fmt"]) == (1280, 720, "30/1", "h264", "yuv420p") and not audio and abs(dur - want) < 0.02
        results.setdefault("probe", {})[n] = dict(ok=ok, size=f'{v["width"]}x{v["height"]}', fps=v["r_frame_rate"], codec=v["codec_name"], pix=v["pix_fmt"], audio=len(audio), dur=dur, frames=v.get("nb_frames"))
        print("probe", n, results["probe"][n])

# 2. loop seam
if check("loop"):
    for n in LOOPS:
        a = still(n, 0, os.path.join(OUT, f"{n}-loop-0.png"), {"loopCheck": True})
        b = still(n, 300, os.path.join(OUT, f"{n}-loop-300.png"), {"loopCheck": True})
        diff = int(np.abs(a - b).max())
        results.setdefault("loop", {})[n] = dict(ok=diff == 0, maxdiff=diff)
        print("loop", n, results["loop"][n])

# 3. background levels: points that are background in the lossless still, read back from the mp4
if check("bg"):
    rng = np.random.default_rng(7)
    for n in ALL:
        frames = [0, 61, 150, 239] if n in PACKS else [0, 100, 200, 299]
        worst = 0
        tol = 2 if n in GREEN else 1
        for f in frames:
            s = still(n, f, os.path.join(OUT, f"{n}-bg-{f}.png"))
            ink = np.any(s != bg_of(n), axis=2)
            # 12 px clear of ink: outside the 4:2:0 chroma spill of an edge
            free = ~dilate(ink, 12)
            ys, xs = np.nonzero(free)
            idx = rng.choice(len(ys), 50, replace=False)
            m = mp4_frame(n, f)
            vals = m[ys[idx], xs[idx]]
            worst = max(worst, int(np.abs(vals - bg_of(n)).max()))
            exact = int(np.abs(s[free] - bg_of(n)).max())
            assert exact == 0, (n, f, "lossless still background not exact")
        results.setdefault("bg", {})[n] = dict(ok=worst <= tol, worst_abs_dev=worst, tol=tol)
        print("bg", n, results["bg"][n])

# 4. key test over mid-grey
if check("key"):
    for n in [x for x in ALL if x in GREEN]:
        frames = [15, 60, 105, 150, 210, 270] if n not in PACKS else [40, 90, 130, 160, 200, 235]
        holes = []
        fringe = []
        rim_px = []
        tiles = []
        for f in frames:
            src = os.path.join(OUT, f"{n}-mp4-{f}.png")
            mp4_frame(n, f)
            keyed = os.path.join(OUT, f"{n}-keyed-{f}.png")
            run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x808080:s=1280x720", "-i", src, "-filter_complex",
                 "[1:v]format=yuva444p,chromakey=0x00FF00:0.12:0.05[k];[0:v][k]overlay=format=auto,format=rgb24", "-frames:v", "1", keyed])
            alpha_p = os.path.join(OUT, f"{n}-alpha-{f}.png")
            run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", "format=yuva444p,chromakey=0x00FF00:0.12:0.05,alphaextract", "-frames:v", "1", alpha_p])
            alpha = np.asarray(Image.open(alpha_p).convert("L")).astype(int)
            k = np.asarray(Image.open(keyed).convert("RGB")).astype(int)
            s = still(n, f, os.path.join(OUT, f"{n}-key-src-{f}.png"))
            ink = np.any(np.abs(s - bg_of(n)) > 0, axis=2)
            # Solid interior of the marks: 3 px inside the antialiased edge
            inner = erode(ink, 3)
            holes.append(float((alpha[inner] < 128).mean()) if inner.any() else 0.0)
            # Fringe: keyed result pixels that are clearly green-tinted
            # Green-tinted pixels that are NOT on the outer 2 px antialiased rim of a mark
            # (the rim is unavoidable spill of a bare chromakey on 4:2:0 video; see README).
            g = (k[..., 1] - np.maximum(k[..., 0], k[..., 2]))
            rim = dilate(ink, 2) & ~erode(ink, 2)
            fringe.append(int(((g > 30) & ~rim).sum()))
            rim_px.append(int(((g > 30) & rim).sum()))
            tiles.append(keyed)
        # Same frames with ffmpeg's despill after the key (what any keyer's spill suppression does)
        desp = []
        for f in frames:
            src = os.path.join(OUT, f"{n}-mp4-{f}.png")
            dk = os.path.join(OUT, f"{n}-keyed-despill-{f}.png")
            run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x808080:s=1280x720", "-i", src, "-filter_complex",
                 "[1:v]format=yuva444p,chromakey=0x00FF00:0.12:0.05,despill=type=green[k];[0:v][k]overlay=format=auto,format=rgb24", "-frames:v", "1", dk])
            kd = np.asarray(Image.open(dk).convert("RGB")).astype(int)
            desp.append(int(((kd[..., 1] - np.maximum(kd[..., 0], kd[..., 2])) > 30).sum()))
        results.setdefault("key", {})[n] = dict(despill_green_px_max=max(desp), ok=max(holes) < 0.01 and max(fringe) < 50, hole_fraction_max=round(max(holes), 5), green_inside_px_max=max(fringe), rim_spill_px_max=max(rim_px))
        print("key", n, results["key"][n])
        run(["ffmpeg", "-v", "error", "-y", *sum([["-i", t] for t in tiles], []), "-filter_complex",
             "xstack=inputs=6:layout=0_0|w0_0|w0+w0_0|0_h0|w0_h0|w0+w0_h0,scale=1920:-1", os.path.join(OUT, f"{n}-keyed-sheet.png")])

# 5. boil cadence: which frames change vs the previous one
if check("boil"):
    for n in ["BoilArrow_Cream", "ChalkArrow_Curved", "ChalkHearts"]:
        files = seq(n, 0, 24, os.path.join(OUT, f"{n}-boil"))
        imgs = [np.asarray(Image.open(p).convert("RGB")).astype(int) for p in files]
        changed = [i for i in range(1, len(imgs)) if np.abs(imgs[i] - imgs[i - 1]).max() > 0]
        ok = changed == [i for i in range(1, 25) if i % 3 == 0]
        # How far the drawing moves between holds: shift of the ink's extents (left/right/top/bottom)
        ext = []
        for im in imgs[::3]:
            ink = np.any(np.abs(im - bg_of(n)) > 40, axis=2)
            ys, xs = np.nonzero(ink)
            ext.append(np.array([xs.min(), xs.max(), ys.min(), ys.max()]))
        jumps = [int(np.abs(ext[i] - ext[i - 1]).max()) for i in range(1, len(ext))]
        # Limit: 1% of the frame width at 720p (the boil is 0.6-1% of doodle size, plus drift)
        results.setdefault("boil", {})[n] = dict(ok=ok and max(jumps) <= 13, changed_frames=changed, max_extent_step_px=max(jumps))
        print("boil", n, results["boil"][n])

# 6. determinism: cold still of the middle frame vs the same frame inside a full sequence render
if check("det"):
    for n in ["DoodleFrame_Crayon", "BrushArrowPack_Black", "ChalkHearts"]:
        mid = 120 if n in PACKS else 150
        last = 239 if n in PACKS else 299
        files = seq(n, 0, last, os.path.join(OUT, f"{n}-full"))
        full = files[mid]
        cold = os.path.join(OUT, f"{n}-cold-{mid}.png")
        still(n, mid, cold)
        same_bytes = open(full, "rb").read() == open(cold, "rb").read()
        same_px = np.array_equal(np.asarray(Image.open(full)), np.asarray(Image.open(cold)))
        results.setdefault("det", {})[n] = dict(ok=same_bytes, bytes_equal=same_bytes, pixels_equal=same_px)
        print("det", n, results["det"][n])

with open(os.path.join(OUT, "results.json"), "w") as fh:
    json.dump(results, fh, indent=1)
