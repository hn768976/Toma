"""Checks the rendered previews: ffprobe properties, background levels, build-up and hold.

usage: python3 scripts/verify.py out/previews [Name ...]
Writes contact sheets to out/sheets/<Name>.png and a JSON report to out/verify.json.
"""
import json, subprocess, sys, os
import numpy as np
from PIL import Image

EXPECT = {
    "BranchingTree_Red": (30, "light"), "BranchingTree_Cyan": (30, "dark"),
    "PeopleLinkUp_Flip": (30, "flip"), "SocialCluster_Red": (20, "light"),
    "SocialCluster_White": (20, "dark"), "PeopleWorldMap_Red": (15, "light"),
    "PeopleWorldMap_Cyan": (15, "dark"), "PeopleGrid_Cyan": (25, "dark"),
    "PeopleBulb_White": (24, "dark"), "CrowdPlatform_Blue": (30, "dark"),
    "BigDataCrowd_Title": (18, "light"), "BigDataCrowd_Clean": (18, "light"),
}
LIGHT = np.array([251, 251, 250], float)
DARK = np.array([0, 0, 0], float)


def probe(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
        "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames:format=duration",
        "-of", "json", path])
    return json.loads(out)


def frames(path, n_total):
    """All frames, decoded once at full size (720p)."""
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo",
                                   "-pix_fmt", "rgb24", "-"])
    arr = np.frombuffer(raw, np.uint8).reshape(-1, 720, 1280, 3)
    return arr


def bg_check(arr, bgfn, rng):
    """50 empty points over 5 frames: among random candidates close to the background colour,
    take the ones whose 9x9 neighbourhood is the most uniform."""
    n = len(arr)
    vals = []
    for fi in [int(n * f) for f in (0.1, 0.3, 0.5, 0.7, 0.97)]:
        img = arr[fi].astype(float)
        bg = bgfn(fi)
        ys = rng.integers(5, 715, 4000)
        xs = rng.integers(5, 1275, 4000)
        cands = []
        for y, x in zip(ys, xs):
            p = img[y, x]
            if np.abs(p - bg).max() > 25:
                continue
            patch = img[y - 4:y + 5, x - 4:x + 5]
            cands.append((patch.std(), y, x))
        cands.sort()
        for _, y, x in cands[:10]:
            vals.append(img[y, x])
    vals = np.array(vals)
    return vals


def main():
    d = sys.argv[1]
    names = sys.argv[2:] or list(EXPECT)
    os.makedirs("out/sheets", exist_ok=True)
    report = {}
    rng = np.random.default_rng(1)
    for name in names:
        path = os.path.join(d, name + ".mp4")
        secs, kind = EXPECT[name]
        info = probe(path)
        streams = info["streams"]
        v = [s for s in streams if s["codec_type"] == "video"][0]
        audio = [s for s in streams if s["codec_type"] == "audio"]
        dur = float(info["format"]["duration"])
        r = {
            "codec": v["codec_name"], "size": f'{v["width"]}x{v["height"]}', "fps": v["r_frame_rate"],
            "pix_fmt": v["pix_fmt"], "frames": int(v["nb_frames"]), "duration": dur, "audio": len(audio),
        }
        r["probe_ok"] = (v["codec_name"] == "h264" and v["width"] == 1280 and v["height"] == 720
                         and v["r_frame_rate"] == "30/1" and v["pix_fmt"] == "yuv420p" and not audio
                         and int(v["nb_frames"]) == secs * 30)
        arr = frames(path, secs * 30)
        n = len(arr)
        if kind == "flip":
            bgfn = lambda fi: LIGHT if fi < 450 else DARK
        else:
            bgfn = lambda fi, k=kind: LIGHT if k == "light" else DARK
        vals = bg_check(arr, bgfn, rng)
        # Compare each point to the background of its own frame group.
        exp = np.array([bgfn(int(n * f)) for f in (0.1, 0.3, 0.5, 0.7, 0.97) for _ in range(10)])[: len(vals)]
        dev = np.abs(vals - exp).max(axis=1)
        r["bg_points"] = int(len(vals))
        r["bg_max_dev"] = float(dev.max())
        r["bg_values"] = sorted(set(tuple(int(c) for c in x) for x in vals))[:6]
        r["bg_ok"] = bool(dev.max() <= 1 and len(vals) == 50)
        # Density curve: share of pixels clearly off-background, every 10 frames.
        dens = []
        for fi in range(0, n, 10):
            img = arr[fi].astype(np.int16)
            bg = bgfn(fi).astype(np.int16)
            dens.append(float((np.abs(img - bg).max(axis=2) > 12).mean()))
        r["density"] = [round(x, 4) for x in dens]
        # Hold: mean absolute difference between the first and last frame of the final 2s.
        a = arr[n - 60].astype(float)
        b = arr[n - 1].astype(float)
        r["hold_mad"] = float(np.abs(a - b).mean())
        # Contact sheet: 12 frames.
        idx = [int(round(i * (n - 1) / 11)) for i in range(12)]
        tiles = [Image.fromarray(arr[i]).resize((426, 240), Image.LANCZOS) for i in idx]
        sheet = Image.new("RGB", (426 * 4, 240 * 3))
        for k, t in enumerate(tiles):
            sheet.paste(t, ((k % 4) * 426, (k // 4) * 240))
        sheet.save(f"out/sheets/{name}.png")
        report[name] = r
        print(name, {k: r[k] for k in ("probe_ok", "duration", "frames", "bg_ok", "bg_max_dev", "hold_mad")})
    old = {}
    if os.path.exists("out/verify.json"):
        old = json.load(open("out/verify.json"))
    old.update(report)
    json.dump(old, open("out/verify.json", "w"), indent=1, default=str)


main()
