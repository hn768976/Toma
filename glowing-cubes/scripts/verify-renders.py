#!/usr/bin/env python3
"""
Checks the rendered 1080p previews (verify loop, steps 1 and 3–6).

  python3 scripts/verify-renders.py [--skip-cold]

Needs: ffmpeg/ffprobe on PATH, Python 3 with numpy + Pillow.
Reads  out/previews/<Name>.mp4  and  out/frames/<CompId>/element-NNN.png
Writes out/verify/ (contact sheets, banding profiles, overlays, report.json)
"""
import hashlib, json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out")
VER = os.path.join(OUT, "verify")
os.makedirs(VER, exist_ok=True)

LOOK1 = ["CubeCluster-Green", "CubeCluster-Violet", "CubeCluster-Blue"]
LOOK2 = ["CubeAssembly-Blue", "CubeAssembly-Violet", "CubeAssembly-Green"]
DUR = {**{c: 20.0 for c in LOOK1}, **{c: 10.0 for c in LOOK2}}
FRAMES = {**{c: 600 for c in LOOK1}, **{c: 300 for c in LOOK2}}

report = {}
fails = []

def mp4(cid):
    return os.path.join(OUT, "previews", cid.replace("-", "_") + ".mp4")

def frame_png(cid, f):
    return os.path.join(OUT, "frames", cid, "element-%03d.png" % f)

def decode(cid, f):
    """Decode frame f of the encoded mp4 to an RGB array."""
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4(cid), "-vf", f"select=eq(n\\,{f})", "-vframes", "1",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(out, np.uint8).reshape(1080, 1920, 3)

def fail(cid, msg):
    fails.append(f"{cid}: {msg}")
    print("   FAIL", msg)

skip_cold = "--skip-cold" in sys.argv

for cid in LOOK1 + LOOK2:
    r = report.setdefault(cid, {})
    print(f"\n== {cid}")
    path = mp4(cid)
    if not os.path.exists(path):
        fail(cid, "missing mp4"); continue

    # ── Step 1: file checks ───────────────────────────────────────────────
    probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries",
        "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames:format=duration",
        "-of", "json", path], capture_output=True, check=True).stdout)
    streams = probe["streams"]; v = [s for s in streams if s["codec_type"] == "video"][0]
    audio = [s for s in streams if s["codec_type"] == "audio"]
    dur = float(probe["format"]["duration"])
    r["probe"] = {"codec": v["codec_name"], "size": f'{v["width"]}x{v["height"]}', "fps": v["r_frame_rate"],
                  "pix_fmt": v["pix_fmt"], "frames": int(v["nb_frames"]), "duration": dur, "audio_streams": len(audio)}
    print("   step1", r["probe"])
    if (v["width"], v["height"]) != (1920, 1080): fail(cid, "resolution")
    if v["r_frame_rate"] != "30/1": fail(cid, "frame rate")
    if v["codec_name"] != "h264": fail(cid, "codec")
    if v["pix_fmt"] != "yuv420p": fail(cid, "pix_fmt")
    if abs(dur - DUR[cid]) > 0.001: fail(cid, f"duration {dur}")
    if int(v["nb_frames"]) != FRAMES[cid]: fail(cid, f"frame count {v['nb_frames']}")
    if audio: fail(cid, "has audio")

    # ── Step 3: cold single frame vs the full render (byte for byte) ──────
    if not skip_cold:
        cold = os.path.join(VER, f"{cid}_cold150.png")
        subprocess.run(["npx", "remotion", "still", cid, cold, "--frame=150", "--scale=0.5"], cwd=ROOT,
                       capture_output=True, check=True)
        a, b = open(cold, "rb").read(), open(frame_png(cid, 150), "rb").read()
        same = a == b
        r["cold150_byte_identical"] = same
        r["cold150_sha256"] = hashlib.sha256(a).hexdigest()[:16]
        print("   step3 cold frame 150 byte-identical to full render:", same)
        if not same: fail(cid, "frame 150 cold render differs from full render")

    # encoded vs source frames (sanity: encoding is faithful)
    src = np.asarray(Image.open(frame_png(cid, 150)).convert("RGB")).astype(float)
    enc = decode(cid, 150).astype(float)
    psnr = 10 * np.log10(255 ** 2 / np.mean((src - enc) ** 2))
    r["psnr_frame150_mp4_vs_png"] = round(psnr, 2)
    print(f"   mp4 vs PNG frame 150 PSNR {psnr:.1f} dB")

    # ── Step 4: every 15th frame of the mp4 — no unlit / missing frames ───
    stats = []
    sheet = []
    for f in range(0, FRAMES[cid], 15):
        im = decode(cid, f)
        lum = im.astype(float) @ [0.2126, 0.7152, 0.0722]
        stats.append((f, lum.mean(), lum.std(), (lum > 200).mean()))
        sheet.append(Image.fromarray(im).resize((320, 180)))
    cols = 8
    rows = (len(sheet) + cols - 1) // cols
    cs = Image.new("RGB", (cols * 320, rows * 180))
    for i, t in enumerate(sheet):
        cs.paste(t, ((i % cols) * 320, (i // cols) * 180))
        ImageDraw.Draw(cs).text(((i % cols) * 320 + 4, (i // cols) * 180 + 4), str(i * 15), fill=(255, 255, 0))
    cs.save(os.path.join(VER, f"{cid}_every15.png"))
    means = np.array([s[1] for s in stats])
    # a frame rendered without the environment / reflections shows as a sudden
    # drop against its neighbours
    jumps = [abs(means[i] - (means[i - 1] + means[i + 1]) / 2) for i in range(1, len(means) - 1)]
    r["every15_mean_luma_range"] = [round(means.min(), 1), round(means.max(), 1)]
    r["every15_max_outlier"] = round(max(jumps), 2) if jumps else 0
    print(f"   step4 {len(stats)} frames, mean luma {means.min():.1f}–{means.max():.1f}, biggest outlier vs neighbours {r['every15_max_outlier']}")

    # ── Step 5: banding — floor profile from the lit centre to the edge ───
    fb = 300 if cid in LOOK1 else 250
    im = decode(cid, fb)
    Image.fromarray(im).save(os.path.join(VER, f"{cid}_frame{fb}_from_mp4.png"))
    lum = im.astype(float) @ [0.2126, 0.7152, 0.0722]
    # floor-only line: bottom-left region, from below the subject toward the frame corner
    y0, x0 = (1000, 960) if cid in LOOK1 else (1040, 700)
    xs = np.arange(x0, -1, -1)
    raw = im[y0, xs, :]  # one raw row (8-bit)
    band = lum[y0 - 20:y0 + 21, xs].mean(axis=0)  # 41-row average (removes grain, keeps any steps)
    # longest run of identical raw values in any channel — banding shows as long flat runs
    def longest_run(a):
        best = cur = 1
        for i in range(1, len(a)):
            cur = cur + 1 if a[i] == a[i - 1] else 1
            best = max(best, cur)
        return best
    runs = [longest_run(raw[:, c]) for c in range(3)]
    # smoothed profile: steps would show as isolated jumps much larger than the local slope
    k = 25
    sm = np.convolve(band, np.ones(k) / k, mode="valid")
    d = np.abs(np.diff(sm))
    r["banding"] = {"row": y0, "from_x": int(x0), "values_start_end": [round(band[:20].mean(), 1), round(band[-20:].mean(), 1)],
                    "longest_flat_run_px_rgb": runs, "max_step_in_smoothed_profile": round(float(d.max()), 3)}
    print("   step5", r["banding"])
    # plot
    W, H = 960, 300
    pl = Image.new("RGB", (W, H), (20, 20, 20)); dr = ImageDraw.Draw(pl)
    lo, hi = band.min() - 2, band.max() + 2
    pts = [(int(i / len(band) * W), int(H - (band[i] - lo) / (hi - lo) * H)) for i in range(len(band))]
    dr.line(pts, fill=(80, 200, 255))
    rr = raw.astype(float) @ [0.2126, 0.7152, 0.0722]
    pts2 = [(int(i / len(rr) * W), int(H - (rr[i] - lo) / (hi - lo) * H)) for i in range(len(rr))]
    dr.point(pts2, fill=(255, 160, 60))
    dr.text((6, 6), f"{cid} frame {fb}: luma along row {y0}, x {x0}→0 (blue: 41-row mean, orange: raw row)", fill=(230, 230, 230))
    pl.save(os.path.join(VER, f"{cid}_banding_profile.png"))
    if max(runs) > 60: fail(cid, f"long flat run {max(runs)} px — banding")

    # ── Step 6: five evenly spaced frames ─────────────────────────────────
    n = FRAMES[cid]
    picks = [0, n // 4, n // 2, 3 * n // 4, n - 1]
    cs = Image.new("RGB", (5 * 480, 270))
    for i, f in enumerate(picks):
        cs.paste(Image.fromarray(decode(cid, f)).resize((480, 270)), (i * 480, 0))
        ImageDraw.Draw(cs).text((i * 480 + 4, 4), str(f), fill=(255, 255, 0))
    cs.save(os.path.join(VER, f"{cid}_five.png"))

# ── Step 6: identical layouts across palettes ─────────────────────────────
def mask(img, bg_thresh):
    lum = np.asarray(img.convert("L")).astype(float)
    return lum > bg_thresh

def layout_compare(group, f, name):
    ims = [Image.open(frame_png(c, f)).convert("RGB") for c in group]
    lums = [np.asarray(i.convert("L")).astype(float) for i in ims]
    # structure: gradient magnitude (edges) — independent of hue
    def edges(l):
        gx = np.abs(np.diff(l, axis=1))[:-1, :]; gy = np.abs(np.diff(l, axis=0))[:, :-1]
        return (gx + gy) > 24
    es = [edges(l) for l in lums]
    ious = []
    for i in range(len(es)):
        for j in range(i + 1, len(es)):
            inter = (es[i] & es[j]).sum(); union = (es[i] | es[j]).sum()
            ious.append(round(inter / union, 3))
    ov = np.stack([l / max(l.max(), 1) * 255 for l in lums], axis=2).astype(np.uint8)
    Image.fromarray(ov).save(os.path.join(VER, f"{name}_overlay_frame{f}.png"))
    print(f"\n{name} frame {f}: edge-map IoU between palettes {ious} (overlay R/G/B = {', '.join(group)})")
    return ious

report["layout_identity_look1_f300"] = layout_compare(LOOK1, 300, "Look1")
report["layout_identity_look2_f150"] = layout_compare(LOOK2, 150, "Look2")
report["layout_identity_look2_f250"] = layout_compare(LOOK2, 250, "Look2")

json.dump({"report": report, "fails": fails}, open(os.path.join(VER, "report.json"), "w"), indent=1)
print("\nFAILS:" if fails else "\nNo automated failures.", *fails, sep="\n  ")
