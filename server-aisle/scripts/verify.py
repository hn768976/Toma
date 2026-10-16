#!/usr/bin/env python3
"""Verify loop for the 720p previews (steps 1-6 of the brief).

Run from the project root after scripts/render-all.sh:
    python3 scripts/verify.py [Name ...]
Writes out/verify/report.json and contact sheets to out/verify/.
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

COMPS = [
    ("ServerAisle-Steel", "ServerAisle_Steel", 600, True),
    ("FrameTunnel-WhiteBurst", "FrameTunnel_WhiteBurst", 180, False),
    ("FrameTunnel-CyanMagenta", "FrameTunnel_CyanMagenta", 600, True),
    ("StreamCorridor-Blue", "StreamCorridor_Blue", 600, True),
    ("ScreenCorridor-GreenBlue", "ScreenCorridor_GreenBlue", 600, True),
    ("ScreenCorridor-AmberTeal", "ScreenCorridor_AmberTeal", 600, True),
    ("StageBeams-Steel", "StageBeams_Steel", 600, True),
    ("StageBeams-Amber", "StageBeams_Amber", 600, True),
]
PREV = Path("out/previews")
SEQ = Path("out/seq")
VER = Path("out/verify")
VER.mkdir(parents=True, exist_ok=True)
SCALE = "--scale=0.3333333333333333"


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def still(comp, frame, path, props=None):
    cmd = ["npx", "remotion", "still", comp, str(path), f"--frame={frame}", SCALE, "--log=error"]
    if props:
        cmd.append("--props=" + json.dumps(props))
    run(cmd)


def px(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(np.int16)


def md5(path):
    return hashlib.md5(np.asarray(Image.open(path).convert("RGB")).tobytes()).hexdigest()


def mp4_frame(name, idx, path):
    run(["ffmpeg", "-v", "error", "-y", "-i", str(PREV / f"{name}.mp4"), "-vf", f"select=eq(n\\,{idx})",
         "-vsync", "0", "-frames:v", "1", str(path)])


def probe(name):
    out = run(["ffprobe", "-v", "error", "-show_entries",
               "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames",
               "-show_entries", "format=duration", "-of", "json", str(PREV / f"{name}.mp4")])
    return json.loads(out)


def step1(name, frames):
    j = probe(name)
    streams = j["streams"]
    v = [s for s in streams if s["codec_type"] == "video"][0]
    audio = [s for s in streams if s["codec_type"] == "audio"]
    dur = float(j["format"]["duration"])
    ok = (v["codec_name"] == "h264" and v["width"] == 1280 and v["height"] == 720
          and v["r_frame_rate"] == "30/1" and v["pix_fmt"] == "yuv420p" and not audio
          and abs(dur - frames / 30) < 0.02)
    return {"ok": ok, "codec": v["codec_name"], "size": f'{v["width"]}x{v["height"]}', "fps": v["r_frame_rate"],
            "pix_fmt": v["pix_fmt"], "audio_streams": len(audio), "duration": dur, "nb_frames": v.get("nb_frames")}


def step2(comp, name):
    a = VER / f"{name}_loop0.png"
    b = VER / f"{name}_loop600.png"
    still(comp, 0, a, {"loopCheck": True})
    still(comp, 600, b, {"loopCheck": True})
    d = np.abs(px(a) - px(b))
    # Seam smoothness: the 599 -> 0 step must look like any other step.
    seq = SEQ / name
    def diff(i, j):
        return float(np.abs(px(seq / f"element-{i:03d}.png") - px(seq / f"element-{j:03d}.png")).mean())
    seam = diff(599, 0)
    mids = [diff(i, i + 1) for i in (100, 200, 299, 400, 500)]
    return {"ok": int(d.max()) == 0, "max_diff_0_vs_600": int(d.max()),
            "seam_599_to_0": round(seam, 4), "typical_steps": [round(m, 4) for m in mids],
            "seam_ratio": round(seam / max(1e-6, float(np.median(mids))), 3)}


def step3(comp, name, frames):
    mid = frames // 2
    cold = VER / f"{name}_cold{mid}.png"
    still(comp, mid, cold)
    full = SEQ / name / f"element-{mid:03d}.png"
    a, b = md5(cold), md5(full)
    return {"ok": a == b, "frame": mid, "cold_md5": a, "full_md5": b,
            "max_diff": int(np.abs(px(cold) - px(full)).max())}


def step4(name, frames):
    res = {}
    f = VER / f"{name}_mp4mid.png"
    mp4_frame(name, frames // 2 if frames > 180 else 60, f)
    im = px(f).astype(np.float32)
    lum = 0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]
    # Banding probe: in the darkest smooth regions, steps show up as large
    # runs of identical values followed by jumps. Look at a heavily
    # smoothed version vs the raw: count distinct levels per dark row
    # segment and the largest jump between neighbouring pixels of a
    # box-filtered row (should be <= 2 code values for smooth gradients).
    rows = {}
    for y in (60, 200, 360, 520, 660):
        r = lum[y]
        k = np.ones(9) / 9
        sm = np.convolve(r, k, mode="valid")
        dark = sm < 60
        jumps = np.abs(np.diff(sm))[dark[1:]] if dark[1:].any() else np.array([0.0])
        rows[y] = {"max_jump_smoothed": round(float(jumps.max()), 2),
                   "sample": [int(v) for v in r[::128]]}
    res["rows"] = rows
    res["ok"] = all(v["max_jump_smoothed"] <= 6 for v in rows.values())
    if name == "FrameTunnel_WhiteBurst":
        rng = np.random.default_rng(7)
        pts = rng.integers([0, 0], [720, 1280], size=(50, 2))
        worst = 255
        for i in range(frames - 12, frames):
            g = VER / f"white_{i}.png"
            mp4_frame(name, i, g)
            a = px(g)
            vals = a[pts[:, 0], pts[:, 1]]
            worst = min(worst, int(vals.min()))
        res["white_min_last12"] = worst
        res["white_ok"] = worst >= 254
        res["ok"] = res["ok"] and res["white_ok"]
    return res


def step5(name, frames):
    n = 8 if frames == 180 else 5
    idx = [int(round(i * (frames - 1) / (n - 1))) for i in range(n)]
    tiles = []
    for i in idx:
        p = VER / f"{name}_cs{i}.png"
        mp4_frame(name, i, p)
        tiles.append(Image.open(p).convert("RGB").resize((640, 360), Image.LANCZOS))
    cols = 4 if n == 8 else 5
    rows = (n + cols - 1) // cols
    sheet = Image.new("RGB", (640 * cols, 360 * rows))
    for k, t in enumerate(tiles):
        sheet.paste(t, ((k % cols) * 640, (k // cols) * 360))
    sheet.save(VER / f"{name}_contact.png")
    return {"frames": idx, "sheet": str(VER / f"{name}_contact.png")}


def step6(name, frames):
    # Frame-to-frame mean abs difference over 2 s around frame 300 (or the whole
    # transition): even camera motion gives a steady curve; a hitch is a spike.
    seq = SEQ / name
    rng_ = range(0, frames - 1) if frames == 180 else range(270, 329)
    d = []
    prev = px(seq / f"element-{rng_[0]:03d}.png")
    for i in rng_:
        cur = px(seq / f"element-{i + 1:03d}.png")
        d.append(float(np.abs(cur - prev).mean()))
        prev = cur
    d = np.array(d)
    med = float(np.median(d))
    return {"median_step": round(med, 4), "max_step": round(float(d.max()), 4),
            "max_over_median": round(float(d.max()) / max(med, 1e-6), 3)}


def main():
    only = set(sys.argv[1:])
    path = VER / "report.json"
    report = json.loads(path.read_text()) if path.exists() else {}
    for comp, name, frames, loop in COMPS:
        if only and name not in only:
            continue
        r = {"step1": step1(name, frames)}
        if loop:
            r["step2"] = step2(comp, name)
        r["step3"] = step3(comp, name, frames)
        r["step4"] = step4(name, frames)
        r["step5"] = step5(name, frames)
        r["step6"] = step6(name, frames)
        report[name] = r
        print(name, json.dumps(r, indent=1))
        path.write_text(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
