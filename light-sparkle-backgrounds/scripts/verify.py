"""Verify loop steps 1, 3, 4, 5, 6 on the rendered previews.
Usage: python3 -I scripts/verify.py [ids...]   (run from the project root)
Needs: out/previews/*.mp4, out/frames/<id>/f*.png (from render-preview.mjs),
       out/cold/<id>_f300.png (cold single-frame still of frame 300)."""
import hashlib, json, os, subprocess, sys
import numpy as np
from PIL import Image

ALL = ["SpotlightSparkles-Blue", "SpotlightSparkles-Gold", "PastelBokeh-PinkLavender", "PastelBokeh-MintAqua",
       "SunFlare-Midday", "SunFlare-GoldenHour", "StarTwinkle-Black", "SilkLight-PaleBlue"]
ids = sys.argv[1:] or ALL
os.makedirs("out/verify", exist_ok=True)
report = json.load(open("out/verify/report.json")) if os.path.exists("out/verify/report.json") else {}

def frame_from_mp4(mp4, n, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", f"select=eq(n\\,{n})", "-frames:v", "1", out], check=True)
    return np.array(Image.open(out).convert("RGB")).astype(np.int32)

def probe(mp4):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames",
                          "-show_entries", "format=duration", "-of", "json", mp4], capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    v = [s for s in j["streams"] if s["codec_type"] == "video"]
    a = [s for s in j["streams"] if s["codec_type"] == "audio"]
    s = v[0]
    ok = (s["codec_name"] == "h264" and s["width"] == 1280 and s["height"] == 720 and s["r_frame_rate"] == "30/1"
          and s["pix_fmt"] == "yuv420p" and not a and abs(float(j["format"]["duration"]) - 20.0) < 0.001)
    return ok, {"codec": s["codec_name"], "size": f'{s["width"]}x{s["height"]}', "fps": s["r_frame_rate"], "pix_fmt": s["pix_fmt"],
                "audio_streams": len(a), "duration": float(j["format"]["duration"]), "frames": s.get("nb_frames")}

def line_stats(img, axis, pos, lo, hi, width=1):
    """Profile along a full row (axis=0) or column (axis=1). Returns banding stats on luma."""
    luma = img @ np.array([0.2126, 0.7152, 0.0722])
    if axis == 0:
        strip = luma[pos - width // 2: pos + width // 2 + 1, lo:hi].mean(0)
        raw = img[pos, lo:hi]
    else:
        strip = luma[lo:hi, pos - width // 2: pos + width // 2 + 1].mean(1)
        raw = img[lo:hi, pos]
    # Longest run of identical RGB values along the raw line: plateaus mean banding.
    same = np.all(raw[1:] == raw[:-1], axis=1)
    run = best = 0
    for s_ in same:
        run = run + 1 if s_ else 0
        best = max(best, run)
    # Smoothness of a 31-px moving average: the largest jump between neighbours.
    k = 31
    ma = np.convolve(strip, np.ones(k) / k, mode="valid")
    jumps = np.abs(np.diff(ma))
    return {"maxIdenticalRun": int(best + 1 if best else 1), "maxMAJump": round(float(jumps.max()), 3),
            "range": [round(float(strip.min()), 1), round(float(strip.max()), 1)]}

for id_ in ids:
    file = id_.replace("-", "_", 1)
    mp4 = f"out/previews/{file}.mp4"
    r = report.setdefault(id_, {})
    # Step 1
    ok, info = probe(mp4)
    r["step1"] = {"pass": ok, **info}
    # Step 3: cold still vs frame 300 of the full render (lossless PNGs)
    cold = f"out/cold/{id_}_f300.png"
    full = f"out/frames/{id_}/f300.png"
    if os.path.exists(cold) and os.path.exists(full):
        a = np.array(Image.open(cold)); b = np.array(Image.open(full))
        r["step3"] = {"pass": bool(a.shape == b.shape and (a == b).all()),
                      "pixels_identical": bool(a.shape == b.shape and (a == b).all()),
                      "file_bytes_identical": hashlib.sha256(open(cold, "rb").read()).hexdigest() == hashlib.sha256(open(full, "rb").read()).hexdigest()}
    # Step 4: banding / black level on a frame decoded from the mp4
    img = frame_from_mp4(mp4, 300, f"out/verify/{id_}_mp4_f300.png")
    H, W = img.shape[:2]
    lines = {}
    for name, (axis, pos) in {"col_center": (1, W // 2), "col_quarter": (1, W // 4), "col_3q": (1, 3 * W // 4),
                              "row_top": (0, H // 6), "row_mid": (0, H // 2), "row_bottom": (0, 5 * H // 6)}.items():
        lo, hi = 0, (H if axis == 1 else W)
        lines[name] = line_stats(img, axis, pos, lo, hi, width=9)
    r["step4_lines"] = lines
    if id_.startswith("StarTwinkle"):
        src = np.array(Image.open(full).convert("RGB")).astype(np.int32)
        mx = src.max(2)
        # points whose 31x31 neighbourhood is empty in the lossless frame ("away from the stars")
        from numpy.lib.stride_tricks import sliding_window_view
        pad = np.pad(mx, 15)
        neigh = sliding_window_view(pad, (31, 31)).max(axis=(2, 3))
        ys, xs = np.nonzero(neigh == 0)
        rng = np.random.default_rng(42)
        sel = rng.choice(len(ys), size=50, replace=False)
        vals = img[ys[sel], xs[sel]]
        r["step4_black"] = {"samples": 50, "max": int(vals.max()), "all_zero": bool((vals == 0).all()),
                            "within_1": bool((vals <= 1).all()), "values": vals.tolist()[:10],
                            "lossless_frame_zero_fraction": round(float((mx == 0).mean()), 4)}
    # Step 5: contact sheet (five evenly spaced frames) from the mp4
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf",
                    "select='eq(n\\,0)+eq(n\\,120)+eq(n\\,240)+eq(n\\,360)+eq(n\\,480)',scale=384:216,tile=5x1",
                    "-frames:v", "1", "-fps_mode", "passthrough", f"out/verify/{id_}_contact.png"], check=True)
    # Step 6: 2 s around frame 300 from the mp4: frame-to-frame change and the loop seam
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "9", "-t", "2", "-i", mp4, "-c", "copy", f"out/verify/{id_}_2s.mp4"], check=True)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-vf", "scale=320:180", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, 180, 320, 3).astype(np.float32)
    d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2, 3))
    seam = float(np.abs(fr[0] - fr[-1]).mean())
    win = d[270:330]
    r["step6"] = {"frames": int(fr.shape[0]), "meanDiff_270_330": round(float(win.mean()), 3), "maxDiff_270_330": round(float(win.max()), 3),
                  "maxOverMedian_270_330": round(float(win.max() / max(1e-6, np.median(win))), 2),
                  "seamDiff_599_to_0": round(seam, 3), "medianDiff_all": round(float(np.median(d)), 3),
                  "maxDiff_all": round(float(d.max()), 3)}
    json.dump(report, open("out/verify/report.json", "w"), indent=2)
    print(id_, json.dumps({k: r[k] for k in r if k != "step4_lines"}))
    print("   lines", json.dumps(lines))
