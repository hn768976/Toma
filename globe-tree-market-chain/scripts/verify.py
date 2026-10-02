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
    # Look for flat steps along profiles through glows/gradients in frames decoded from the mp4.
    probes = {
        "KeywordGlobe_TechBlue": [("row", 360), ("col", 640), ("col", 160)],
        "CircuitTree_Blue": [("col", 200), ("row", 700), ("col", 640)],
        "MarketDashboard": [("col", 640), ("row", 40)],
        "BlockchainPanels_IceBlue": [("col", 640), ("row", 60)],
    }
    ok = True
    for name, lines in probes.items():
        png = f"out/check/{name}-mp4-150.png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"out/previews/{name}.mp4", "-vf", "select=eq(n\\,150)", "-frames:v", "1", png], check=True)
        img = pix(png).astype(np.float64)
        lum = img @ np.array([0.2126, 0.7152, 0.0722])
        for kind, idx in lines:
            prof = lum[idx, :] if kind == "row" else lum[:, idx]
            # smooth with a 9px box to remove grain, then look at the longest run of identical
            # quantised values (a band) inside a region whose overall slope is non-zero.
            k = np.ones(15) / 15
            sm = np.convolve(prof, k, mode="valid")
            steps = np.abs(np.diff(sm))
            raw_runs, run = [], 1
            q = np.round(prof)
            for i in range(1, len(q)):
                if q[i] == q[i - 1]:
                    run += 1
                else:
                    raw_runs.append(run)
                    run = 1
            raw_runs.append(run)
            longest = max(raw_runs)
            maxjump = steps.max()
            good = longest < 24 and maxjump < 6
            ok &= good
            print(f"{'PASS' if good else 'FAIL'} banding {name} {kind} {idx}: longest flat run {longest}px, max smoothed step {maxjump:.2f}, range {prof.min():.0f}-{prof.max():.0f}")
            print("    sample:", " ".join(f"{v:.0f}" for v in prof[:: max(1, len(prof) // 24)]))
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
