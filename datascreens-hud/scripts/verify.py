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
        # gradients: take smooth profiles along lines in background-dominated areas and look for steps
        lines = []
        if i.startswith("VitalMonitor"):
            lines = [("h", int(H * 0.36), 0, int(W * 0.7)), ("h", int(H * 0.92), int(W * 0.1), int(W * 0.6))]
        elif i.startswith("HUDTunnel"):
            lines = [("h", H // 2, int(W * 0.40), int(W * 0.60)), ("v", W // 2, int(H * 0.36), int(H * 0.64))]
        else:
            lines = [("v", int(W * 0.5), 0, H), ("v", int(W * 0.2), 0, H)]
        worst = 0.0
        notes = []
        for kind, at, a, b in lines:
            pr = profile(img, at, kind == "h", a, b, band=6)
            lum = pr.mean(axis=1)
            # local means over 16 px windows; adjacent window means should differ smoothly
            n = len(lum) // 16
            wm = lum[: n * 16].reshape(n, 16).mean(axis=1)
            d2 = np.abs(np.diff(wm, 2))  # second difference: steps show up as spikes
            # ignore windows touching content (big local variance)
            var = lum[: n * 16].reshape(n, 16).std(axis=1)
            okw = (var[1:-1] < 3.0)
            spike = float(d2[okw].max()) if okw.any() else 0.0
            worst = max(worst, spike)
            notes.append(f"{kind}@{at}: {wm[0]:.1f}->{wm[-1]:.1f}, max 2nd-diff {spike:.2f} over {int(okw.sum())} clean windows")
        report("4-banding", i, worst < 1.0, "; ".join(notes))


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
