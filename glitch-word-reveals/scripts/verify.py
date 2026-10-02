#!/usr/bin/env python3
"""Pixel checks for the verify loop. Needs numpy + Pillow, and ffmpeg/ffprobe.

  python3 scripts/verify.py probe   out/previews/*.mp4
  python3 scripts/verify.py fit     out/stills-1080p
  python3 scripts/verify.py readable out/previews/X.mp4 A|B
  python3 scripts/verify.py every15 out/previews/X.mp4 A|B
  python3 scripts/verify.py banding out/previews/DataRain_GENERATIVE_AI.mp4
"""
import glob
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image


def frame_from_mp4(path, n):
    """Decode exactly frame n (0-based) of the encoded file to an RGB array."""
    with tempfile.TemporaryDirectory() as d:
        out = os.path.join(d, "f.png")
        subprocess.run(
            ["ffmpeg", "-v", "error", "-i", path, "-vf", f"select=eq(n\\,{n})",
             "-vsync", "0", "-frames:v", "1", out, "-y"], check=True)
        return np.asarray(Image.open(out).convert("RGB")).astype(np.int32)


def frames_from_mp4(path, ns):
    """Decode several frames in ONE pass. Returns {n: RGB array}."""
    ns = sorted(set(ns))
    expr = "+".join(f"eq(n\\,{n})" for n in ns)
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(
            ["ffmpeg", "-v", "error", "-i", path, "-vf", f"select={expr}",
             "-vsync", "0", os.path.join(d, "f%04d.png"), "-y"], check=True)
        files = sorted(glob.glob(os.path.join(d, "f*.png")))
        return {n: np.asarray(Image.open(f).convert("RGB")).astype(np.int32)
                for n, f in zip(ns, files)}


def word_mask(img, style):
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    h = img.shape[0]
    if style == "A":  # white letters
        m = (r > 215) & (g > 215) & (b > 215)
    else:  # cyan letters: strong G and B
        m = (g > 175) & (b > 205) & (r < 215)
    band = np.zeros_like(m)
    band[int(h * 0.38): int(h * 0.62)] = True  # word is centred; ignore stray sparks
    return m & band


def bbox(mask, min_count=2):
    cols = np.where(mask.sum(0) >= min_count)[0]
    rows = np.where(mask.sum(1) >= min_count)[0]
    if len(cols) == 0:
        return None
    return cols[0], cols[-1], rows[0], rows[-1]


def cmd_probe(files):
    ok = True
    for f in files:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries",
             "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames",
             "-show_entries", "format=duration", "-of", "json", f],
            capture_output=True, text=True, check=True).stdout
        j = json.loads(out)
        streams = j["streams"]
        v = [s for s in streams if s["codec_type"] == "video"]
        a = [s for s in streams if s["codec_type"] == "audio"]
        s = v[0]
        dur = float(j["format"]["duration"])
        checks = {
            "1920x1080": (s["width"], s["height"]) == (1920, 1080),
            "30/1": s["r_frame_rate"] == "30/1",
            "10.0s": abs(dur - 10.0) < 0.01,
            "h264": s["codec_name"] == "h264",
            "yuv420p": s["pix_fmt"] == "yuv420p",
            "no audio": len(a) == 0,
            "300 frames": s.get("nb_frames") == "300",
        }
        ok &= all(checks.values())
        print(os.path.basename(f), f"{s['width']}x{s['height']} {s['r_frame_rate']} {dur:.3f}s "
              f"{s['codec_name']} {s['pix_fmt']} frames={s.get('nb_frames')} audio={len(a)}",
              "PASS" if all(checks.values()) else f"FAIL {[k for k, v in checks.items() if not v]}")
    return ok


def cmd_fit(stills_dir):
    rep = {r["id"]: r for r in json.load(open(os.path.join(stills_dir, "layout-report.json")))}
    ok = True
    heights = {"A": [], "B": []}
    for f in sorted(glob.glob(os.path.join(stills_dir, "*_f200.png"))):
        name = os.path.basename(f)[:-9]
        style = "A" if name.startswith("Attack") else "B"
        img = np.asarray(Image.open(f).convert("RGB")).astype(np.int32)
        H, W = img.shape[:2]
        bb = bbox(word_mask(img, style))
        x0, x1, y0, y1 = bb
        width = (x1 - x0 + 1) / W
        cx = ((x0 + x1) / 2) / W
        # cap height from the rows where most columns hit (ignores Q's tail)
        rows = word_mask(img, style)[:, x0:x1 + 1].sum(1)
        strong = np.where(rows > 0.25 * rows.max())[0]
        cap = (strong[-1] - strong[0] + 1) / H
        layout = rep[name.replace("_", "-", 1).replace("_", "-")]
        heights[style].append((cap, layout["scaledDown"], name))
        good = width <= 0.88 + 0.002 and abs(cx - 0.5) < 0.01 and x0 > 0 and x1 < W - 1
        ok &= good
        print(f"{name:34s} ink width {width:.3f} of frame, centre x {cx:.3f}, "
              f"cap {cap:.4f}H, scaledDown={layout['scaledDown']} {'PASS' if good else 'FAIL'}")
    for st, hs in heights.items():
        full = [h for h, s, _ in hs if not s]
        print(f"Style {st}: cap height of full-size words {min(full):.4f}..{max(full):.4f} H "
              f"(spread {max(full) - min(full):.4f})")
    return ok


def cmd_readable(mp4, style):
    # Sample every 7th frame from 100 on. A frame counts as readable when its
    # word mask matches a neighbour 4 or 8 frames away (IoU > 0.8): a glitch
    # burst lasts 2-4 frames, so a glitched frame matches neither neighbour.
    frames = list(range(100, 300, 7))
    need = set(frames)
    for f in frames:
        need.update(g for g in (f - 4, f + 4, f - 8, f + 8) if 0 <= g < 300)
    imgs = frames_from_mp4(mp4, need)
    masks = {n: word_mask(im, style) for n, im in imgs.items()}
    good = 0
    lines = []
    for f in frames:
        m = masks[f]
        best = 0
        for g in (f - 4, f + 4, f - 8, f + 8):
            if g in masks:
                m2 = masks[g]
                best = max(best, (m & m2).sum() / max((m | m2).sum(), 1))
        readable = best > 0.80
        good += readable
        lines.append(f"f{f}:{best:.2f}{'' if readable else '*'}")
    print(" ".join(lines))
    ratio = good / len(frames)
    print(f"readable {good}/{len(frames)} = {ratio:.0%} (need >= 80%)")
    return ratio >= 0.8


def cmd_every15(mp4, style, outdir):
    os.makedirs(outdir, exist_ok=True)
    start = 90 if style == "A" else 80
    widths = []
    for f in range(0, 300, 15):
        img = frame_from_mp4(mp4, f)
        Image.fromarray(img.astype(np.uint8)).save(os.path.join(outdir, f"f{f:03d}.png"))
        bb = bbox(word_mask(img, style))
        w = 0 if bb is None else (bb[1] - bb[0] + 1)
        if f >= start:
            widths.append((f, w))
        print(f"f{f:03d} word ink width {w}px")
    ws = [w for _, w in widths]
    print(f"hold frames: width {min(ws)}..{max(ws)}px")
    return min(ws) > 0


def cmd_banding(mp4, out_png):
    img = frame_from_mp4(mp4, 200)
    Image.fromarray(img.astype(np.uint8)).save(out_png)
    H, W = img.shape[:2]
    lum = 0.2126 * img[..., 0] + 0.7152 * img[..., 1] + 0.0722 * img[..., 2]
    yy, xx = np.mgrid[0:H, 0:W]
    cy, cx = (H - 1) / 2, (W - 1) / 2
    # Elliptical radius matching the gradient's aspect, so each ring is one
    # gradient level. Exclude the word's band.
    rr = np.sqrt(((xx - cx) / (W / 2)) ** 2 + ((yy - cy) / (H / 2)) ** 2)
    keep = np.abs(yy - cy) > 0.09 * H
    nb = 220
    edges = np.linspace(0.18, 1.0, nb + 1)
    idx = np.digitize(rr, edges) - 1
    prof = []
    for k in range(nb):
        v = lum[(idx == k) & keep]
        lo, hi = np.percentile(v, [10, 60])  # trimmed: drops characters & bokeh
        prof.append(v[(v >= lo) & (v <= hi)].mean())
    prof = np.array(prof)
    d = np.diff(prof)
    print("radius -> background luminance (trimmed mean, 0-255):")
    print(" ".join(f"{edges[k]:.2f}:{prof[k]:.2f}" for k in range(0, nb, 11)))
    # A band edge shows up as a single-ring jump much larger than the local
    # slope, next to flat runs. Compare each step to the median of its neighbours.
    worst = 0
    for k in range(3, len(d) - 3):
        local = np.median(np.abs(np.r_[d[k - 3:k], d[k + 1:k + 4]]))
        worst = max(worst, abs(d[k]) - local)
    flat = 0
    run = 0
    for k in range(len(d)):
        run = run + 1 if abs(d[k]) < 0.02 else 0
        flat = max(flat, run)
    print(f"largest step beyond local slope: {worst:.2f} levels; longest flat run: {flat} rings")
    smooth = worst < 0.6 and flat < 8
    print("SMOOTH" if smooth else "STEPS (banding)")
    return smooth


if __name__ == "__main__":
    c = sys.argv[1]
    if c == "probe":
        r = cmd_probe(sys.argv[2:])
    elif c == "fit":
        r = cmd_fit(sys.argv[2])
    elif c == "readable":
        r = cmd_readable(sys.argv[2], sys.argv[3])
    elif c == "every15":
        r = cmd_every15(sys.argv[2], sys.argv[3], sys.argv[4])
    elif c == "banding":
        r = cmd_banding(sys.argv[2], sys.argv[3])
    sys.exit(0 if r else 1)
