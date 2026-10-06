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
        if not cold.exists():
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
    # Smooth-gradient mask: dark pixels whose 15x15 box-blurred neighbourhood
    # varies slowly (no text, lines or edges) — this is where banding would show.
    k = 15
    pad = np.pad(lum, k, mode="edge")
    cs = pad.cumsum(0).cumsum(1)
    blur = (cs[k:-k, k:-k] - cs[:-2*k, k:-k] - cs[k:-k, :-2*k] + cs[:-2*k, :-2*k]) / (k * k)
    gy, gx = np.gradient(blur)
    hf = np.abs(lum - blur)
    hfb = np.pad(hf, k, mode="edge").cumsum(0).cumsum(1)
    hfb = (hfb[k:-k, k:-k] - hfb[:-2*k, k:-k] - hfb[k:-k, :-2*k] + hfb[:-2*k, :-2*k]) / (k * k)
    mask = (blur < 90) & (np.hypot(gx, gy) < 0.6) & (hfb < 4.0)
    area = mask.mean()
    # (a) the rendered (pre-encode) frame is dithered: in smooth regions, runs of
    #     identical 8-bit values stay short (an undithered gradient shows long flats)
    src = np.asarray(Image.open(frame_path(cid, fr)).convert("RGB")).astype(np.float32)
    slum = src @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    def runs_p99(L):
        q = np.round(L).astype(int); out = []
        for y in range(0, L.shape[0], 4):
            row, m, cur = q[y], mask[y], 0
            for x in range(1, len(row)):
                if m[x] and m[x - 1] and row[x] == row[x - 1]: cur += 1
                else:
                    if cur: out.append(cur)
                    cur = 0
        return float(np.percentile(out, 99)) if out else 0.0
    src_runs = runs_p99(slum)
    # (b) encoding introduced no steps: low-passed encoded vs low-passed source differ < 1 level
    def box(L):
        P = np.pad(L, k, mode="edge").cumsum(0).cumsum(1)
        return (P[k:-k, k:-k] - P[:-2*k, k:-k] - P[k:-k, :-2*k] + P[:-2*k, :-2*k]) / (k * k)
    dev = (box(lum) - box(slum))[mask]
    dev = np.abs(dev - np.median(dev))   # remove the constant RGB<->YUV round-trip offset
    dev99 = float(np.percentile(dev, 99)) if dev.size else 0.0
    ok4 = area > 0.02 and src_runs <= 6 and dev99 < 1.0
    log(f"  step4 {'PASS' if ok4 else 'FAIL'}: smooth dark-gradient area {area*100:.1f}%; source dither flat-run p99 {src_runs:.1f}px; "
        f"encoded-vs-source low-pass deviation p99 {dev99:.2f}/255")
    # contrast-stretched crop of the masked area for eyeballing
    st = np.clip((lum - np.percentile(lum[mask], 1)) * 255 / max(1, np.percentile(lum[mask], 99) - np.percentile(lum[mask], 1)), 0, 255) if area > 0 else lum
    Image.fromarray(st.astype(np.uint8)).save(V / f"banding_stretch_{name}.png")
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
