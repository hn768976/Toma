#!/usr/bin/env python3
"""Verify the 720p previews: ffprobe specs, loop seams, background levels,
green screen, keying and cold-start determinism. Writes a JSON report."""
import json, os, subprocess, sys, random
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREV = os.path.join(ROOT, "out/previews")
WORK = os.path.join(ROOT, "out/verify")
os.makedirs(WORK, exist_ok=True)
SCALE = "0.3333333333333333"

CLIPS = {
    "NeuronNetwork_Silver": dict(id="NeuronNetwork-Silver", frames=600, loop=True, bg=(0, 0, 0)),
    "NeuronAnatomy_Labelled": dict(id="NeuronAnatomy-Labelled", frames=900, bg=(0, 0, 0)),
    "NeuronAnatomy_Clean": dict(id="NeuronAnatomy-Clean", frames=900, bg=(0, 0, 0)),
    "FlightTrails_FlatNavy": dict(id="FlightTrails-FlatNavy", frames=600, loop=True, bg=(0x0A, 0x0A, 0x4A)),
    "DataServer_City": dict(id="DataServer-City", frames=600, loop=True),
    "DataServer_Dark": dict(id="DataServer-Dark", frames=600, loop=True),
    "InkCloth_White": dict(id="InkCloth-White", frames=600, loop=True, bg=(255, 255, 255)),
    "ProximityApp_City": dict(id="ProximityApp-City", frames=570),
    "ProximityApp_GreenScreen": dict(id="ProximityApp-GreenScreen", frames=570, green=True),
    "TangledThreads_White": dict(id="TangledThreads-White", frames=510, bg=(0, 0, 0)),
    "TangledThreads_Ink": dict(id="TangledThreads-Ink", frames=510, bg=(255, 255, 255)),
}

def run(cmd):
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)

def probe(path):
    r = run(["ffprobe", "-v", "error", "-show_entries",
             "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames:format=duration",
             "-of", "json", path])
    return json.loads(r.stdout)

def frame_at(path, n):
    """Decode frame n of an mp4 to RGB (bt709, tv range, as tagged)."""
    out = os.path.join(WORK, f"_dec.png")
    run(["ffmpeg", "-v", "error", "-y", "-i", path, "-vf", f"select=eq(n\\,{n})", "-vsync", "0", "-frames:v", "1", out])
    return np.asarray(Image.open(out).convert("RGB")).astype(int)

def still(cid, frame, out, props=None):
    cmd = ["npx", "remotion", "still", cid, out, f"--frame={frame}", f"--scale={SCALE}", "--log=error"]
    if props:
        cmd.append(f"--props={json.dumps(props)}")
    r = run(cmd)
    if r.returncode:
        print(r.stderr[-2000:])
    return np.asarray(Image.open(out).convert("RGB")).astype(int)

def empty_points(frames, bg, n=50, tol=2, rad=7, seed=1):
    """Points whose whole (2*rad+1)^2 neighbourhood is within tol of bg in
    every sampled frame: the 'empty' background."""
    ok = None
    for f in frames:
        d = np.abs(f - np.array(bg)).max(axis=2) <= tol
        # erode
        from numpy.lib.stride_tricks import sliding_window_view
        pad = np.pad(d, rad, constant_values=False)
        win = sliding_window_view(pad, (2 * rad + 1, 2 * rad + 1)).all(axis=(2, 3))
        ok = win if ok is None else ok & win
    ys, xs = np.nonzero(ok)
    if len(ys) == 0:
        return []
    rnd = random.Random(seed)
    idx = rnd.sample(range(len(ys)), min(n, len(ys)))
    return [(int(ys[i]), int(xs[i])) for i in idx]

def main(which):
    report = {}
    for name, c in CLIPS.items():
        if which and name not in which:
            continue
        mp4 = os.path.join(PREV, name + ".mp4")
        R = report[name] = {}
        if not os.path.exists(mp4):
            R["error"] = "missing"
            continue
        p = probe(mp4)
        v = [s for s in p["streams"] if s["codec_type"] == "video"][0]
        audio = [s for s in p["streams"] if s["codec_type"] == "audio"]
        R["probe"] = dict(codec=v["codec_name"], size=f'{v["width"]}x{v["height"]}', fps=v["r_frame_rate"],
                          pix_fmt=v["pix_fmt"], frames=int(v.get("nb_frames", 0)), duration=float(p["format"]["duration"]),
                          audio_streams=len(audio))
        R["probe_ok"] = (v["codec_name"] == "h264" and v["width"] == 1280 and v["height"] == 720 and
                         v["r_frame_rate"] == "30/1" and v["pix_fmt"] == "yuv420p" and not audio and
                         int(v.get("nb_frames", 0)) == c["frames"])
        # Background levels (decoded mp4) at 5 points in time.
        if "bg" in c:
            ts = [int(c["frames"] * k / 6) for k in range(1, 6)]
            fr = [frame_at(mp4, t) for t in ts]
            pts = empty_points(fr, c["bg"])
            vals = [tuple(int(x) for x in f[y, x]) for f in fr for (y, x) in pts]
            dev = max((max(abs(a - b) for a, b in zip(val, c["bg"])) for val in vals), default=None)
            R["background"] = dict(expected=c["bg"], points=len(pts), frames=ts, samples=len(vals), max_dev=dev,
                                   ok=dev is not None and dev <= 1 and len(pts) >= 50)
        # Loop seam: PNG stills of frame 0 and frame 600 (loopCheck adds frame 600).
        if c.get("loop"):
            a = still(c["id"], 0, os.path.join(WORK, f"{name}_f0.png"), {"loopCheck": True})
            b = still(c["id"], 600, os.path.join(WORK, f"{name}_f600.png"), {"loopCheck": True})
            R["loop"] = dict(max_abs_diff=int(np.abs(a - b).max()), differing_pixels=int((np.abs(a - b).max(axis=2) > 0).sum()),
                             ok=bool((a == b).all()))
            # And across the encoded seam: last frame vs first frame of the mp4.
            f0 = frame_at(mp4, 0)
            f599 = frame_at(mp4, c["frames"] - 1)
            R["loop"]["mp4_first_vs_last_mean_abs"] = float(np.abs(f0 - f599).mean())
        # Determinism: cold still of the middle frame vs the same frame in a
        # warm multi-frame PNG sequence render.
        mid = c["frames"] // 2
        cold = os.path.join(WORK, f"{name}_cold_{mid}.png")
        still(c["id"], mid, cold)
        seqdir = os.path.join(WORK, f"{name}_seq")
        run(["rm", "-rf", seqdir])
        r = run(["npx", "remotion", "render", c["id"], seqdir, "--sequence", f"--frames={mid-6}-{mid}",
                 "--image-format=png", f"--scale={SCALE}", "--concurrency=2", "--log=error"])
        files = sorted(f for f in os.listdir(seqdir) if f.endswith(".png")) if os.path.isdir(seqdir) else []
        warm = os.path.join(seqdir, files[-1]) if files else None
        if warm:
            A = np.asarray(Image.open(cold).convert("RGB")).astype(int)
            B = np.asarray(Image.open(warm).convert("RGB")).astype(int)
            R["determinism"] = dict(frame=mid, pixels_identical=bool((A == B).all()),
                                    bytes_identical=open(cold, "rb").read() == open(warm, "rb").read(),
                                    max_abs_diff=int(np.abs(A - B).max()))
        else:
            R["determinism"] = dict(error=r.stderr[-500:])
        if c.get("green"):
            R["green"] = green_checks(mp4, c["frames"])
        print(name, json.dumps(R), flush=True)
    path = os.path.join(WORK, "report.json")
    old = json.load(open(path)) if os.path.exists(path) else {}
    old.update(report)
    json.dump(old, open(path, "w"), indent=2)

def green_checks(mp4, frames):
    ts = [int(frames * k / 7) for k in range(1, 7)]
    res = {"frames": ts, "samples": 0, "max_dev": 0}
    rnd = random.Random(7)
    masks = []
    for t in ts:
        f = frame_at(mp4, t)
        m = (f[..., 1] > 200) & (f[..., 0] < 60) & (f[..., 2] < 60)
        # interior: erode by 4 px
        from numpy.lib.stride_tricks import sliding_window_view
        pad = np.pad(m, 4, constant_values=False)
        inner = sliding_window_view(pad, (9, 9)).all(axis=(2, 3))
        ys, xs = np.nonzero(inner)
        pick = rnd.sample(range(len(ys)), min(30, len(ys)))
        for i in pick:
            px = f[ys[i], xs[i]]
            res["max_dev"] = max(res["max_dev"], int(max(abs(px[0]), abs(px[1] - 255), abs(px[2]))))
            res["samples"] += 1
        masks.append((t, m))
    res["ok_samples"] = res["max_dev"] <= 2 and res["samples"] == 180
    # Key over a test image (colour bars) and check what changed.
    t, m = masks[2]
    test = os.path.join(WORK, "_bars.png")
    keyed = os.path.join(WORK, "green_keyed.png")
    run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "smptehdbars=s=1280x720", "-frames:v", "1", test])
    run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", test, "-i", mp4, "-filter_complex",
         f"[1:v]select=eq(n\\,{t}),setpts=PTS-STARTPTS,format=yuva444p,chromakey=0x00FF00:0.12:0.05[k];"
         f"[0:v]format=yuva444p[b];[b][k]overlay=shortest=1:format=yuv444,format=rgb24", "-frames:v", "1", keyed])
    K = np.asarray(Image.open(keyed).convert("RGB")).astype(int)
    F = frame_at(mp4, t)
    Bars = np.asarray(Image.open(test).convert("RGB")).astype(int)
    changed = np.abs(K - F).max(axis=2) > 24  # pixel no longer shows the clip
    shows_bars = np.abs(K - Bars).max(axis=2) <= 12
    screen = m
    res["key"] = dict(frame=t, screen_pixels=int(screen.sum()),
                      screen_replaced_fraction=float((shows_bars & screen).sum() / max(1, screen.sum())),
                      keyed_outside_screen=int((changed & ~screen).sum()))
    # outside pixels within 3 px of the screen edge are anti-aliased edge blends
    from numpy.lib.stride_tricks import sliding_window_view
    pad = np.pad(screen, 3, constant_values=False)
    near = sliding_window_view(pad, (7, 7)).any(axis=(2, 3))
    res["key"]["keyed_outside_screen_excluding_3px_edge"] = int((changed & ~near).sum())
    return res

if __name__ == "__main__":
    main(set(sys.argv[1:]))
