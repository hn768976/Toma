#!/usr/bin/env python3
"""Verification helpers (run from the project root).

  checks.py ffprobe <mp4>...                 step 2: stream/format checks
  checks.py same <a.png> <b.png>             byte + pixel identity
  checks.py seam <seq_dir> <frames>          frame N-1 -> 0 jump vs typical step
  checks.py band <mp4> <frame> <x0,y0,x1,y1> step 5: read a pixel profile from the encoded mp4
  checks.py sheet <mp4> <n> <out.png>        step 6: contact sheet of n frames
"""
import hashlib, json, subprocess, sys
from PIL import Image, ImageChops

def ffprobe(paths, expect):
    ok = True
    for p in paths:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
            "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt",
            "-show_entries", "format=duration", "-of", "json", p], capture_output=True, text=True).stdout
        j = json.loads(out)
        st = j["streams"]
        v = [s for s in st if s["codec_type"] == "video"]
        a = [s for s in st if s["codec_type"] == "audio"]
        d = float(j["format"]["duration"])
        want = expect(p)
        good = (len(v) == 1 and not a and v[0]["codec_name"] == "h264" and v[0]["width"] == 1280
                and v[0]["height"] == 720 and v[0]["r_frame_rate"] == "30/1" and v[0]["pix_fmt"] == "yuv420p"
                and abs(d - want) < 0.02)
        ok &= good
        print(f"{'PASS' if good else 'FAIL'}  {p}: {v[0]['codec_name']} {v[0]['width']}x{v[0]['height']} "
              f"{v[0]['r_frame_rate']} {v[0]['pix_fmt']} audio={len(a)} duration={d:.3f}s (want {want})")
    return ok

def same(a, b):
    ha = hashlib.sha256(open(a, "rb").read()).hexdigest()
    hb = hashlib.sha256(open(b, "rb").read()).hexdigest()
    ia, ib = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    bbox = ImageChops.difference(ia, ib).getbbox()
    print(f"bytes {'IDENTICAL' if ha == hb else 'DIFFER'}; pixels {'IDENTICAL' if bbox is None else 'DIFFER in ' + str(bbox)}")
    return bbox is None, ha == hb

def meandiff(a, b):
    d = ImageChops.difference(Image.open(a).convert("L"), Image.open(b).convert("L"))
    h = d.histogram()
    return sum(i * c for i, c in enumerate(h)) / sum(h)

def band(mp4, frame, box):
    x0, y0, x1, y1 = box
    png = "/tmp/_band.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", f"select=eq(n\\,{frame})", "-frames:v", "1", png], check=True)
    im = Image.open(png).convert("RGB")
    n = 24
    vals = []
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
        # 9x9 box average: grain is meant to be there, steps are not
        px = [im.getpixel((min(max(x + dx, 0), im.width - 1), min(max(y + dy, 0), im.height - 1)))
              for dx in range(-4, 5) for dy in range(-4, 5)]
        vals.append(tuple(round(sum(p[k] for p in px) / len(px), 1) for k in range(3)))
    steps = [round(max(abs(vals[i + 1][k] - vals[i][k]) for k in range(3)), 1) for i in range(n)]
    print("profile:", vals)
    print("steps  :", steps)
    return vals, steps

def sheet(mp4, n, out):
    dur = float(json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", mp4],
        capture_output=True, text=True).stdout)["format"]["duration"])
    frames = round(dur * 30)
    ims = []
    for i in range(n):
        f = round(i * (frames - 1) / (n - 1)) if n > 1 else 0
        p = f"/tmp/_sheet_{i}.png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", f"select=eq(n\\,{f}),scale=640:360", "-frames:v", "1", p], check=True)
        ims.append((f, Image.open(p).convert("RGB")))
    cols = 2 if n <= 6 else 4
    rows = (n + cols - 1) // cols
    s = Image.new("RGB", (640 * cols, 360 * rows), (0, 0, 0))
    for i, (f, im) in enumerate(ims):
        s.paste(im, ((i % cols) * 640, (i // cols) * 360))
    s.save(out)
    print("sheet frames:", [f for f, _ in ims])

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "ffprobe":
        ok = ffprobe(sys.argv[2:], lambda p: 15.0 if "TableAssemble" in p else 20.0)
        sys.exit(0 if ok else 1)
    if cmd == "same":
        px, by = same(sys.argv[2], sys.argv[3]); sys.exit(0 if px else 1)
    if cmd == "seam":
        d, n = sys.argv[2], int(sys.argv[3])
        import glob
        fs = sorted(glob.glob(d + "/*.png"))
        seam = meandiff(fs[n - 1], fs[0])
        typical = [meandiff(fs[i], fs[i + 1]) for i in (0, n // 4, n // 2, 3 * n // 4, n - 2)]
        print(f"seam diff (frame {n-1} -> 0): {seam:.3f}; typical consecutive: {[round(t, 3) for t in typical]}")
    if cmd == "band":
        band(sys.argv[2], int(sys.argv[3]), [int(v) for v in sys.argv[4].split(",")])
    if cmd == "sheet":
        sheet(sys.argv[2], int(sys.argv[3]), sys.argv[4])
