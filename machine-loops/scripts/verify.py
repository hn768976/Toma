#!/usr/bin/env python3
"""Verify the 720p previews in out/ (run from the project root after
scripts/render-previews.sh). Needs ffmpeg/ffprobe, numpy and Pillow.

  python3 scripts/verify.py probe      # 1280x720, 30/1, h264, yuv420p, no audio, lengths
  python3 scripts/verify.py loops      # first frame == extra frame (loops 1-6), from PNG stills
  python3 scripts/verify.py levels     # background levels in the mp4s
  python3 scripts/verify.py key        # chroma key over grey: fringes and holes
  python3 scripts/verify.py numbers    # feet/metre ticks, zone lines, pressure tag
  python3 scripts/verify.py determinism
"""
import json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out")
CLIPS = {
    "SteampunkFrame_White": 300, "SteampunkFrame_Green": 300, "RobotWalk_Turnaround": 360,
    "RobotWalk_Loop": 300, "RobotWalk_Green": 300, "MachineBlueprint_Beam": 600,
    "OceanDepth_Labelled": 450, "OceanDepth_Clean": 450,
}
LOOPS = [k for k in CLIPS if not k.startswith("Ocean")]
SCALE = "0.3333333333333333"
results = []


def say(ok, msg):
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + msg)


def frame_rgb(mp4, n):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-vf", f"select=eq(n\\,{n})", "-vsync", "0",
                          "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(720, 1280, 3).astype(int)


def still(comp, frame, path, props=None):
    cmd = ["npx", "remotion", "still", os.environ.get("BUNDLE", "src/index.ts"), comp, path, f"--frame={frame}",
           f"--scale={SCALE}", "--gl=angle", "--log=error"]
    if props:
        cmd.append("--props=" + json.dumps(props))
    subprocess.run(cmd, cwd=ROOT, check=True)
    return np.array(Image.open(path).convert("RGB")).astype(int)


def probe():
    for name, n in CLIPS.items():
        p = os.path.join(OUT, name + ".mp4")
        info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-of", "json", p],
                                         capture_output=True, check=True).stdout)
        st = info["streams"]
        v = [s for s in st if s["codec_type"] == "video"][0]
        audio = any(s["codec_type"] == "audio" for s in st)
        ok = (v["width"], v["height"], v["r_frame_rate"], v["codec_name"], v["pix_fmt"], int(v["nb_read_frames"]), audio) == \
             (1280, 720, "30/1", "h264", "yuv420p", n, False)
        say(ok, f"probe {name}: {v['width']}x{v['height']} {v['r_frame_rate']} {v['codec_name']} {v['pix_fmt']} "
                f"{v['nb_read_frames']} frames ({int(v['nb_read_frames'])/30:.2f}s) audio={audio}")


def loops():
    tmp = tempfile.mkdtemp()
    for name in LOOPS:
        n = CLIPS[name]
        comp = name.replace("_", "-")
        a = still(comp, 0, f"{tmp}/{name}_0.png", {"loopCheck": True})
        b = still(comp, n, f"{tmp}/{name}_{n}.png", {"loopCheck": True})
        diff = int(np.abs(a - b).max())
        say(diff == 0, f"loop {name}: frame 0 vs frame {n} max channel diff {diff}")


def sample_points(rng, regions, k):
    pts = []
    for _ in range(k):
        x0, y0, x1, y1 = regions[rng.integers(len(regions))]
        pts.append((rng.integers(x0, x1), rng.integers(y0, y1)))
    return pts


def levels():
    rng = np.random.default_rng(7)
    edges = [(0, 0, 1280, 60), (0, 660, 1280, 720), (0, 0, 200, 720), (1080, 0, 1280, 720)]
    robot_bg = [(0, 0, 360, 720), (920, 0, 1280, 720)]
    spec = {
        "SteampunkFrame_White": ((255, 255, 255), 0, edges), "SteampunkFrame_Green": ((0, 255, 0), 2, edges),
        "RobotWalk_Turnaround": ((255, 255, 255), 0, robot_bg), "RobotWalk_Loop": ((255, 255, 255), 0, robot_bg),
        "RobotWalk_Green": ((0, 255, 0), 2, robot_bg),
    }
    for name, (rgb, tol, regions) in spec.items():
        worst = 0
        for n in (0, 77, 151, 233, CLIPS[name] - 1):
            f = frame_rgb(os.path.join(OUT, name + ".mp4"), n)
            for x, y in sample_points(rng, regions, 50):
                worst = max(worst, int(np.abs(f[y, x] - rgb).max()))
        say(worst <= tol, f"levels {name}: 250 background samples, max deviation {worst} (allowed {tol}) from {rgb}")
    for name in ("SteampunkFrame_White", "SteampunkFrame_Green"):
        worst = 0
        for n in (0, 151):
            f = frame_rgb(os.path.join(OUT, name + ".mp4"), n)
            for x, y in sample_points(rng, [(540, 300, 740, 410)], 30):
                worst = max(worst, int(np.abs(f[y, x] - (0, 255, 0)).max()))
        say(worst <= 2, f"levels {name} screen: 60 samples, max deviation {worst} from (0,255,0)")
    # black: every pixel with no line within 3 px
    name = "MachineBlueprint_Beam"
    worst = 0
    count = 0
    for n in (0, 150, 300, 450):
        f = frame_rgb(os.path.join(OUT, name + ".mp4"), n)
        m = f.max(axis=2)
        from numpy.lib.stride_tricks import sliding_window_view
        near = sliding_window_view(np.pad(m, 3), (7, 7)).max(axis=(2, 3))
        empty = near < 12
        count += int(empty.sum())
        if empty.any():
            worst = max(worst, int(m[empty].max()))
        ys, xs = np.nonzero(empty)
        idx = rng.choice(len(ys), 50, replace=False)
        worst = max(worst, int(m[ys[idx], xs[idx]].max()))
    say(worst <= 1, f"levels {name}: {count} empty pixels in 4 frames (incl. 200 random samples), max value {worst} (allowed 1)")


def key():
    """Chroma-key over mid-grey (ffmpeg chromakey=0x00FF00:0.12:0.05, keyed in 4:4:4 so the test
    itself adds no chroma subsampling). Counts, per frame:
      subject_green - non-key source pixels that come out visibly green (true spill/fringe)
      far_green     - green left more than 2 px away from the subject (a failed key; allowed: <= 92 px,
                      0.01% of the frame, for isolated 4:2:0 encoder pixels)
      holes         - solid subject pixels (not on the anti-aliased edge) the key made see-through
      band          - key pixels within 2 px of the subject that stay partly opaque: ffmpeg's
                      chromakey averages 3x3 pixels and 4:2:0 shares chroma over 2x2 blocks
                      (reported for information; a despilling keyer removes it)"""
    from numpy.lib.stride_tricks import sliding_window_view
    for name in ("SteampunkFrame_White", "SteampunkFrame_Green", "RobotWalk_Green"):
        worst = dict(subject_green=0, far_green=0, holes=0, band=0)
        for n in (0, 50, 100, 150, 200, 250):
            src = frame_rgb(os.path.join(OUT, name + ".mp4"), n)
            srcp = os.path.join(OUT, f"_src_{name}_{n}.png")
            Image.fromarray(src.astype(np.uint8)).save(srcp)
            raw = subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=c=0x808080:s=1280x720:d=1", "-i", srcp,
                                  "-filter_complex", "[1:v]format=yuva444p,chromakey=0x00FF00:0.12:0.05[k];[0:v][k]overlay=format=yuv444",
                                  "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
            os.remove(srcp)
            out = np.frombuffer(raw, np.uint8).reshape(720, 1280, 3).astype(int)
            Image.fromarray(out.astype(np.uint8)).save(os.path.join(OUT, f"key_{name}_{n}.png"))
            sg = src[..., 1] - np.maximum(src[..., 0], src[..., 2])
            keyish = sg >= 30  # key colour, including encoder-softened key pixels
            subject = ~keyish
            if name == "SteampunkFrame_White":
                subject &= src.min(axis=2) < 250  # the white background is not subject
            near_subject = sliding_window_view(np.pad(subject, 2), (5, 5)).any(axis=(2, 3))
            near_key = sliding_window_view(np.pad(keyish, 2), (5, 5)).any(axis=(2, 3))
            og = out[..., 1] - np.maximum(out[..., 0], out[..., 2])
            green = og > 40
            worst["subject_green"] = max(worst["subject_green"], int((green & subject & ~near_key).sum()))
            worst["far_green"] = max(worst["far_green"], int((green & keyish & ~near_subject).sum()))
            worst["band"] = max(worst["band"], int((green & keyish & near_subject).sum()))
            solid = subject & ~near_key
            worst["holes"] = max(worst["holes"], int((solid & (np.abs(out - src).max(axis=2) > 12)).sum()))
        ok = worst["subject_green"] == 0 and worst["far_green"] <= 92 and worst["holes"] == 0
        say(ok, f"key {name} (worst of 6 frames): subject pixels turned green {worst['subject_green']}, green left away "
                f"from the subject {worst['far_green']}, holes {worst['holes']}; 2-px keyer band {worst['band']}")


def numbers():
    data = json.load(open(os.path.join(ROOT, "data", "oceanDepth.json")))
    want = [656, 3281, 6562, 9843, 13123, 16404, 19685, 22966, 26247, 29528, 32808, 36089]
    got = [round(m * 3.28084) for m in data["metreTicks"]]
    say(got == want and data["metreTicks"] == [200] + list(range(1000, 12000, 1000)), f"ticks m->ft {got}")
    zones = [(z["topM"], z["bottomM"]) for z in data["zones"]]
    say(zones == [(0, 200), (200, 1000), (1000, 4000), (4000, 6000), (6000, 11000)], f"zone boundaries {zones}")
    # pressure tag from the same model the video uses
    js = """
    import { diveDepth, pressureMPa, depthToY, TICKS, ROW0, ROW } from "./depth_check.ts";
    const out = {};
    for (let f = 0; f < 450; f++) out[f] = diveDepth(f);
    const lines = [200, 1000, 4000, 6000].map((d) => [d, depthToY(d), ROW0 + TICKS.indexOf(d) * ROW]);
    console.log(JSON.stringify({ depth: out, lines, p: [200, 1000, 4000, 6000, 11000].map((d) => Math.round(pressureMPa(d))) }));
    """
    src = open(os.path.join(ROOT, "src/ocean/depth.ts")).read().replace(
        'import data from "../../data/oceanDepth.json";', f"const data = {json.dumps(data)};")
    tmp = tempfile.mkdtemp()
    open(f"{tmp}/depth_check.ts", "w").write(src)
    open(f"{tmp}/run.mts", "w").write(js)
    r = json.loads(subprocess.run(["node", f"{tmp}/run.mts"], capture_output=True, text=True, check=True).stdout)
    say(r["p"] == [2, 10, 40, 60, 110], f"pressure at 200/1000/4000/6000/11000 m: {r['p']} MPa")
    say(all(abs(a - b) < 1e-9 for _, a, b in r["lines"]), "zone lines sit exactly on their metre ticks")
    d = {int(k): v for k, v in r["depth"].items()}
    for target in (200, 1000, 4000, 6000):
        frames = [f for f, v in d.items() if abs(v - target) < 1e-9]
        say(len(frames) >= 8, f"sub pauses on the {target} m line for {len(frames)} frames, tag reads {round(target / 100)} MPa")
    end = [f for f, v in d.items() if v >= 11000]
    say(min(end) <= 390 and d[449] > 11000 and round(d[449] / 100) == 110,
        f"reaches {d[449]:.0f} m by frame {min(end)} (13 s = 390), holds to the end, tag {round(d[449] / 100)} MPa")


def determinism():
    tmp = tempfile.mkdtemp()
    for comp, mid in (("SteampunkFrame-White", 150), ("RobotWalk-Loop", 150), ("MachineBlueprint-Beam", 300), ("OceanDepth-Labelled", 225)):
        cold = still(comp, mid, f"{tmp}/{comp}_cold.png")
        seq = f"{tmp}/{comp}_seq"
        subprocess.run(["npx", "remotion", "render", os.environ.get("BUNDLE", "src/index.ts"), comp, seq, "--sequence",
                        "--image-format=png", f"--frames={mid - 20}-{mid}", f"--scale={SCALE}", "--gl=angle", "--concurrency=1",
                        "--log=error"], cwd=ROOT, check=True)
        last = sorted(os.listdir(seq))[-1]
        warm = np.array(Image.open(f"{seq}/{last}").convert("RGB")).astype(int)
        a = open(f"{tmp}/{comp}_cold.png", "rb").read()
        b = open(f"{seq}/{last}", "rb").read()
        say(int(np.abs(cold - warm).max()) == 0, f"determinism {comp}: cold still of frame {mid} vs the same frame rendered "
            f"after {mid - 20}..{mid - 1} in one worker: pixels identical, files byte-identical={a == b}")


if __name__ == "__main__":
    for step in sys.argv[1:] or ["probe", "loops", "levels", "key", "numbers", "determinism"]:
        globals()[step]()
    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)
