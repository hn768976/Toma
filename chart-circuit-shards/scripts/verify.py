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


def profile_smoothness(img, axis, start, length, fixed, band=24):
    """Mean of a `band`-wide strip along a line; returns the profile and the
    largest step between neighbouring samples after a 9-tap box filter (to
    average out grain/dither, which is what hides banding)."""
    if axis == 0:  # vertical line: rows start..start+length at column `fixed`
        strip = img[start:start + length, fixed - band // 2: fixed + band // 2].astype(float).mean(axis=(1, 2))
    else:
        strip = img[fixed - band // 2: fixed + band // 2, start:start + length].astype(float).mean(axis=(0, 2))
    k = np.ones(9) / 9
    sm = np.convolve(strip, k, mode="valid")
    steps = np.abs(np.diff(sm))
    return strip, float(steps.max()), float(np.abs(np.diff(strip)).max())


def banding():
    cases = [
        ("GrowthChart3D_Up", 300, [(0, 0, 260, 120, "sky, vertical, left"), (0, 0, 260, 1150, "sky, vertical, right"), (1, 0, 1280, 60, "sky, horizontal")]),
        ("CircuitFlythrough_Blue", 300, [(0, 0, 720, 640, "board + glows, vertical centre"), (1, 0, 1280, 120, "far haze / bokeh band")]),
        ("CPUBoard_BlueSilver", 300, [(0, 0, 720, 640, "vertical through chip glow"), (1, 0, 1280, 60, "far board")]),
        ("LaserPanels_CyanPurple", 300, [(0, 0, 720, 400, "vertical, hot spot + lasers"), (1, 0, 1280, 300, "horizontal through hot spot")]),
    ]
    ok_all = True
    OUTC = OUT / "check"
    OUTC.mkdir(parents=True, exist_ok=True)
    for i, fr, lines in cases:
        img = decode_frame(OUT / f"{i}.mp4", fr)
        Image.fromarray(img).save(OUTC / f"{i}_decoded_{fr}.png")
        for axis, start, length, fixed, label in lines:
            strip, step_sm, step_raw = profile_smoothness(img, axis, start, length, fixed)
            # smooth = after averaging out grain, no neighbouring samples jump by >= 1.5 levels
            # outside of real edges; we report the 99th percentile step too
            k = np.ones(9) / 9
            sm = np.convolve(strip, k, mode="valid")
            p99 = float(np.percentile(np.abs(np.diff(sm)), 99))
            uniq = len(np.unique(np.round(strip, 1)))
            ok = p99 < 1.5
            ok_all &= ok
            print(f"{'PASS' if ok else 'FAIL'} {i} f{fr} [{label}]: smoothed step p99={p99:.2f} max={step_sm:.2f} levels, "
                  f"raw max step={step_raw:.2f}, distinct values={uniq}; first values {np.round(strip[:6], 1).tolist()}")
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
