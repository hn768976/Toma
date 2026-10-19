#!/usr/bin/env python3
"""Verify loop for the 720p previews (run from the project root after rendering).

1 ffprobe  2 black level  3 green level  4 chroma-key test  5 loop frame 0 == 600
Determinism (6) and contact sheets (7) live in scripts/verify-determinism.sh and
scripts/contact-sheets.sh.
"""
import json, subprocess, sys
import numpy as np

P = "out/previews"
W, H = 1280, 720
CLIPS = {
    "DoodlePack_WhiteOnBlack": (12, "black"),
    "DoodlePack_InkOnGreen": (12, "green"),
    "ScribbleWipe_Marker": (3, "green"),
    "ScribbleWipe_Ink": (3, "green"),
    "Handwritten_Hello": (6, "black"),
    "Handwritten_ThankYou": (6, "black"),
    "Handwritten_Welcome": (6, "black"),
    "Handwritten_Subscribe": (6, "black"),
    "NotebookPage_Loop": (20, "paper"),
    "InkFlourish_Black": (5, "black"),
}
BG = {"black": (0, 0, 0), "green": (0, 255, 0)}
TOL = {"black": 1, "green": 2}
results = []


def report(name, ok, detail):
    results.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + ": " + detail)


def frames(path, idx):
    """Decode the given frame indices to RGB arrays (full-range RGB output)."""
    sel = "+".join(f"eq(n\\,{i})" for i in idx)
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", f"select='{sel}'", "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)


def dilate(mask, r):
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(mask, dy, 0), dx, 1)
    return out


# 1 ffprobe -----------------------------------------------------------------
for name, (secs, _) in CLIPS.items():
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", f"{P}/{name}.mp4"], capture_output=True, check=True).stdout)
    v = [s for s in info["streams"] if s["codec_type"] == "video"]
    a = [s for s in info["streams"] if s["codec_type"] == "audio"]
    s = v[0]
    n = int(subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", f"{P}/{name}.mp4"], capture_output=True, check=True).stdout)
    ok = (s["width"], s["height"]) == (W, H) and s["r_frame_rate"] == "30/1" and s["codec_name"] == "h264" and s["pix_fmt"] == "yuv420p" and not a and n == secs * 30
    report(f"1 ffprobe {name}", ok, f"{s['width']}x{s['height']} {s['r_frame_rate']} {s['codec_name']} {s['pix_fmt']} audio={len(a)} frames={n} ({n / 30:.2f}s)")

# 2/3 background levels ----------------------------------------------------
rng = np.random.default_rng(1234)
for name, (secs, bg) in CLIPS.items():
    if bg == "paper":
        continue
    total = secs * 30
    idx = sorted({int(total * f) for f in (0.1, 0.3, 0.5, 0.7, 0.9)} | {total - 1})
    fr = frames(f"{P}/{name}.mp4", idx).astype(int)
    ref = np.array(BG[bg])
    samples = []
    per = 50 // len(fr) + 1
    for img in fr:
        ink = np.abs(img - ref).max(-1) > 3  # anything visible, incl. ink mid-fade
        # Background = at least 6 px from any ink (antialiased edges and chroma
        # subsampling live closer than that); a halo/glow would reach further.
        bgmask = ~dilate(ink, 6)
        ys, xs = np.nonzero(bgmask)
        pick = rng.choice(len(ys), size=min(per, len(ys)), replace=False)
        samples += [img[ys[p], xs[p]] for p in pick]
    samples = np.array(samples[:50])
    dev = np.abs(samples - ref).max()
    # Also: the whole background region of every sampled frame (catches grain/dither/halo).
    worst = max(int(np.abs(img - ref).max(-1)[~dilate(np.abs(img - ref).max(-1) > 3, 10)].max(initial=0)) for img in fr)
    check = "2 black" if bg == "black" else "3 green"
    report(f"{check} {name}", dev <= TOL[bg] and worst <= TOL[bg], f"50 samples over frames {idx}: max deviation {dev}; whole background >10 px from ink (past H.264 edge ringing) max deviation {worst} (tol ±{TOL[bg]}); e.g. {samples[0].tolist()}")

# 4 key test -----------------------------------------------------------------
keyed = "out/verify/key_DoodlePack_InkOnGreen.mp4"
subprocess.run(["mkdir", "-p", "out/verify"], check=True)
subprocess.run([
    "ffmpeg", "-v", "error", "-y", "-i", f"{P}/DoodlePack_InkOnGreen.mp4", "-f", "lavfi", "-i", "color=c=0x808080:s=1280x720:r=30",
    "-filter_complex", "[0:v]chromakey=0x00FF00:0.15:0.04,despill=type=green,format=yuva420p[k];[1:v][k]overlay=shortest=1,format=yuv420p",
    "-c:v", "libx264", "-crf", "12", keyed,
], check=True)
idx = [120, 200, 280, 299]
src = frames(f"{P}/DoodlePack_InkOnGreen.mp4", idx).astype(int)
out = frames(keyed, idx).astype(int)
fringe = holes = inkpx = 0
for a, b in zip(src, out):
    ink = (a.max(-1) < 60)  # solid ink core in the source
    core = ink & ~dilate(~ink, 1)
    inkpx += core.sum()
    holes += (core & (np.abs(b - 128).max(-1) < 20)).sum()  # grey showing through the ink
    greenish = (b[..., 1] - np.maximum(b[..., 0], b[..., 2])) > 12
    fringe += greenish.sum()
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", keyed, "-vf", "select='eq(n\\,299)'", "-vsync", "0", "-frames:v", "1", "out/verify/key_frame299.png"], check=True)
report("4 key test DoodlePack_InkOnGreen (chromakey=0x00FF00:0.15:0.04 + despill)", fringe == 0 and holes == 0, f"frames {idx}: green-tinted pixels after keying {fringe}, holes in ink core {holes} of {inkpx} ink pixels; frame saved to out/verify/key_frame299.png")

# 5 loop ---------------------------------------------------------------------
try:
    a = np.array(subprocess.run(["convert", "out/verify/loop_0.png", "rgb:-"], capture_output=True, check=True).stdout)
    b = np.array(subprocess.run(["convert", "out/verify/loop_600.png", "rgb:-"], capture_output=True, check=True).stdout)
    same = subprocess.run(["cmp", "-s", "out/verify/loop_0.png", "out/verify/loop_600.png"]).returncode == 0
    report("5 loop NotebookPage frame 0 vs 600", same, "PNG files identical byte for byte" if same else "PNG files differ")
except subprocess.CalledProcessError:
    report("5 loop", False, "render out/verify/loop_0.png and loop_600.png first")

print(f"\n{sum(ok for _, ok, _ in results)}/{len(results)} passed")
sys.exit(0 if all(ok for _, ok, _ in results) else 1)
