#!/usr/bin/env python3
"""Checks on the encoded 1080p previews (needs ffmpeg/ffprobe, numpy, pillow).
Step 1: stream format. Step 3: black check. Step 5: banding profile.
Step 6: five evenly spaced frames per preview -> out/verify/<name>_contact.png
"""
import json, subprocess, sys, os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
os.makedirs("out/verify", exist_ok=True)
COMPS = [l.split() for l in open("scripts/compositions.txt") if l.strip() and not l.startswith("#")]

def frame_at(path, t):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", path, "-frames:v", "1",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(1080, 1920, 3)

ok_all = True
print("== Step 1: file checks")
for cid, name, n, _, _ in COMPS:
    p = f"out/previews/{name}.mp4"
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries",
        "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt:format=duration", "-of", "json", p],
        capture_output=True, check=True).stdout)
    s = info["streams"]
    v = [x for x in s if x["codec_type"] == "video"][0]
    audio = any(x["codec_type"] == "audio" for x in s)
    dur = float(info["format"]["duration"])
    want = int(n) / 30
    ok = (v["codec_name"] == "h264" and v["width"] == 1920 and v["height"] == 1080 and v["r_frame_rate"] == "30/1"
          and v["pix_fmt"] == "yuv420p" and not audio and abs(dur - want) < 0.05)
    ok_all &= ok
    print(f"  {name:26s} {v['codec_name']} {v['width']}x{v['height']} {v['r_frame_rate']} {v['pix_fmt']} audio={audio} dur={dur:.3f}s (want {want:.1f}) -> {'PASS' if ok else 'FAIL'}")

print("== Step 3: black check (frames decoded from the encoded mp4)")
from PIL import Image
def dilate(m, r):
    out = m.copy()
    for ax in (0, 1):
        acc = out.copy()
        for k in range(1, r + 1):
            acc |= np.roll(out, k, ax) | np.roll(out, -k, ax)
        out = acc
    return out
for name in ["FinanceDepth_Blue", "FinanceDepth_Gold", "FinanceOverlay_Teal"]:
    for fr in [60, 200, 330, 480]:
        enc = frame_at(f"out/previews/{name}.mp4", fr / 30 + 1 / 60).astype(int).max(axis=2)
        src = np.asarray(Image.open(f"out/frames/{name}/element-{fr:03d}.png").convert("RGB")).astype(int).max(axis=2)
        # empty area = more than 32 px from any non-black pixel of the lossless render
        empty = ~dilate(src > 0, 32)
        worst = int(enc[empty].max())
        zero = float((enc[empty] == 0).mean())
        ok = empty.mean() > 0.2 and worst <= 1
        ok_all &= ok
        print(f"  {name:22s} frame {fr}: empty area {empty.mean()*100:4.1f}% of frame, "
              f"exact 0,0,0 in the render; in the mp4 max={worst}, {zero*100:.3f}% exactly 0 -> {'PASS' if ok else 'FAIL'}")

print("== Step 5: banding (frame from the encoded mp4)")
for name, t, rows in [("DotMapGlobe_SilverNavy", 6.0, [60, 1000]), ("DataMatrix_BlueOrange", 12.0, [80, 1050]), ("HologramMap_IceBlue", 6.0, [80, 1040])]:
    f = frame_at(f"out/previews/{name}.mp4", t).astype(float)
    # vertical gradient profile at x=40 and x=960 (column averages over 32 px)
    for x in [40, 1880]:
        col = f[:, x:x + 32, :].mean(axis=1)
        lum = col @ np.array([0.2126, 0.7152, 0.0722])
        seg = lum[rows[0]:rows[1]]
        sm = np.convolve(seg, np.ones(31) / 31, mode="valid")
        steps = np.abs(np.diff(sm))
        print(f"  {name:22s} x={x:4d} rows {rows[0]}-{rows[1]}: luma {seg.min():.1f}..{seg.max():.1f}, "
              f"largest step in 31-px smoothed profile {steps.max():.3f} levels/row")
    # raw single-pixel row values to show dither
    print("    sample pixels (row 540, x 0..11):", [tuple(int(c) for c in f[540, i]) for i in range(0, 12)])

print("== Step 6: five evenly spaced frames per preview")
for cid, name, n, _, _ in COMPS:
    dur = int(n) / 30
    ts = [dur * (i + 0.5) / 5 for i in range(5)]
    ins = []
    for i, t in enumerate(ts):
        out = f"out/verify/{name}_{i}.png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", f"out/previews/{name}.mp4",
                        "-frames:v", "1", "-vf", "scale=640:-1", out], check=True)
        ins += ["-i", out]
    subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", "hstack=inputs=5",
                    f"out/verify/{name}_contact.png"], check=True)
    print(f"  {name}: out/verify/{name}_contact.png  (t = {', '.join(f'{t:.1f}s' for t in ts)})")

print("ALL AUTOMATIC CHECKS PASS" if ok_all else "SOME CHECKS FAILED")
