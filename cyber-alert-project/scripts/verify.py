#!/usr/bin/env python3
"""Verify loop for the six compositions. Usage: scripts/verify.py <step> [comps...]
Steps: probe | loop | determinism | scale | banding | frames
Needs: ffmpeg/ffprobe, numpy, pillow, a bundle at out/bundle, previews in renders/."""
import hashlib, json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out" / "verify"
OUT.mkdir(parents=True, exist_ok=True)
BUNDLE = str(ROOT / "out" / "bundle")
COMPS = {
    "ChipAlert-Red": "ChipAlert_Red", "ChipAlert-Amber": "ChipAlert_Amber",
    "GlitchWord-Warning": "GlitchWord_Warning", "GlitchWord-AccessDenied": "GlitchWord_AccessDenied",
    "BreachHUD-Blue": "BreachHUD_Blue", "BreachHUD-Green": "BreachHUD_Green",
}

def run(cmd):
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if r.returncode:
        print(r.stdout[-2000:], r.stderr[-2000:])
        raise SystemExit(f"command failed: {' '.join(cmd)}")
    return r.stdout

def still(comp, frame, path, scale="0.5", props=None):
    cmd = ["npx", "remotion", "still", BUNDLE, comp, str(path), f"--frame={frame}", f"--scale={scale}", "--image-format=png"]
    if props:
        cmd.append(f"--props={json.dumps(props)}")
    run(cmd)

def img(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(np.int16)

def probe(comps):
    ok = True
    for c in comps:
        f = ROOT / "renders" / f"{COMPS[c]}.mp4"
        o = run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames",
                 "-show_entries", "format=duration", "-of", "json", str(f)])
        d = json.loads(o)
        st = d["streams"]
        v = [s for s in st if s["codec_type"] == "video"][0]
        audio = [s for s in st if s["codec_type"] == "audio"]
        dur = float(d["format"]["duration"])
        good = (v["codec_name"] == "h264" and v["width"] == 1920 and v["height"] == 1080 and v["r_frame_rate"] == "30/1"
                and v["pix_fmt"] == "yuv420p" and abs(dur - 20.0) < 0.001 and not audio and v.get("nb_frames") == "600")
        ok &= good
        print(f"{'PASS' if good else 'FAIL'} probe {c}: {v['codec_name']} {v['width']}x{v['height']} {v['r_frame_rate']} {v['pix_fmt']} "
              f"{dur:.3f}s frames={v.get('nb_frames')} audio_streams={len(audio)}")
    return ok

def loop(comps):
    ok = True
    for c in comps:
        a, b = OUT / f"{c}_loop0.png", OUT / f"{c}_loop600.png"
        still(c, 0, a, props={"loopCheck": True})
        still(c, 600, b, props={"loopCheck": True})
        d = np.abs(img(a) - img(b))
        same = int(d.max()) == 0
        ok &= same
        print(f"{'PASS' if same else 'FAIL'} loop {c}: frame0 vs frame600 max diff {int(d.max())}, differing px {int((d.max(axis=2) > 0).sum())}")
    return ok

def determinism(comps):
    ok = True
    for c in comps:
        cold = OUT / f"{c}_300_cold.png"
        still(c, 300, cold)
        seq = OUT / f"{c}_seq"
        seq.mkdir(exist_ok=True)
        run(["npx", "remotion", "render", BUNDLE, c, str(seq), "--sequence", "--image-format=png", "--scale=0.5",
             "--frames=290-310", "--concurrency=4"])
        cand = sorted(seq.glob("*300.png"))
        if not cand:
            raise SystemExit(f"no frame 300 in {seq}: {sorted(p.name for p in seq.iterdir())[:5]}")
        h1 = hashlib.sha256(cold.read_bytes()).hexdigest()
        h2 = hashlib.sha256(cand[0].read_bytes()).hexdigest()
        px = int(np.abs(img(cold) - img(cand[0])).max())
        same = h1 == h2
        ok &= same
        print(f"{'PASS' if same else 'FAIL'} determinism {c}: cold still vs multi-thread sequence frame 300: bytes {'identical' if same else 'differ'}, max px diff {px}")
    return ok

def scale(comps):
    for c in comps:
        lo, hi = OUT / f"{c}_300_1080.png", OUT / f"{c}_300_4k.png"
        still(c, 300, lo, scale="0.5")
        still(c, 300, hi, scale="1")
        a = img(lo).astype(np.float32)
        H = Image.open(hi).convert("RGB")
        assert H.size == (3840, 2160), H.size
        b = np.asarray(H.resize((1920, 1080), Image.Resampling.BOX)).astype(np.float32)
        diff = np.abs(a - b).mean(axis=2)
        # thin-line visibility: edge energy (gradient magnitude) should match
        ga = np.abs(np.diff(a.mean(axis=2), axis=1)).mean()
        gb = np.abs(np.diff(b.mean(axis=2), axis=1)).mean()
        print(f"scale {c}: mean abs diff {diff.mean():.2f}/255, 99th pct {np.percentile(diff, 99):.1f}, edge energy 1080p {ga:.2f} vs 4K-down {gb:.2f} (ratio {gb/ga:.2f})")
        Image.fromarray(np.concatenate([a, b], axis=1).astype(np.uint8)).save(OUT / f"{c}_scale_side_by_side.png")

def banding(comps, frame=300):
    """Reads luma along a line from the brightest glow into dark background,
    on a frame decoded from the encoded mp4. Chip: from the triangle apex
    straight up. Others: from the brightest point leftward."""
    for c in comps:
        mp4 = ROOT / "renders" / f"{COMPS[c]}.mp4"
        png = OUT / f"{c}_mp4_f{frame}.png"
        run(["ffmpeg", "-v", "error", "-y", "-i", str(mp4), "-vf", f"select=eq(n\\,{frame})", "-frames:v", "1", str(png)])
        a = img(png).astype(np.float32)
        lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
        if c.startswith("ChipAlert"):
            # apex: topmost bright pixel in the centre column band
            sub = lum[100:400, 860:1060]
            ys, xs = np.nonzero(sub > sub.max() * 0.9)
            i = np.argmin(ys)
            y, x = ys[i] + 100, xs[i] + 860
            row = lum[:y + 1, x][::-1]
            band = lum[:y + 1, x - 4:x + 5].mean(axis=1)[::-1]
            desc = f"from apex ({x},{y}) straight up"
        else:
            sub = lum[200:880, 300:1620]
            y, x = np.unravel_index(np.argmax(sub), sub.shape)
            y += 200; x += 300
            row = lum[y, :x + 1][::-1]
            band = lum[max(0, y - 4):y + 5, :x + 1][:, ::-1].mean(axis=0)
            desc = f"from ({x},{y}) leftward"
        sm = np.convolve(band, np.ones(9) / 9, mode="valid")
        steps = np.abs(np.diff(sm))
        # plateau test on the falloff: run-lengths of identical rounded values in the raw line
        r = np.round(row).astype(int)
        runs, cur = [], 1
        for k in range(1, len(r)):
            if r[k] == r[k - 1]:
                cur += 1
            else:
                runs.append(cur); cur = 1
        runs.append(cur)
        print(f"banding {c} (frame {frame} decoded from the mp4): {desc}, {len(row)} px")
        print("  raw luma every 8px:", " ".join(f"{int(v)}" for v in row[::8]))
        print(f"  9px-avg smoothed max step {steps.max():.2f}/px; raw line longest run of identical values {max(runs)} px, mean run {np.mean(runs):.2f} px")
        np.savetxt(OUT / f"{c}_banding_line.txt", np.stack([row, band], axis=1), fmt="%.2f")

def frames(comps):
    for c in comps:
        mp4 = ROOT / "renders" / f"{COMPS[c]}.mp4"
        tiles = []
        for n in [0, 150, 300, 450, 599]:
            p = OUT / f"{c}_f{n}.png"
            run(["ffmpeg", "-v", "error", "-y", "-i", str(mp4), "-vf", f"select=eq(n\\,{n})", "-frames:v", "1", str(p)])
            tiles.append(Image.open(p).convert("RGB").resize((768, 432), Image.Resampling.LANCZOS))
        sheet = Image.new("RGB", (768 * 3, 432 * 2))
        for i, t in enumerate(tiles):
            sheet.paste(t, ((i % 3) * 768, (i // 3) * 432))
        sheet.save(OUT / f"{c}_sheet.png")
        print(f"frames {c}: sheet -> out/verify/{c}_sheet.png (0,150,300 / 450,599)")

if __name__ == "__main__":
    step = sys.argv[1]
    comps = sys.argv[2:] or list(COMPS)
    r = {"probe": probe, "loop": loop, "determinism": determinism, "scale": scale, "banding": banding, "frames": frames}[step](comps)
    if r is False:
        sys.exit(1)
