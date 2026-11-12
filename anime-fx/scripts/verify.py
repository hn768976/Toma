#!/usr/bin/env python3
"""Verification for the 8 previews.

usage:
  python3 scripts/verify.py probe              # ffprobe every preview
  python3 scripts/verify.py loops              # frame 0 vs frame 300 (lossless stills)
  python3 scripts/verify.py background         # 50 empty points per clip, mp4 vs listed colour
  python3 scripts/verify.py twos               # 12 consecutive lossless frames, clips 1, 3, 5
  python3 scripts/verify.py determinism        # cold-start middle frame vs full PNG-sequence render

Lossless frames are rendered with Remotion at the preview scale into out/verify/.
"""
import hashlib
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out")
VER = os.path.join(OUT, "verify")
SCALE = "0.3333333333333333"
CLIPS = [
    ("AnimeShards-Neon", 10.0), ("AnimeShards-Ice", 10.0),
    ("GraffitiWall-Neon", 10.0), ("GraffitiWall-Paper", 10.0),
    ("AnimeFire-Red", 10.0), ("AnimeFire-Blue", 10.0),
    ("StyleWalk-Colours", 13.0), ("InkFigure-DotBurst", 12.0),
]
LOOPS = [c for c, _ in CLIPS[:6]]
os.makedirs(VER, exist_ok=True)


def sh(*args, **kw):
    return subprocess.run(args, check=True, capture_output=True, text=True, cwd=ROOT, **kw).stdout


def still(comp, frame, path, props=None):
    a = ["npx", "remotion", "still", "src/index.ts", comp, path, f"--frame={frame}", f"--scale={SCALE}", "--log=error"]
    if props:
        a.append("--props=" + json.dumps(props))
    sh(*a)


def mp4(comp):
    return os.path.join(OUT, comp.replace("-", "_") + ".mp4")


def decode_frame(path, t):
    raw = subprocess.run(
        # Remotion's previews are untagged BT.601 limited range; decode them
        # with exact rounding so the check measures the file, not the decoder.
        ["ffmpeg", "-v", "error", "-ss", str(t), "-i", path, "-frames:v", "1",
         "-vf", "scale=in_color_matrix=bt601:in_range=tv:out_range=pc:flags=accurate_rnd+full_chroma_int+bitexact,format=rgb24",
         "-f", "rawvideo", "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, np.uint8).reshape(720, 1280, 3)


def probe():
    ok = True
    for comp, dur in CLIPS:
        p = mp4(comp)
        info = json.loads(sh("ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", p))
        v = [s for s in info["streams"] if s["codec_type"] == "video"][0]
        audio = [s for s in info["streams"] if s["codec_type"] == "audio"]
        d = float(info["format"]["duration"])
        good = (v["width"], v["height"], v["r_frame_rate"], v["codec_name"], v["pix_fmt"]) == (1280, 720, "30/1", "h264", "yuv420p") and not audio and abs(d - dur) < 1e-3
        ok &= good
        print(f"{'PASS' if good else 'FAIL'} {comp}: {v['width']}x{v['height']} {v['r_frame_rate']} {v['codec_name']} {v['pix_fmt']} audio={len(audio)} dur={d:.3f}s nb_frames={v.get('nb_frames')}")
    return ok


def loops():
    ok = True
    for comp in LOOPS:
        a = os.path.join(VER, f"{comp}_f0.png")
        b = os.path.join(VER, f"{comp}_f300.png")
        still(comp, 0, a, {"loopCheck": True})
        still(comp, 300, b, {"loopCheck": True})
        A = np.asarray(Image.open(a).convert("RGB"))
        B = np.asarray(Image.open(b).convert("RGB"))
        diff = int(np.abs(A.astype(int) - B.astype(int)).max())
        same = diff == 0
        ok &= same
        print(f"{'PASS' if same else 'FAIL'} {comp}: frame 0 vs frame 300 (301-frame comp), max pixel diff {diff}")
    return ok


BG = {
    "GraffitiWall-Paper": ("#F4F1EA", [30, 150, 270]),
    "AnimeFire-Red": ("#000000", [30, 150, 270]),
    "AnimeFire-Blue": ("#000000", [30, 150, 270]),
    "StyleWalk-Colours": (None, [20, 60, 100, 140, 180, 220, 260, 300, 340, 380]),
    "InkFigure-DotBurst": ("#74A6E0", [100, 250, 340]),
}
WALK_BG = ["#F5820A", "#FF1A3A", "#FF3AE0", "#9A4AFF", "#4A7AFF", "#3AFFF8", "#22F04A", "#66FF00", "#F5D80A", "#F5820A"]


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)])


def background():
    ok = True
    rng = np.random.default_rng(1234)
    for comp, (col, frames) in BG.items():
        worst = 0
        n = 0
        for f in frames:
            target = hexrgb(col if col else WALK_BG[min(9, f // 39)])
            lossless = os.path.join(VER, f"{comp}_bg{f}.png")
            still(comp, f, lossless)
            L = np.asarray(Image.open(lossless).convert("RGB")).astype(int)
            # empty = exactly the background in the lossless render, in a 33x33
            # neighbourhood (keeps samples clear of H.264 ringing around marks)
            exact = np.all(L == target, axis=2)
            pad = 16
            cand = []
            tries = 0
            while len(cand) < 50 // len(frames) + 1 and tries < 20000:
                tries += 1
                y = int(rng.integers(pad, 720 - pad))
                x = int(rng.integers(pad, 1280 - pad))
                if exact[y - pad:y + pad + 1, x - pad:x + pad + 1].all():
                    cand.append((y, x))
            M = decode_frame(mp4(comp), (f + 0.5) / 30).astype(int)
            for (y, x) in cand:
                e = int(np.abs(M[y, x] - target).max())
                worst = max(worst, e)
                n += 1
        good = worst <= 1
        ok &= good
        print(f"{'PASS' if good else 'FAIL'} {comp}: {n} empty points sampled from the mp4, worst channel error {worst} (allowed 1)")
    return ok


def twos():
    ok = True
    for comp in ["AnimeShards-Neon", "GraffitiWall-Neon", "AnimeFire-Red"]:
        d = os.path.join(VER, f"twos_{comp}")
        os.makedirs(d, exist_ok=True)
        sh("npx", "remotion", "render", "src/index.ts", comp, d, "--sequence", "--image-format=png", f"--scale={SCALE}", "--frames=100-111", "--log=error")
        files = sorted(os.listdir(d))[:12]
        imgs = [np.asarray(Image.open(os.path.join(d, f)).convert("RGB")) for f in files]
        pattern = []
        good = True
        for i in range(11):
            same = np.array_equal(imgs[i], imgs[i + 1])
            pattern.append("=" if same else "|")
            # frames 100,101 share a drawing; 101->102 must change
            expect_same = (100 + i) % 2 == 0
            good &= same == expect_same
        ok &= good
        print(f"{'PASS' if good else 'FAIL'} {comp}: frames 100-111 change pattern {''.join(pattern)}  (= held, | new drawing)")
    return ok


def md5(p):
    return hashlib.md5(open(p, "rb").read()).hexdigest()


def determinism(which=None):
    ok = True
    for comp, dur in CLIPS:
        if which and comp not in which:
            continue
        n = int(round(dur * 30))
        mid = n // 2
        d = os.path.join(VER, f"seq_{comp}")
        os.makedirs(d, exist_ok=True)
        sh("npx", "remotion", "render", "src/index.ts", comp, d, "--sequence", "--image-format=png", f"--scale={SCALE}", "--log=error")
        seq = sorted(f for f in os.listdir(d) if f.endswith(".png"))
        full = os.path.join(d, seq[mid])
        cold = os.path.join(VER, f"{comp}_cold{mid}.png")
        still(comp, mid, cold)
        same_bytes = md5(full) == md5(cold)
        A = np.asarray(Image.open(full).convert("RGB"))
        B = np.asarray(Image.open(cold).convert("RGB"))
        same_px = np.array_equal(A, B)
        ok &= same_bytes
        print(f"{'PASS' if same_bytes else 'FAIL'} {comp}: frame {mid} cold still vs full render ({len(seq)} frames): bytes {'identical' if same_bytes else 'differ'}, pixels {'identical' if same_px else 'differ'}")
    return ok


if __name__ == "__main__":
    stage = sys.argv[1]
    fn = {"probe": probe, "loops": loops, "background": background, "twos": twos, "determinism": lambda: determinism(sys.argv[2:] or None)}[stage]
    sys.exit(0 if fn() else 1)
