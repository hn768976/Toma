#!/usr/bin/env python3
"""Verify loop for the 720p previews (steps 1-6 of the brief).

Run after scripts/render-previews.sh. Writes out/verify/report.txt and
contact sheets to out/verify/. Needs ffmpeg/ffprobe, numpy and Pillow.
"""
import json, subprocess, sys, pathlib
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
V = OUT / "verify"
V.mkdir(parents=True, exist_ok=True)
SCALE = "0.3333333333333333"
COMPS = {
    "LockHUD-BlueOrange": (600, False), "WaveMap-Teal": (600, True), "WaveMap-Gold": (600, True),
    "CommodityBoard-Blue": (600, False), "EnergyBattery-Blue": (600, True), "EnergyBattery-Green": (600, True),
    "TradeChart-Tariffs": (450, False), "TradeChart-Inflation": (450, False),
}
only = sys.argv[1:] or list(COMPS)
lines = []
def log(s=""):
    print(s); lines.append(s)

def frame_path(cid, f):
    files = sorted((OUT / "frames" / cid).glob("*.png"))
    digits = len(files[0].stem.split("-")[-1])
    return OUT / "frames" / cid / f"element-{f:0{digits}d}.png"

def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout

for cid in only:
    n, loop = COMPS[cid]
    name = cid.replace("-", "_", 1)
    mp4 = OUT / "previews" / f"{name}.mp4"
    log(f"== {cid}")
    # Step 1 — file checks
    info = json.loads(run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt",
                           "-show_entries", "format=duration", "-of", "json", str(mp4)]))
    st = info["streams"]; vs = [s for s in st if s["codec_type"] == "video"][0]
    dur = float(info["format"]["duration"])
    ok1 = (vs["width"], vs["height"], vs["r_frame_rate"], vs["codec_name"], vs["pix_fmt"]) == (1280, 720, "30/1", "h264", "yuv420p") \
        and not any(s["codec_type"] == "audio" for s in st) and abs(dur - n / 30) < 0.01
    log(f"  step1 {'PASS' if ok1 else 'FAIL'}: {vs['width']}x{vs['height']} {vs['r_frame_rate']} {vs['codec_name']} {vs['pix_fmt']} audio={any(s['codec_type']=='audio' for s in st)} {dur:.3f}s")
    # Step 2 — loop
    if loop:
        a, b = frame_path(cid, 0), frame_path(cid, 600)
        same = np.array_equal(np.asarray(Image.open(a)), np.asarray(Image.open(b)))
        log(f"  step2 {'PASS' if same else 'FAIL'}: frame 0 vs frame 600 pixel-identical={same}")
    # Step 3 — cold single-frame render vs full render, byte for byte
    for f in ([300] if loop else [75, 300]):
        cold = V / f"cold_{cid}_{f}.png"
        props = '{"loopCheck":true}' if loop else "{}"
        run(["npx", "remotion", "still", str(OUT / "bundle"), cid, str(cold), f"--frame={f}", f"--scale={SCALE}",
             f"--props={props}", "--image-format=png", "--log=error"])
        same = cold.read_bytes() == frame_path(cid, f).read_bytes()
        pix = np.array_equal(np.asarray(Image.open(cold)), np.asarray(Image.open(frame_path(cid, f))))
        log(f"  step3 {'PASS' if same else 'FAIL'}: frame {f} cold vs full render byte-identical={same} pixel-identical={pix}")
    # Step 4 — banding, measured on a frame decoded from the encoded mp4
    fr = 300 if n == 600 else 420
    png = V / f"mp4_{name}_{fr}.png"
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{fr/30:.4f}", "-i", str(mp4), "-frames:v", "1", str(png)])
    img = np.asarray(Image.open(png).convert("RGB")).astype(np.float32)
    lum = img @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    worst = 0
    for y0 in (40, 120, 600, 680):           # dark gradient bands near top/bottom
        band = lum[y0:y0 + 24, :].mean(axis=0)    # average rows: removes grain, keeps steps
        smooth = np.convolve(band, np.ones(9) / 9, mode="valid")
        steps = np.abs(np.diff(smooth))
        worst = max(worst, float(steps.max()))
    # plateau test: a banded gradient shows long runs of identical 8-bit values in the raw rows
    row = img[60, :, 2].astype(int)
    runs, cur = [], 1
    for i in range(1, len(row)):
        if row[i] == row[i - 1]: cur += 1
        else: runs.append(cur); cur = 1
    runs.append(cur)
    ok4 = worst < 2.0 and max(runs) < 24
    log(f"  step4 {'PASS' if ok4 else 'FAIL'}: max smoothed step {worst:.2f}/255 over dark bands, longest flat run {max(runs)} px")
    # Step 5 — contact sheet (5 evenly spaced frames)
    picks = [int(i * (n - 1) / 4) for i in range(5)]
    ims = [Image.open(frame_path(cid, f)).convert("RGB").resize((384, 216), Image.LANCZOS) for f in picks]
    sheet = Image.new("RGB", (384 * 5, 216))
    for i, im in enumerate(ims): sheet.paste(im, (384 * i, 0))
    sheet.save(V / f"contact_{name}.png")
    log(f"  step5 contact sheet: out/verify/contact_{name}.png frames {picks}")
    # Step 6 — 299/300/301 smoothness
    a, b, c = (np.asarray(Image.open(frame_path(cid, f)).convert("RGB")).astype(np.float32) for f in (299, 300, 301))
    d1, d2 = np.abs(b - a).mean(), np.abs(c - b).mean()
    ratio = max(d1, d2) / max(1e-6, min(d1, d2))
    ok6 = ratio < 1.6 and max(d1, d2) < 6
    log(f"  step6 {'PASS' if ok6 else 'CHECK'}: mean |299->300|={d1:.3f}, |300->301|={d2:.3f} (ratio {ratio:.2f})")
    Image.fromarray(np.concatenate([a, b, c], axis=1).astype(np.uint8)).save(V / f"smooth_{name}.png")

(V / "report.txt").write_text("\n".join(lines) + "\n")
