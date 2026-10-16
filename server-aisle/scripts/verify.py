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


# Smooth gradient regions per composition (x0, y0, x1, y1, axis, mp4 frame).
# axis "v": profile runs top->bottom (averaged across x); "h": left->right.
BAND_REGIONS = {
    "ServerAisle_Steel": [(900, 650, 1270, 715, "h", 300), (900, 5, 1270, 60, "h", 300)],
    "FrameTunnel_WhiteBurst": [(20, 300, 220, 420, "h", 60), (560, 280, 720, 400, "v", 120)],
    "FrameTunnel_CyanMagenta": [(600, 320, 680, 400, "v", 300), (0, 250, 60, 470, "h", 300)],
    "StreamCorridor_Blue": [(590, 60, 690, 300, "v", 300), (600, 420, 680, 715, "v", 300)],
    "ScreenCorridor_GreenBlue": [(560, 20, 720, 200, "v", 300), (560, 560, 720, 715, "v", 300)],
    "ScreenCorridor_AmberTeal": [(560, 20, 720, 200, "v", 300), (560, 560, 720, 715, "v", 300)],
    "StageBeams_Steel": [(560, 60, 720, 560, "v", 300), (20, 80, 300, 600, "h", 300)],
    "StageBeams_Amber": [(560, 60, 720, 560, "v", 300), (20, 80, 300, 600, "h", 300)],
}


def step4(name, frames):
    """Banding probe on frames decoded from the encoded mp4.

    Each region is averaged across its short axis (this removes grain and
    dither and leaves the underlying gradient). A banded gradient shows as
    plateaus separated by isolated jumps of >= 1 code value; a smooth one
    changes by small, even amounts. We report the averaged profile, the
    largest single step and the number of steps above 1.5 code values.
    """
    res = {"regions": []}
    ok = True
    for (x0, y0, x1, y1, axis, fi) in BAND_REGIONS[name]:
        f = VER / f"{name}_band{fi}.png"
        if not f.exists():
            mp4_frame(name, fi, f)
        im = px(f).astype(np.float32)
        lum = 0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]
        reg = lum[y0:y1, x0:x1]
        prof = reg.mean(axis=1) if axis == "v" else reg.mean(axis=0)
        # Light 5-px box to suppress residual grain; real bands are wider.
        k = np.ones(5) / 5
        sm = np.convolve(prof, k, mode="valid")
        d = np.abs(np.diff(sm))
        big = int((d > 1.5).sum())
        r = {"region": [x0, y0, x1, y1, axis, fi], "min": round(float(prof.min()), 1),
             "max": round(float(prof.max()), 1), "max_step": round(float(d.max()), 3),
             "mean_step": round(float(d.mean()), 3), "steps_over_1.5": big,
             "profile_every_8px": [round(float(v), 1) for v in prof[::8]]}
        r["ok"] = big == 0
        ok = ok and r["ok"]
        res["regions"].append(r)
    res["ok"] = ok
    if name == "FrameTunnel_WhiteBurst":
        rng = np.random.default_rng(7)
        pts = rng.integers([0, 0], [720, 1280], size=(50, 2))
        worst = 255
        for i in range(frames - 12, frames):
            g = VER / f"white_{i}.png"
            mp4_frame(name, i, g)
            vals = px(g)[pts[:, 0], pts[:, 1]]
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
    steps = set((sys.argv[1].split("=")[1]).split(",")) if len(sys.argv) > 1 and sys.argv[1].startswith("--steps=") else None
    if steps:
        only = set(sys.argv[2:])
    for comp, name, frames, loop in COMPS:
        if only and name not in only:
            continue
        if steps:
            r = report.get(name, {})
            for st in steps:
                r[st] = {"step4": lambda: step4(name, frames), "step5": lambda: step5(name, frames),
                         "step1": lambda: step1(name, frames), "step6": lambda: step6(name, frames)}[st]()
            report[name] = r
            print(name, json.dumps({k: r[k] for k in steps}, indent=1))
            path.write_text(json.dumps(report, indent=1))
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
