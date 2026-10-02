#!/usr/bin/env python3
"""Verify loop for the 1080p previews. Needs ffmpeg/ffprobe, numpy, pillow.

  python3 scripts/verify.py probe        # step 1  file checks
  python3 scripts/verify.py loop         # step 2  frame 0 vs frame 600 (601-frame comps) + seam motion
  python3 scripts/verify.py black        # step 3  corners / margins from the encoded mp4
  python3 scripts/verify.py determinism  # step 4  cold frame 150 vs frame 150 of the full render
  python3 scripts/verify.py banding      # step 5  pixel profiles from the encoded mp4
  python3 scripts/verify.py sheets       # step 6  five evenly spaced frames per preview
  python3 scripts/verify.py all
Optional second arg: regex filter on composition id.
"""
import hashlib
import json
import os
import re
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out")
WORK = os.path.join(ROOT, "renders", "verify")
os.makedirs(WORK, exist_ok=True)

COMPS = []
for line in open(os.path.join(ROOT, "scripts", "comps.txt")):
    if line.strip():
        cid, name, frames, kind = line.split()
        COMPS.append(dict(id=cid, name=name, frames=int(frames), loop=kind == "loop"))

FILTER = sys.argv[2] if len(sys.argv) > 2 else "."
COMPS = [c for c in COMPS if re.search(FILTER, c["id"])]


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, cwd=ROOT, **kw).stdout


def still(cid, frame, path, props=None):
    cmd = ["npx", "remotion", "still", cid, path, f"--frame={frame}", "--scale=0.5", "--log=error"]
    if props:
        cmd.append("--props=" + json.dumps(props))
    run(cmd)


def load(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(np.int32)


def mp4_frame(name, frame, path):
    run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(OUT, name + ".mp4"),
         "-vf", f"select=eq(n\\,{frame}),scale=in_color_matrix=bt709:in_range=tv:out_range=pc",
         "-frames:v", "1", "-update", "1", path])
    return load(path)


def probe():
    ok_all = True
    for c in COMPS:
        f = os.path.join(OUT, c["name"] + ".mp4")
        out = run(["ffprobe", "-v", "error", "-show_entries",
                   "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames",
                   "-show_entries", "format=duration", "-of", "json", f])
        j = json.loads(out)
        streams = j["streams"]
        v = [s for s in streams if s["codec_type"] == "video"][0]
        audio = [s for s in streams if s["codec_type"] == "audio"]
        dur = float(j["format"]["duration"])
        exp = c["frames"] / 30
        ok = (v["codec_name"] == "h264" and v["width"] == 1920 and v["height"] == 1080
              and v["r_frame_rate"] == "30/1" and v["pix_fmt"] == "yuv420p" and not audio
              and abs(dur - exp) < 0.001 and int(v["nb_frames"]) == c["frames"])
        ok_all &= ok
        print(f"{'PASS' if ok else 'FAIL'} {c['name']}: {v['codec_name']} {v['width']}x{v['height']} "
              f"{v['r_frame_rate']} {v['pix_fmt']} frames={v['nb_frames']} dur={dur:.3f}s audio={len(audio)}")
    return ok_all


def loop():
    ok_all = True
    for c in COMPS:
        if not c["loop"]:
            continue
        n = c["frames"]
        p = {"loopCheck": True}
        paths = {f: os.path.join(WORK, f"{c['name']}_loop{f}.png") for f in (0, n - 2, n - 1, n)}
        for f, path in paths.items():
            still(c["id"], f, path, p)
        a, b = load(paths[0]), load(paths[n])
        same = np.array_equal(a, b)
        # Seam: motion across the wrap (599→600≡0) should match motion inside the loop (598→599).
        seam = np.abs(load(paths[n - 1]) - a).mean()
        inner = np.abs(load(paths[n - 2]) - load(paths[n - 1])).mean()
        ratio = seam / max(inner, 1e-9)
        # Stricter: frame n computed WITHOUT wrapping the animation frame (grain still wrapped),
        # i.e. the motion formulas themselves evaluated at t = 1. Must match frame 0 up to float noise.
        nw = os.path.join(WORK, f"{c['name']}_nowrap{n}.png")
        still(c["id"], n, nw, {"loopCheck": True, "noWrap": True})
        u = load(nw)
        d = np.abs(u - a)
        one = os.path.join(WORK, f"{c['name']}_loop1.png")
        still(c["id"], 1, one, p)
        d1 = np.abs(load(one) - a)
        # Compare only animation, not grain: grain is identical between frame 0 and unwrapped n.
        unwrapped_ok = d.mean() < 0.1 * max(d1.mean(), 1e-9) or d.max() <= 2
        ok = same and 0.5 < ratio < 2.0 and unwrapped_ok
        ok_all &= ok
        print(f"{'PASS' if ok else 'FAIL'} {c['name']}: frame0 == frame{n}: {same} "
              f"(max diff {np.abs(a - b).max()}); seam motion {seam:.3f} vs in-loop {inner:.3f} (x{ratio:.2f}); "
              f"UNWRAPPED frame {n} vs 0: mean diff {d.mean():.4f}, max {d.max()}, "
              f"{(d.max(axis=2) > 0).mean() * 100:.3f}% px differ (one frame of motion: mean {d1.mean():.3f})")
    return ok_all


def black():
    ok_all = True
    for c in COMPS:
        if not re.match(r"EnergyOrb|CellDivision", c["id"]):
            continue
        for fr in (20, c["frames"] // 2, c["frames"] - 10):
            a = mp4_frame(c["name"], fr, os.path.join(WORK, f"{c['name']}_black{fr}.png"))
            h, w, _ = a.shape
            corners = [a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]]
            cmax = max(int(x.max()) for x in corners)
            bw = int(w * 0.12)
            bh = int(h * 0.1)
            margin = np.concatenate([a[:, :bw].reshape(-1, 3), a[:, -bw:].reshape(-1, 3),
                                     a[:bh].reshape(-1, 3), a[-bh:].reshape(-1, 3)])
            mmax = int(margin.max())
            nz = float((margin.max(axis=1) > 0).mean() * 100)
            ok = cmax <= 1 and mmax <= 1
            ok_all &= ok
            print(f"{'PASS' if ok else 'FAIL'} {c['name']} frame {fr}: corners max {cmax}, "
                  f"outer margins max {mmax} ({nz:.3f}% px non-zero)")
    return ok_all


def determinism():
    ok_all = True
    for c in COMPS:
        full = os.path.join(ROOT, "renders", "frame150", c["name"] + "_full.png")
        if not os.path.exists(full):
            print(f"SKIP {c['name']}: no full-render frame 150 yet")
            continue
        cold = os.path.join(WORK, c["name"] + "_cold150.png")
        still(c["id"], 150, cold)
        a, b = load(full), load(cold)
        same_px = np.array_equal(a, b)
        ha = hashlib.sha256(a.tobytes()).hexdigest()[:16]
        hb = hashlib.sha256(b.tobytes()).hexdigest()[:16]
        ok_all &= same_px
        print(f"{'PASS' if same_px else 'FAIL'} {c['name']}: pixels sha256 full={ha} cold={hb}"
              + ("" if same_px else f" max diff {np.abs(a - b).max()} on {(np.abs(a - b).max(axis=2) > 0).mean() * 100:.3f}% px"))
    return ok_all


# Lines that cross glow falloffs / cloud gradients (fractions of width/height).
BAND_LINES = {
    "GalaxySpiral": [("row", 0.15, 0.0, 1.0), ("col", 0.5, 0.0, 0.42), ("row", 0.45, 0.5, 0.95)],
    "ParticleWorldMap": [("col", 0.5, 0.0, 0.2), ("row", 0.06, 0.0, 1.0), ("row", 0.92, 0.0, 1.0)],
    "NebulaCore": [("row", 0.5, 0.5, 1.0), ("col", 0.5, 0.0, 0.5), ("row", 0.2, 0.0, 1.0)],
}


def banding():
    ok_all = True
    for c in COMPS:
        key = c["id"].split("-")[0]
        if key not in BAND_LINES or not re.search(r"GalaxySpiral-Blue|ParticleWorldMap-Blue|NebulaCore", c["id"]):
            continue
        fr = {"GalaxySpiral": 300, "ParticleWorldMap": 60, "NebulaCore": 300}[key]
        a = mp4_frame(c["name"], fr, os.path.join(WORK, f"{c['name']}_band{fr}.png"))
        h, w, _ = a.shape
        lum = a @ np.array([2126, 7152, 722]) / 10000.0
        for kind, pos, s, e in BAND_LINES[key]:
            if kind == "row":
                y = int(pos * (h - 1))
                band = lum[max(0, y - 2):y + 3, int(s * (w - 1)):int(e * (w - 1))].mean(axis=0)
                raw = np.round(lum[y, int(s * (w - 1)):int(e * (w - 1))])
            else:
                x = int(pos * (w - 1))
                band = lum[int(s * (h - 1)):int(e * (h - 1)), max(0, x - 2):x + 3].mean(axis=1)
                raw = np.round(lum[int(s * (h - 1)):int(e * (h - 1)), x])
            # Longest run of one identical code value on the raw line: banding shows as long flat runs.
            runs, cur = [], 1
            for i in range(1, len(raw)):
                if raw[i] == raw[i - 1]:
                    cur += 1
                else:
                    runs.append(cur)
                    cur = 1
            runs.append(cur)
            longest = max(runs)
            # Smoothed profile (box 16): step = biggest jump between neighbouring 16-px means.
            k = 16
            m = np.convolve(band, np.ones(k) / k, mode="valid")[::k]
            step = float(np.abs(np.diff(m)).max()) if len(m) > 1 else 0.0
            ok = longest <= 12
            ok_all &= ok
            prof = " ".join(f"{v:.0f}" for v in m[:: max(1, len(m) // 14)])
            print(f"{'PASS' if ok else 'FAIL'} {c['name']} f{fr} {kind}@{pos}: longest flat run {longest}px, "
                  f"max 16px-mean step {step:.2f} codes | profile {prof}")
    return ok_all


def sheets():
    d = os.path.join(OUT, "contact-sheets")
    os.makedirs(d, exist_ok=True)
    for c in COMPS:
        n = c["frames"]
        frames = [round(i * (n - 1) / 4) for i in range(5)]
        sel = "+".join(f"eq(n\\,{f})" for f in frames)
        run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(OUT, c["name"] + ".mp4"),
             "-vf", f"select='{sel}',scale=640:-1,tile=5x1", "-frames:v", "1", "-update", "1",
             os.path.join(d, c["name"] + ".jpg")])
        print(f"sheet {c['name']}: frames {frames}")
    return True


STEPS = dict(probe=probe, loop=loop, black=black, determinism=determinism, banding=banding, sheets=sheets)

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    names = list(STEPS) if which == "all" else [which]
    results = {}
    for nm in names:
        print(f"== {nm} ==")
        results[nm] = STEPS[nm]()
    print("== summary ==", {k: ("PASS" if v else "FAIL") for k, v in results.items()})
