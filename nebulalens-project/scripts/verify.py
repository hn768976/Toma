#!/usr/bin/env python3
"""Verification helpers (steps 1-4 of the README checklist).

  verify.py probe  <mp4>                      file checks (ffprobe)
  verify.py same   <a.png> <b.png>            pixel-identical? (and byte-identical?)
  verify.py diff   <a.png> <b.png>            mean / max abs difference
  verify.py band   <frame.png> <x0,y0,x1,y1>  gradient profile along a line
"""
import json, subprocess, sys, hashlib
from PIL import Image

def probe(path):
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries",
        "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt",
        "-show_entries", "format=duration", "-of", "json", path])
    j = json.loads(out)
    streams = j["streams"]
    v = [s for s in streams if s["codec_type"] == "video"]
    a = [s for s in streams if s["codec_type"] == "audio"]
    d = float(j["format"]["duration"])
    s = v[0]
    ok = (s["width"], s["height"]) == (1280, 720) and s["r_frame_rate"] == "30/1" and \
        s["codec_name"] == "h264" and s["pix_fmt"] == "yuv420p" and not a and abs(d - 20.0) < 0.05
    print(f"{path}: {s['codec_name']} {s['width']}x{s['height']} {s['r_frame_rate']} {s['pix_fmt']} "
          f"audio={len(a)} duration={d:.3f}s -> {'PASS' if ok else 'FAIL'}")
    return ok

def same(a, b):
    ia, ib = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    px = ia.tobytes() == ib.tobytes()
    by = hashlib.sha256(open(a, "rb").read()).hexdigest() == hashlib.sha256(open(b, "rb").read()).hexdigest()
    print(f"pixels identical={px} file bytes identical={by}")
    return px

def diff(a, b):
    ia, ib = Image.open(a).convert("L"), Image.open(b).convert("L")
    da, db = ia.tobytes(), ib.tobytes()
    ds = [abs(x - y) for x, y in zip(da, db)]
    m = sum(ds) / len(ds)
    print(f"mean abs diff={m:.3f} max={max(ds)}")
    return m

def band(path, line):
    x0, y0, x1, y1 = map(int, line.split(","))
    im = Image.open(path).convert("RGB")
    n = max(abs(x1 - x0), abs(y1 - y0))
    lum = []
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
        # average a 9-px wide strip across the line to remove grain
        acc = 0; cnt = 0
        for k in range(-4, 5):
            xx, yy = (x, y + k) if abs(x1 - x0) >= abs(y1 - y0) else (x + k, y)
            r, g, b = im.getpixel((min(max(xx, 0), im.width - 1), min(max(yy, 0), im.height - 1)))
            acc += 0.2126 * r + 0.7152 * g + 0.0722 * b; cnt += 1
        lum.append(acc / cnt)
    steps = [abs(lum[i + 1] - lum[i]) for i in range(len(lum) - 1)]
    # longest run of exactly-equal raw (unaveraged) centre pixels = sign of banding plateaus
    raw = []
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
        raw.append(im.getpixel((x, y)))
    run = best = 1
    for i in range(1, len(raw)):
        run = run + 1 if raw[i] == raw[i - 1] else 1
        best = max(best, run)
    samples = " ".join(f"{lum[i]:.1f}" for i in range(0, len(lum), max(1, len(lum) // 16)))
    print(f"profile: {samples}")
    print(f"max step between neighbours (strip-avg)={max(steps):.2f}  longest identical raw run={best}px")
    return max(steps), best

def band2(path, box, axis="x"):
    """Banding test on a gradient patch. Per column (axis x) take the median
    over the patch's rows (removes grain and particles), then the RMS of the
    residual against a 31-px moving average. A smooth / dithered gradient
    gives a residual well under 0.2 levels; 8-bit banding leaves a sawtooth
    of about 0.29 levels plus long flat plateaus."""
    import statistics
    x0, y0, w, h = map(int, box.split(","))
    im = Image.open(path).convert("L")
    px = im.load()
    def tmean(vals):
        v = sorted(vals); q = len(v) // 4
        mid = v[q:len(v) - q] or v
        return sum(mid) / len(mid)
    if axis == "x":
        prof = [tmean([px[x, y] for y in range(y0, y0 + h)]) for x in range(x0, x0 + w)]
    else:
        prof = [tmean([px[x, y] for x in range(x0, x0 + w)]) for y in range(y0, y0 + h)]
    k = 15
    res = []
    for i in range(k, len(prof) - k):
        m = sum(prof[i - k:i + k + 1]) / (2 * k + 1)
        res.append(prof[i] - m)
    rms = (sum(r * r for r in res) / len(res)) ** 0.5
    run = best = 1
    for i in range(1, len(prof)):
        run = run + 1 if prof[i] == prof[i - 1] else 1
        best = max(best, run)
    span = max(prof) - min(prof)
    print(f"levels {min(prof):.0f}->{max(prof):.0f} (span {span:.0f}) over {len(prof)}px; "
          f"residual RMS={rms:.3f}; longest flat run of profile={best}px")
    return rms

if __name__ == "__main__":
    if sys.argv[1] == "band2": band2(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "x"); sys.exit(0)
    cmd = sys.argv[1]
    if cmd == "probe": sys.exit(0 if probe(sys.argv[2]) else 1)
    if cmd == "same": sys.exit(0 if same(sys.argv[2], sys.argv[3]) else 1)
    if cmd == "diff": diff(sys.argv[2], sys.argv[3])
    if cmd == "band": band(sys.argv[2], sys.argv[3])
