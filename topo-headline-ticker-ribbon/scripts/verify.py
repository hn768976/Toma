#!/usr/bin/env python3
"""Verification for the 720p previews (steps 1-6 of the verify loop).
Usage: python3 scripts/verify.py <CompositionId> [--skip-loop] [--extra-frame N]
"""
import hashlib, json, subprocess, sys, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
SCALE = "0.3333333333333333"
cid = sys.argv[1]
name = cid.replace("-", "_", 1)
loop = cid.split("-")[0] in ("TopoTerrain", "TickerFloor", "TrendRibbon")
dur = 20.0 if loop else 15.0
os.makedirs("out/verify", exist_ok=True)
report = {"id": cid}

def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True)

def still(frame, out, props=None):
    p = f"--props='{json.dumps(props)}'" if props else ""
    r = sh(f"npx remotion still out/bundle {cid} {out} --frame={frame} --scale={SCALE} --gl=angle {p}")
    if r.returncode != 0:
        raise RuntimeError(r.stderr[-2000:])

def md5(path):
    return hashlib.md5(open(path, "rb").read()).hexdigest()

def seqframe(n):
    files = sorted(os.listdir(f"out/seq/{cid}"))
    return f"out/seq/{cid}/{files[n]}"

# Step 1: ffprobe
mp4 = f"out/previews/{name}.mp4"
r = sh(f"ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt -show_entries format=duration -of json {mp4}")
info = json.loads(r.stdout)
streams = info["streams"]
v = streams[0]
ok1 = (len(streams) == 1 and v["codec_type"] == "video" and v["codec_name"] == "h264" and v["width"] == 1280 and v["height"] == 720
       and v["r_frame_rate"] == "30/1" and v["pix_fmt"] == "yuv420p" and abs(float(info["format"]["duration"]) - dur) < 0.02)
report["step1"] = {"ok": ok1, "stream": v, "duration": info["format"]["duration"], "streams": len(streams)}

# Step 2: loop check (601-frame composition, frames 0 and 600 as cold stills)
if loop and "--skip-loop" not in sys.argv:
    still(0, f"out/verify/{cid}_loop0.png", {"loopCheck": True})
    still(600, f"out/verify/{cid}_loop600.png", {"loopCheck": True})
    a = Image.open(f"out/verify/{cid}_loop0.png").convert("RGB")
    b = Image.open(f"out/verify/{cid}_loop600.png").convert("RGB")
    diff = sum(1 for x, y in zip(a.getdata(), b.getdata()) if x != y)
    report["step2"] = {"ok": diff == 0, "differing_pixels": diff}

# Step 3: determinism — cold still vs frame from the full (multi-threaded) render
frames = [300] + ([70] if not loop else [])
for f in frames:
    out = f"out/verify/{cid}_cold{f}.png"
    still(f, out)
    a = Image.open(out).convert("RGB").tobytes()
    b = Image.open(seqframe(f)).convert("RGB").tobytes()
    report[f"step3_f{f}"] = {"ok": a == b, "md5_cold": hashlib.md5(a).hexdigest(), "md5_full": hashlib.md5(b).hexdigest()}

# Step 4: banding — decode a frame from the encoded mp4 and measure the
# largest single-step jump along smooth (low-gradient) runs in dark areas.
sh(f"ffmpeg -v error -y -ss 10 -i {mp4} -frames:v 1 out/verify/{cid}_mp4_10s.png")
im = Image.open(f"out/verify/{cid}_mp4_10s.png").convert("L")
W, H = im.size
px = im.load()
# histogram of luminance in dark regions: banding shows as empty bins between populated ones
hist = [0] * 256
for y in range(0, H, 2):
    for x in range(0, W, 2):
        hist[px[x, y]] += 1
dark = hist[0:80]
populated = [i for i, c in enumerate(dark) if c > 0]
gaps = [i for i in range(populated[0], populated[-1]) if dark[i] == 0] if populated else []
report["step4"] = {"ok": len(gaps) == 0, "dark_levels_present": len(populated), "empty_levels_in_dark_range": gaps}

# Step 5: contact sheet (5 evenly spaced frames)
n = len(os.listdir(f"out/seq/{cid}"))
idx = [int(i * (n - 1) / 4) for i in range(5)]
ims = [Image.open(seqframe(i)).convert("RGB").resize((640, 360), Image.LANCZOS) for i in idx]
sheet = Image.new("RGB", (640 * 5, 360))
for i, t in enumerate(ims):
    sheet.paste(t, (i * 640, 0))
sheet.save(f"out/verify/{cid}_contact.png")
report["step5_sheet"] = f"out/verify/{cid}_contact.png (frames {idx})"

# Step 6: motion — frames 299/300/301 mean abs diff and a crop strip
fr = [Image.open(seqframe(i)).convert("L") for i in (299, 300, 301)]
def mad(a, b):
    da, db = a.tobytes(), b.tobytes()
    return sum(abs(x - y) for x, y in zip(da[::7], db[::7])) / (len(da) // 7)
report["step6"] = {"mad_299_300": round(mad(fr[0], fr[1]), 3), "mad_300_301": round(mad(fr[1], fr[2]), 3)}
strip = Image.new("RGB", (1280, 360 * 3))
for i, f in enumerate((299, 300, 301)):
    strip.paste(Image.open(seqframe(f)).convert("RGB").crop((320, 270, 960, 450)).resize((1280, 360), Image.NEAREST), (0, 360 * i))
strip.save(f"out/verify/{cid}_motion.png")

print(json.dumps(report, indent=1))
with open(f"out/verify/{cid}_report.json", "w") as fh:
    json.dump(report, fh, indent=1)
