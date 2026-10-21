"""Reference vs preview contact sheet: one frame per segment (at 50% of it),
reference on top, preview below. Usage: compare_sheet.py <packId> <preview.mp4> <ref.mp4> <out.png>"""
import json, subprocess, sys
from PIL import Image, ImageDraw
import numpy as np

pid, prev, ref, out = sys.argv[1:5]
pack = [p for p in json.load(open("data/packs.json"))["packs"] if p["id"] == pid][0]
times = [(s["start"] + s["length"] * 0.5) / 30.0 for s in pack["segments"]]
TW, TH = 288, 162

def grab(path, t):
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", path, "-frames:v", "1",
                        "-vf", f"scale={TW}:{TH}:flags=lanczos,format=rgb24", "-f", "rawvideo", "-"],
                       capture_output=True, check=True)
    return Image.fromarray(np.frombuffer(r.stdout, np.uint8).reshape(TH, TW, 3))

sheet = Image.new("RGB", (TW * len(times), TH * 2 + 16), (30, 30, 30))
d = ImageDraw.Draw(sheet)
for i, t in enumerate(times):
    sheet.paste(grab(ref, t), (i * TW, 16))
    sheet.paste(grab(prev, t), (i * TW, 16 + TH))
    d.text((i * TW + 4, 2), f"{pack['segments'][i]['move']} @{t:.1f}s", fill=(255, 255, 0))
sheet.save(out)
