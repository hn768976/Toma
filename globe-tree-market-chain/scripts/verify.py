#!/usr/bin/env python3
"""Verification loop for the 720p previews.

  python3 scripts/verify.py probe            # Step 1: ffprobe checks
  python3 scripts/verify.py loop  [ids...]   # Step 2: loop frames identical
  python3 scripts/verify.py determinism [ids...]  # Step 3: cold frame 150 == full-render frame 150
  python3 scripts/verify.py banding          # Step 4: profiles from the encoded mp4
  python3 scripts/verify.py contact          # Step 5: 5 evenly spaced frames per preview

Needs ffmpeg/ffprobe, Pillow and numpy. Run from the project root.
"""
import hashlib, json, os, subprocess, sys
import numpy as np
from PIL import Image

SCALE = "0.3333333333333333"
COMPS = {
    "KeywordGlobe-TechBlue": ("KeywordGlobe_TechBlue", 600, (0, 600)),
    "KeywordGlobe-BusinessGold": ("KeywordGlobe_BusinessGold", 600, (0, 600)),
    "CircuitTree-Blue": ("CircuitTree_Blue", 600, (240, 600)),
    "CircuitTree-EcoGreen": ("CircuitTree_EcoGreen", 600, (240, 600)),
    "MarketDashboard": ("MarketDashboard", 600, (0, 600)),
    "BlockchainPanels-IceBlue": ("BlockchainPanels_IceBlue", 600, (0, 600)),
    "BlockchainBuild-Teal": ("BlockchainBuild_Teal", 450, None),
}
ENV = dict(os.environ)
os.makedirs("out/check", exist_ok=True)


def still(cid, frame, path, props=None):
    cmd = ["npx", "remotion", "still", cid, path, f"--frame={frame}", f"--scale={SCALE}", "--timeout=180000", "--log=error"]
    if props:
        cmd.append("--props=" + json.dumps(props))
    subprocess.run(cmd, check=True, env=ENV)


def pix(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(np.int16)


def md5(p):
    return hashlib.md5(open(p, "rb").read()).hexdigest()


def probe():
    ok = True
    for cid, (name, frames, _) in COMPS.items():
        f = f"out/previews/{name}.mp4"
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames",
                              "-show_entries", "format=duration", "-of", "json", f], capture_output=True, text=True).stdout
        j = json.loads(out)
        s = j["streams"]
        v = [x for x in s if x["codec_type"] == "video"][0]
        a = [x for x in s if x["codec_type"] == "audio"]
        dur = float(j["format"]["duration"])
        exp = frames / 30
        good = (v["width"], v["height"], v["r_frame_rate"], v["codec_name"], v["pix_fmt"]) == (1280, 720, "30/1", "h264", "yuv420p") and not a and abs(dur - exp) < 0.02
        ok &= good
        print(f"{'PASS' if good else 'FAIL'} {name}: {v['width']}x{v['height']} {v['r_frame_rate']} {v['codec_name']} {v['pix_fmt']} audio={len(a)} duration={dur:.3f}s (expected {exp:.1f}s) frames={v.get('nb_frames')}")
    return ok


def loop(ids):
    ok = True
    for cid in ids or COMPS:
        pair = COMPS[cid][2]
        if not pair:
            continue
        a, b = pair
        # Extend to 601 frames (loopCheck) so frame 600 exists. Looks 1/3/4
        # compare 0 vs 600; look 2 compares 240 vs 600 (the hold loop).
        pa, pb = f"out/check/{cid}-loop-{a}.png", f"out/check/{cid}-loop-{b}.png"
        still(cid, a, pa, {"loopCheck": True})
        still(cid, b, pb, {"loopCheck": True})
        d = np.abs(pix(pa) - pix(pb))
        same = d.max() == 0
        ok &= same
        print(f"{'PASS' if same else 'FAIL'} loop {cid}: frame {a} vs {b} max diff {d.max()}, differing px {(d.max(axis=2) > 0).sum()}")
    return ok


def determinism(ids):
    ok = True
    for cid in ids or COMPS:
        cold = f"out/check/{cid}-cold-150.png"
        still(cid, 150, cold)
        seq = f"out/seq/{cid}"
        files = sorted(os.listdir(seq))
        full = os.path.join(seq, files[150])
        same_bytes = md5(cold) == md5(full)
        d = np.abs(pix(cold) - pix(full)).max()
        ok &= same_bytes
        print(f"{'PASS' if same_bytes else 'FAIL'} determinism {cid}: cold still vs {files[150]} md5 {'equal' if same_bytes else 'differ'}, max pixel diff {d}")
    return ok


def banding():
    """Read the luma plane of frame 150 straight from the encoded mp4.
    In smooth regions (glows, gradients: low local gradient, not clipped),
    banding shows up as long runs of identical values. With the grain and
    dither in place, runs stay short. FAIL if any run in a smooth region is
    32 px or longer. Also prints sample values across one glow/gradient."""
    probes = {
        "KeywordGlobe_TechBlue": ("row", 24, 440, 840, "beam glow at the top edge"),
        "CircuitTree_Blue": ("col", 90, 0, 560, "sky gradient"),
        "MarketDashboard": ("col", 1270, 0, 300, "vignette / background falloff"),
        "BlockchainPanels_IceBlue": ("col", 640, 0, 200, "far background falloff"),
    }
    ok = True
    for name, (kind, idx, a, b, what) in probes.items():
        raw = f"out/check/{name}-mp4-150.y"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"out/previews/{name}.mp4", "-vf", "select=eq(n\\,150)",
                        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", raw], check=True)
        Y = np.fromfile(raw, dtype=np.uint8).reshape(720, 1280).astype(np.float64)
        # smooth-region mask: 15x15 box-filtered gradient magnitude is small
        from numpy.lib.stride_tricks import sliding_window_view as swv
        pad = np.pad(Y, 7, mode="edge")
        box = swv(pad, (15, 15)).mean(axis=(2, 3))
        gy, gx = np.gradient(box)
        smooth = (np.hypot(gx, gy) < 1.5) & (Y > 3) & (Y < 250)
        longest = 0
        for y in range(720):
            row, m = Y[y], smooth[y]
            run = 1
            for x in range(1, 1280):
                if m[x] and m[x - 1] and row[x] == row[x - 1]:
                    run += 1
                    longest = max(longest, run)
                else:
                    run = 1
        prof = Y[idx, a:b] if kind == "row" else Y[a:b, idx]
        good = longest < 32
        ok &= good
        print(f"{'PASS' if good else 'FAIL'} banding {name}: smooth-region pixels {smooth.mean()*100:.0f}%, longest identical run {longest}px (limit 32)")
        print(f"    {what} ({kind} {idx}, {a}-{b}), every 10th px, raw luma:", " ".join(f"{v:.0f}" for v in prof[::10]))
        sm = np.convolve(prof, np.ones(9) / 9, mode="valid")
        print(f"    same profile, 9px-smoothed, every 10th px:", " ".join(f"{v:.1f}" for v in sm[::10]))
    return ok


def contact():
    for cid, (name, frames, _) in COMPS.items():
        f = f"out/previews/{name}.mp4"
        sel = "+".join(f"eq(n\\,{int(i * (frames - 1) / 4)})" for i in range(5))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f, "-vf", f"select='{sel}',scale=640:-1,tile=5x1", "-frames:v", "1", "-vsync", "0", f"out/check/{name}-contact.png"], check=True)
        print("wrote", f"out/check/{name}-contact.png")
    return True


if __name__ == "__main__":
    step, ids = sys.argv[1], sys.argv[2:]
    r = {"probe": probe, "loop": lambda: loop(ids), "determinism": lambda: determinism(ids), "banding": banding, "contact": contact}[step]()
    print("RESULT", "PASS" if r else "FAIL")
    sys.exit(0 if r else 1)
