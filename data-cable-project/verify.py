#!/usr/bin/env python3
"""Objective checks for the Binary Data Cables previews.

Everything here reads the *encoded* mp4 wherever the check is about what a
buyer actually receives -- black level and banding in particular, which
compression is perfectly capable of ruining after the render looks fine.

    python3 verify.py probe     out/previews/*.mp4
    python3 verify.py black     out/previews/CableBundle_Rack.mp4
    python3 verify.py blackfrac out/previews/DataRibbon_Minimal.mp4
    python3 verify.py band      out/previews/CableBundle_Rack.mp4
    python3 verify.py motion    out/previews/CableBundle_Rack.mp4
    python3 verify.py speeds    out/previews/CableBundle_Rack.mp4
    python3 verify.py overlay   a.mp4 b.mp4
"""
import io
import subprocess
import sys

import numpy as np
from PIL import Image

OK, BAD = "PASS", "FAIL"


def frame(path, n):
    """Decode frame n straight out of the encoded file."""
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", f"select=eq(n\\,{n})",
         "-vframes", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
        capture_output=True, check=True).stdout
    return np.asarray(Image.open(io.BytesIO(out)).convert("RGB")).astype(np.int16)


def probe(path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt",
         "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1", path],
        capture_output=True, text=True, check=True).stdout
    d = {}
    streams = []
    for line in r.strip().splitlines():
        k, _, v = line.partition("=")
        if k == "codec_type":
            streams.append(v)
        d.setdefault(k, v)
    checks = [
        ("resolution 1920x1080", d.get("width") == "1920" and d.get("height") == "1080",
         f"{d.get('width')}x{d.get('height')}"),
        ("frame rate 30/1", d.get("r_frame_rate") == "30/1", d.get("r_frame_rate")),
        ("duration 20.0s", abs(float(d.get("duration", 0)) - 20.0) < 0.05, d.get("duration")),
        ("codec h264", d.get("codec_name") == "h264", d.get("codec_name")),
        ("pix_fmt yuv420p", d.get("pix_fmt") in ("yuv420p", "yuvj420p"), d.get("pix_fmt")),
        ("no audio stream", "audio" not in streams, ",".join(streams)),
    ]
    bad = 0
    for name, good, got in checks:
        if not good:
            bad += 1
        print(f"  [{OK if good else BAD}] {name:24s} got: {got}")
    return bad == 0


def black(path):
    """Does the black survive encoding as a true 0,0,0?

    Fixed corners are the wrong probe -- a band legitimately crosses a corner
    in several of these compositions. What matters for a screen-blend overlay
    is that pixels away from the strands encode as exact zero rather than
    sitting on a lifted floor, so this finds the darkest patch in each quadrant
    and checks the near-black population as a whole.
    """
    good = True
    for n in (0, 150, 300, 450, 599):
        a = frame(path, n)
        h, w, _ = a.shape
        lum = a.max(axis=2)

        # Darkest 40x40 patch per quadrant, i.e. "well away from any cable".
        worst = 0
        for qy in (0, h // 2):
            for qx in (0, w // 2):
                q = lum[qy:qy + h // 2, qx:qx + w // 2]
                best = None
                for yy in range(0, q.shape[0] - 40, max(1, q.shape[0] // 12)):
                    for xx in range(0, q.shape[1] - 40, max(1, q.shape[1] // 12)):
                        v = int(q[yy:yy + 40, xx:xx + 40].max())
                        if best is None or v < best:
                            best = v
                worst = max(worst, best or 0)

        near = lum <= 6
        exact = float((lum == 0).sum()) / max(1.0, float(near.sum()))
        ok = worst == 0 and exact > 0.9
        good &= ok
        print(f"  [{OK if ok else BAD}] frame {n:3d}: darkest quadrant patch max={worst}, "
              f"{100*exact:.1f}% of near-black pixels are exactly 0")
    return good


def blackfrac(path):
    """1B must leave at least half the frame pure black."""
    a = frame(path, 300)
    frac = float((a.max(axis=2) == 0).mean())
    good = frac >= 0.5
    print(f"  [{OK if good else BAD}] >=50% pure black        got: {frac*100:.1f}%")
    return good


def band(path):
    """Walk a scanline out of the brightest pixel into the black field.

    Dither and grain should keep adjacent values moving. A long run of one
    identical value inside the falloff is a banding plateau.
    """
    a = frame(path, 300)
    luma = (0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2])
    y, x = np.unravel_index(int(luma.argmax()), luma.shape)
    row = luma[y]
    # Walk toward whichever side has more room.
    seg = row[x:] if (len(row) - x) > x else row[:x][::-1]
    halo = seg[(seg < seg.max() * 0.6) & (seg > 0.5)]
    if halo.size < 40:
        halo = seg[:400]
    runs, cur, longest = 1, halo[0] if halo.size else 0, 1
    for v in halo[1:]:
        if v == cur:
            runs += 1
            longest = max(longest, runs)
        else:
            runs, cur = 1, v
    distinct = len(np.unique(np.round(halo)))
    good = longest <= 14
    print(f"  [{OK if good else BAD}] no banding plateaus     longest flat run: {longest}px, "
          f"distinct levels in halo: {distinct}")
    return good


def motion(path):
    """The digits must visibly move between sampled frames."""
    ok = True
    prev = None
    for n in (0, 150, 300, 450, 599):
        a = frame(path, n).astype(np.float32)
        if prev is not None:
            diff = float(np.abs(a - prev).mean())
            good = diff > 1.5
            ok &= good
            print(f"  [{OK if good else BAD}] digits moved by frame {n:3d}  mean |delta|: {diff:.2f}")
        prev = a
    return ok


def _lag(strip_a, strip_b, maxlag=60):
    """Best horizontal shift between two 1D signals, by absolute difference."""
    best, bestlag = None, 0
    for L in range(-maxlag, maxlag + 1):
        b = np.roll(strip_b, L)
        core = slice(maxlag, -maxlag)
        d = float(np.abs(strip_a[core] - b[core]).mean())
        if best is None or d < best:
            best, bestlag = d, L
    return bestlag


def speeds(path):
    """Different strands must advance by different amounts over the same gap."""
    a0, a1 = frame(path, 0), frame(path, 60)
    luma0 = (0.2126 * a0[:, :, 0] + 0.7152 * a0[:, :, 1] + 0.0722 * a0[:, :, 2])
    luma1 = (0.2126 * a1[:, :, 0] + 0.7152 * a1[:, :, 1] + 0.0722 * a1[:, :, 2])
    h = luma0.shape[0]
    lags = []
    for frac in (0.62, 0.72, 0.82, 0.92):
        y = int(h * frac)
        s0 = luma0[y - 2:y + 3].mean(axis=0)
        s1 = luma1[y - 2:y + 3].mean(axis=0)
        if s0.max() < 30:
            continue
        lags.append((frac, _lag(s0, s1)))
    uniq = {L for _, L in lags}
    good = len(uniq) > 1
    print(f"  [{OK if good else BAD}] strands differ in speed  lags: "
          + ", ".join(f"y={f:.2f}:{L:+d}px" for f, L in lags))
    return good


def overlay(a_path, b_path):
    """A colourway must share its geometry exactly -- only the hue differs."""
    a, b = frame(a_path, 300), frame(b_path, 300)
    ma = a.max(axis=2) > 8
    mb = b.max(axis=2) > 8
    inter = float((ma & mb).sum())
    union = float((ma | mb).sum())
    iou = inter / union if union else 0.0

    def hue(img, mask):
        hsv = np.asarray(Image.fromarray(img.astype(np.uint8)).convert("HSV"))[:, :, 0]
        return float(hsv[mask].mean()) if mask.any() else 0.0

    dh = abs(hue(a, ma) - hue(b, mb))
    same_geo = iou > 0.97
    diff_hue = dh > 8
    print(f"  [{OK if same_geo else BAD}] identical geometry      mask IoU: {iou:.4f}")
    print(f"  [{OK if diff_hue else BAD}] hue differs             mean hue delta: {dh:.1f}/255")
    return same_geo and diff_hue


if __name__ == "__main__":
    cmd, args = sys.argv[1], sys.argv[2:]
    allgood = True
    if cmd == "overlay":
        print(f"overlay {args[0]} vs {args[1]}")
        allgood = overlay(args[0], args[1])
    else:
        fn = {"probe": probe, "black": black, "blackfrac": blackfrac,
              "band": band, "motion": motion, "speeds": speeds}[cmd]
        for p in args:
            print(f"{cmd} {p}")
            allgood &= bool(fn(p))
    sys.exit(0 if allgood else 1)
