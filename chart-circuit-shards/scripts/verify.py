#!/usr/bin/env python3
"""Verification checks for the rendered previews (steps 1-6 of the brief).

usage:
  python3 scripts/verify.py probe                 # step 1: ffprobe every out/*.mp4
  python3 scripts/verify.py loop <dir>            # step 2: compare <id>_0000.png vs <id>_0600.png in dir
  python3 scripts/verify.py black                 # step 3: empty areas of the shards mp4s are 0,0,0 (<=1)
  python3 scripts/verify.py determinism <dir>     # step 4: cold frame-150 stills in dir vs out/frames/<id>/element-150.png
  python3 scripts/verify.py banding               # step 5: smoothness of gradients/glows in decoded mp4 frames
  python3 scripts/verify.py sheets                # step 6: 5 evenly spaced frames per mp4 -> out/check/<id>_sheet.png

Needs ffmpeg/ffprobe, numpy and Pillow.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
IDS = [
    "GrowthChart3D_Up", "GrowthChart3D_Down", "CircuitFlythrough_Blue", "NeonShards_Blue",
    "NeonShards_Magenta", "CPUBoard_BlueSilver", "LaserPanels_CyanPurple", "LaserPanels_OrangeRed",
]
LOOPING = [i for i in IDS if not i.startswith("GrowthChart3D")]
DURATION = {i: (12.0 if i.startswith("GrowthChart3D") else 20.0) for i in IDS}


def decode_frame(mp4: Path, frame: int) -> np.ndarray:
    """Decode one frame of an mp4 to RGB (bt709, limited range, like a player)."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(mp4), "-vf",
         f"select=eq(n\\,{frame}),scale=in_color_matrix=bt709:in_range=tv,format=rgb24",
         "-frames:v", "1", "-f", "rawvideo", "-"],
        check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(720, 1280, 3)


def probe():
    ok_all = True
    for i in IDS:
        f = OUT / f"{i}.mp4"
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries",
             "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames",
             "-show_entries", "format=duration", "-of", "json", str(f)],
            check=True, capture_output=True, text=True)
        j = json.loads(r.stdout)
        streams = j["streams"]
        v = [s for s in streams if s["codec_type"] == "video"]
        a = [s for s in streams if s["codec_type"] == "audio"]
        dur = float(j["format"]["duration"])
        s = v[0]
        ok = (len(v) == 1 and not a and s["codec_name"] == "h264" and s["width"] == 1280 and s["height"] == 720
              and s["r_frame_rate"] == "30/1" and s["pix_fmt"] == "yuv420p" and abs(dur - DURATION[i]) < 0.02)
        ok_all &= ok
        print(f"{'PASS' if ok else 'FAIL'} {i}: {s['codec_name']} {s['width']}x{s['height']} {s['r_frame_rate']} "
              f"{s['pix_fmt']} frames={s.get('nb_frames')} duration={dur:.3f}s audio_streams={len(a)}")
    return ok_all


def loop(d):
    ok_all = True
    for i in LOOPING:
        c = i.replace("_", "-")
        a = np.asarray(Image.open(Path(d) / f"{c}_0000.png").convert("RGB")).astype(int)
        b = np.asarray(Image.open(Path(d) / f"{c}_0600.png").convert("RGB")).astype(int)
        diff = np.abs(a - b)
        ok = diff.max() == 0
        ok_all &= ok
        print(f"{'PASS' if ok else 'FAIL'} {i}: frame 0 vs 600 max diff {diff.max()}, differing pixels {(diff.max(axis=2) > 0).sum()}")
    return ok_all


def black():
    ok_all = True
    for i in ["NeonShards_Blue", "NeonShards_Magenta"]:
        for fr in [0, 150, 300, 450]:
            dec = decode_frame(OUT / f"{i}.mp4", fr)
            src = np.asarray(Image.open(OUT / "frames" / i / f"element-{fr:03d}.png").convert("RGB")).astype(int)
            # "empty" = background with nothing in it in the lossless render, at
            # least 8 px from any lit pixel (chroma subsampling bleeds ~2 px)
            lit = src.max(axis=2) > 0
            from scipy.ndimage import binary_dilation  # noqa: WPS433
            empty = ~binary_dilation(lit, iterations=8)
            vals = dec[empty]
            mx = int(vals.max()) if vals.size else -1
            src_empty_max = int(src[~lit].max()) if (~lit).any() else -1
            ok = mx <= 1 and src_empty_max == 0
            ok_all &= ok
            print(f"{'PASS' if ok else 'FAIL'} {i} frame {fr}: empty area {empty.mean() * 100:.1f}% of frame, "
                  f"lossless max {src_empty_max}, decoded mp4 max {mx}, decoded mean {vals.mean():.4f}")
    return ok_all


def determinism(d):
    ok_all = True
    for i in IDS:
        c = i.replace("_", "-")
        cold = Path(d) / f"{c}_0150.png"
        full = OUT / "frames" / i / "element-150.png"
        a = np.asarray(Image.open(cold).convert("RGBA"))
        b = np.asarray(Image.open(full).convert("RGBA"))
        same_pixels = a.shape == b.shape and a.tobytes() == b.tobytes()
        same_file = cold.read_bytes() == full.read_bytes()
        ok_all &= same_pixels
        print(f"{'PASS' if same_pixels else 'FAIL'} {i}: frame 150 cold vs full render: pixel bytes identical={same_pixels}, "
              f"PNG file bytes identical={same_file}")
    return ok_all


def box(x, n):
    return np.convolve(x, np.ones(n) / n, mode="same")


def find_gradient_segments(gray, n=4, seg=160, band=8):
    """Smooth, detail-free horizontal segments that still carry a gradient
    (glow halos, haze, sky): low high-frequency energy, >= 3 levels of range."""
    cands = []
    h, w = gray.shape
    for y in range(band, h - band, 12):
        row = gray[y - band // 2: y + band // 2].mean(axis=0)
        for x in range(0, w - seg, 40):
            s = row[x:x + seg]
            sm = box(s, 31)[16:-16]
            hf = float(np.std(s[16:-16] - sm))
            rng = float(sm.max() - sm.min())
            if rng >= 3 and hf < 1.2:
                cands.append((hf / rng, y, x))
    cands.sort()
    out = []
    for _, y, x in cands:
        if all(abs(y - y2) > 40 or abs(x - x2) > seg for y2, x2 in out):
            out.append((y, x))
        if len(out) == n:
            break
    return out


def plateau_stats(img, y, x, seg=160, band=8):
    """Band-averaged profile across a gradient. Quantisation banding shows as
    runs where every row in the band has the same integer value (average is an
    exact integer and constant); dithered gradients never sit on one integer."""
    g = img[y - band // 2: y + band // 2, x:x + seg].astype(float).mean(axis=2)  # mean of RGB per pixel
    col = g.mean(axis=0)
    flat_exact = np.all(np.abs(g - np.round(g[0:1])) < 1e-9, axis=0)  # whole column one identical value
    longest, run = 0, 0
    for i in range(1, seg):
        if flat_exact[i] and flat_exact[i - 1] and abs(col[i] - col[i - 1]) < 1e-9:
            run += 1
            longest = max(longest, run)
        else:
            run = 0
    steps = np.abs(np.diff(box(col, 5)[3:-3]))
    return col, longest, float(steps.max())


def banding():
    cases = [("GrowthChart3D_Up", 300), ("CircuitFlythrough_Blue", 300), ("CPUBoard_BlueSilver", 300), ("LaserPanels_CyanPurple", 300)]
    ok_all = True
    OUTC = OUT / "check"
    OUTC.mkdir(parents=True, exist_ok=True)
    for i, fr in cases:
        img = decode_frame(OUT / f"{i}.mp4", fr)
        Image.fromarray(img).save(OUTC / f"{i}_decoded_{fr}.png")
        gray = img.astype(float).mean(axis=2)
        segs = find_gradient_segments(gray)
        if i.startswith("GrowthChart3D"):
            segs = [(30, 40), (90, 40), (60, 1040), (150, 1080)] + segs[:2]  # sky + haze, plus auto picks
        for y, x in segs:
            col, longest, step = plateau_stats(img, y, x)
            ok = longest < 6
            ok_all &= ok
            print(f"{'PASS' if ok else 'FAIL'} {i} f{fr} row {y} x {x}-{x + 160}: values {np.round(col[::20], 2).tolist()} | "
                  f"longest identical-integer plateau {longest} px, max smoothed step {step:.2f}")
    return ok_all


def sheets():
    OUTC = OUT / "check"
    OUTC.mkdir(parents=True, exist_ok=True)
    for i in IDS:
        n = int(DURATION[i] * 30)
        frames = [int(round(k * (n - 1) / 4)) for k in range(5)]
        tiles = [Image.fromarray(decode_frame(OUT / f"{i}.mp4", f)).resize((640, 360)) for f in frames]
        sheet = Image.new("RGB", (640, 360 * 5))
        for k, t in enumerate(tiles):
            sheet.paste(t, (0, 360 * k))
        sheet.save(OUTC / f"{i}_sheet.png")
        print(f"{i}: frames {frames} -> out/check/{i}_sheet.png")
    return True


if __name__ == "__main__":
    cmd = sys.argv[1]
    fn = {"probe": probe, "loop": loop, "black": black, "determinism": determinism, "banding": banding, "sheets": sheets}[cmd]
    ok = fn(*sys.argv[2:])
    sys.exit(0 if ok else 1)
