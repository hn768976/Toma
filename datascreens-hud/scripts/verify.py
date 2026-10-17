#!/usr/bin/env python3
"""Verify loop for the 7 previews (steps 1-4 and 6 of the brief).

Usage: python3 scripts/verify.py [step ...] [--ids id1,id2]
Steps: probe loop determinism banding sheets   (default: all)
Needs ffmpeg/ffprobe, numpy and Pillow. Run from the project root.
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "renders")
WORK = os.path.join(OUT, "verify")
SCALE = "0.3333333333333333"
IDS = [
    "DataScreens-WhiteOverlay",
    "VitalMonitor-Teal",
    "VitalMonitor-Green",
    "HUDTunnel-Blue",
    "PeopleNetwork-Navy",
    "PeopleNetwork-White",
    "HUDFrame-WhiteOverlay",
]
OVERLAYS = {"DataScreens-WhiteOverlay", "HUDFrame-WhiteOverlay"}


def mp4(i):
    return os.path.join(OUT, i.replace("-", "_", 1) + ".mp4")


def run(cmd, env=None, **kw):
    e = dict(os.environ)
    if env:
        e.update(env)
    return subprocess.run(cmd, cwd=ROOT, env=e, check=True, capture_output=True, text=True, **kw)


def still(i, frame, path, env=None):
    run(["npx", "remotion", "still", "src/index.ts", i, path, f"--frame={frame}", f"--scale={SCALE}", "--log=error"], env=env)


def mp4_frame(i, frame, path):
    run(["ffmpeg", "-v", "error", "-y", "-i", mp4(i), "-vf", f"select=eq(n\\,{frame})", "-vsync", "0", "-frames:v", "1", path])


def load(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(np.int32)


results = {}


def report(step, i, ok, detail):
    results.setdefault(step, {})[i] = {"ok": bool(ok), "detail": detail}
    print(f"[{step}] {'PASS' if ok else 'FAIL'} {i}: {detail}", flush=True)


def step_probe(ids):
    for i in ids:
        r = run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames",
                 "-show_entries", "format=duration", "-of", "json", mp4(i)])
        d = json.loads(r.stdout)
        streams = d["streams"]
        v = [s for s in streams if s["codec_type"] == "video"]
        a = [s for s in streams if s["codec_type"] == "audio"]
        dur = float(d["format"]["duration"])
        s = v[0]
        ok = (len(v) == 1 and not a and s["width"] == 1280 and s["height"] == 720 and s["r_frame_rate"] == "30/1"
              and s["codec_name"] == "h264" and s["pix_fmt"] == "yuv420p" and abs(dur - 20.0) < 0.001 and s.get("nb_frames") == "600")
        report("1-probe", i, ok, f"{s['codec_name']} {s['width']}x{s['height']} {s['r_frame_rate']} {s['pix_fmt']} audio={len(a)} "
               f"duration={dur}s frames={s.get('nb_frames')}")


def step_loop(ids):
    env = {"REMOTION_LOOP_CHECK": "1"}  # 601-frame compositions
    for i in ids:
        a = os.path.join(WORK, f"{i}_f000.png")
        b = os.path.join(WORK, f"{i}_f600.png")
        still(i, 0, a, env)
        still(i, 600, b, env)
        x, y = load(a), load(b)
        diff = int(np.abs(x - y).max())
        report("2-loop", i, diff == 0, f"frame 0 vs 600 max pixel diff = {diff}")


def step_determinism(ids):
    for i in ids:
        cold = os.path.join(WORK, f"{i}_cold300.png")
        still(i, 300, cold)
        seq = os.path.join(WORK, f"{i}_seq")
        os.makedirs(seq, exist_ok=True)
        # frames 240-300 rendered in order by one tab: state from earlier frames is present
        run(["npx", "remotion", "render", "src/index.ts", i, seq, "--sequence", "--frames=240-300", "--image-format=png",
             "--concurrency=1", f"--scale={SCALE}", "--log=error"])
        names = sorted(n for n in os.listdir(seq) if n.endswith(".png"))
        warm = os.path.join(seq, names[-1])
        same_bytes = open(cold, "rb").read() == open(warm, "rb").read()
        diff = int(np.abs(load(cold) - load(warm)).max())
        report("3-determinism", i, same_bytes and diff == 0,
               f"cold still vs frame 300 after 240-299 in sequence: bytes identical={same_bytes}, max pixel diff={diff}")


def profile(img, axis_line, horizontal=True, x0=0, x1=None, band=5):
    """mean over a thin band of rows (or columns), returns 1D profile of luminance-ish green+red+blue"""
    if horizontal:
        sl = img[axis_line - band: axis_line + band + 1, x0:x1]
        return sl.mean(axis=0)
    sl = img[x0:x1, axis_line - band: axis_line + band + 1]
    return sl.mean(axis=1)


def step_banding(ids):
    for i in ids:
        p = os.path.join(WORK, f"{i}_mp4_f150.png")
        mp4_frame(i, 150, p)
        img = load(p)
        H, W, _ = img.shape
        if i in OVERLAYS:
            # 50 points away from content: >= 24 px from any pixel brighter than 6
            src = os.path.join(WORK, f"{i}_src150.png")
            still(i, 150, src)
            s = load(src).max(axis=2)
            mask = s > 6
            # dilate by 24 px with a box filter via cumulative sums
            k = 24
            m = mask.astype(np.int32)
            c = np.pad(m, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
            ys, xs = np.arange(H), np.arange(W)
            y0 = np.clip(ys - k, 0, H)[:, None]
            y1 = np.clip(ys + k + 1, 0, H)[:, None]
            x0 = np.clip(xs - k, 0, W)[None, :]
            x1 = np.clip(xs + k + 1, 0, W)[None, :]
            near = (c[y1, x1] - c[y0, x1] - c[y1, x0] + c[y0, x0]) > 0
            cand = np.argwhere(~near)
            rng = np.random.default_rng(7)
            pts = cand[rng.choice(len(cand), size=min(50, len(cand)), replace=False)] if len(cand) else []
            vals = np.array([img[y, x] for y, x in pts])
            mx = int(vals.max()) if len(vals) else -1
            report("4-black", i, len(pts) == 50 and mx <= 1,
                   f"{len(pts)} points >=24px from content in the encoded mp4: max channel value {mx}, "
                   f"mean {vals.mean():.3f} (candidates {len(cand)})")
            continue
        # Gradients: look only at content-free background tiles (48x48). A tile is kept when
        # a plane fit leaves only noise-level residual (no content). Within kept tiles we
        # 5x5-box-mean the image (removes dither/grain) and measure the largest step between
        # neighbouring pixels: a smooth 8-bit gradient steps by at most 1 code value; banding
        # from a too-coarse pipeline shows multi-level steps. Run length of equal values is
        # reported for information (long runs = 1-code quantization, the 8-bit floor).
        T = 48
        yy, xx = np.mgrid[0:T, 0:T]
        A = np.stack([xx.ravel(), yy.ravel(), np.ones(T * T)], 1).astype(float)
        tol_std, tol_max = (5.0, 16) if i.startswith("HUDTunnel") else (2.0, 7)
        runs, means, steps, kept = [], [], [], 0
        for ty in range(0, H - T + 1, T):
            for tx in range(0, W - T + 1, T):
                tile = img[ty:ty + T, tx:tx + T].astype(float)
                ok = True
                tr = []
                for ch in range(3):
                    v = tile[:, :, ch].ravel()
                    coef, *_ = np.linalg.lstsq(A, v, rcond=None)
                    res = v - A @ coef
                    if res.std() > tol_std or np.abs(res).max() > tol_max:
                        ok = False
                        break
                    rows = tile[:, :, ch]
                    nchg = (np.diff(rows, axis=1) != 0).sum(axis=1) + 1
                    tr.append(float((T / nchg).mean()))
                if not ok:
                    continue
                kept += 1
                runs.append(max(tr))
                means.append(tile.mean(axis=(0, 1)))
                m = tile.mean(axis=2)
                # 5x5 box mean: averages out dither and the 1% grain, keeps band edges
                med = np.mean(np.stack([m[dy:T - 4 + dy, dx:T - 4 + dx] for dy in range(5) for dx in range(5)]), axis=0)
                steps.append(np.abs(np.diff(med, axis=0)).ravel())
                steps.append(np.abs(np.diff(med, axis=1)).ravel())
        if i.startswith("HUDTunnel"):
            # dense content: use the radial background gradient instead. Median of each
            # 2-px ring around the centre; content is additive (only brightens), so the 10th
            # percentile of each ring is background. The ring values must
            # step by at most ~1 code value from ring to ring.
            yy2, xx2 = np.mgrid[0:H, 0:W]
            rad = np.hypot(xx2 - W / 2, yy2 - H / 2)
            lum = img.mean(axis=2)
            prof = []
            for r0 in range(0, 340, 2):
                sel = (rad >= r0) & (rad < r0 + 2)
                prof.append(np.percentile(lum[sel], 10))  # additive content only brightens
            prof = np.array(prof)
            # HUD rings and their glow cover whole annuli at some radii. All content is
            # additive (only brightens), so a running minimum over 31 rings (62 px) is the
            # background's lower envelope; its ring-to-ring steps must stay ~1 code value.
            k = 15
            pad = np.pad(prof, k, mode="edge")
            env = np.array([pad[j:j + 2 * k + 1].min() for j in range(len(prof))])
            dif = np.abs(np.diff(env))
            report("4-banding", i, float(dif.max()) <= 2.0,
                   f"radial background (lower envelope of 10th-pct ring values, r=0..340px): {env[0]:.1f} -> {env[-1]:.1f}; "
                   f"largest ring-to-ring step {dif.max():.2f} code values over {len(env)} rings")
            continue
        if kept == 0:
            report("4-banding", i, False, "no content-free tiles found")
            continue
        runs = np.array(runs)
        means = np.array(means)
        span = means.max(axis=0) - means.min(axis=0)
        d = np.concatenate(steps)
        p999 = float(np.percentile(d, 99.9))
        report("4-banding", i, p999 <= 1.0,
               f"{kept} background tiles (gradient span R/G/B {span[0]:.1f}/{span[1]:.1f}/{span[2]:.1f} levels): "
               f"neighbour steps after 5x5 mean: 99.9th pct {p999:.2f}, max {d.max():.2f} code values, "
               f"{100 * (d > 1).mean():.2f}% of steps > 1 code; equal-value runs mean {runs.mean():.1f}px, max {runs.max():.1f}px")


def step_sheets(ids):
    for i in ids:
        out = os.path.join(OUT, f"{i.replace('-', '_', 1)}_contact.png")
        run(["ffmpeg", "-v", "error", "-y", "-i", mp4(i), "-vf",
             "select='eq(n\\,0)+eq(n\\,120)+eq(n\\,240)+eq(n\\,360)+eq(n\\,480)+eq(n\\,599)',scale=640:360,tile=3x2:padding=4",
             "-vsync", "0", "-frames:v", "1", out])
        report("6-sheet", i, True, out)


STEPS = {"probe": step_probe, "loop": step_loop, "determinism": step_determinism, "banding": step_banding, "sheets": step_sheets}

if __name__ == "__main__":
    args = sys.argv[1:]
    ids = IDS
    if "--ids" in args:
        k = args.index("--ids")
        ids = args[k + 1].split(",")
        args = args[:k] + args[k + 2:]
    steps = args or list(STEPS)
    os.makedirs(WORK, exist_ok=True)
    for s in steps:
        STEPS[s](ids)
    path = os.path.join(OUT, "verify-results.json")
    old = json.load(open(path)) if os.path.exists(path) else {}
    for k, v in results.items():
        old.setdefault(k, {}).update(v)
    json.dump(old, open(path, "w"), indent=2)
