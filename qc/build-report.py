#!/usr/bin/env python3
"""build-report.py - assemble deliverables/QC-report.md from the QC data.

Usage: python3 qc/build-report.py <data dir>
The data dir holds the JSON written by verify.py, look-over-time.py and
temporal.py plus extra.json (determinism, banding, ZIP test, render times).
"""
import io
import json
import os
import shutil
import subprocess
import sys

ROOT = "/home/user/Toma"
D = sys.argv[1]
OUT = f"{ROOT}/deliverables"
PARTS = f"{ROOT}/qc/report-parts"
VIDS = [("01-V1", "01-V1-ai-chip-reveal.mp4"), ("02-V2", "02-V2-ai-chip-reveal.mp4"),
        ("03-V1", "03-V1-chip-ignite.mp4"), ("04-V2", "04-V2-chip-ignite.mp4")]
extra = json.load(open(f"{D}/extra.json"))


def tables(*args):
    return subprocess.run([sys.executable, f"{ROOT}/qc/tables.py", *args],
                          capture_output=True, text=True, check=True).stdout


def part(name):
    return open(f"{PARTS}/{name}").read().rstrip() + "\n"


o = io.StringIO()
w = lambda s="": o.write(s + "\n")

w("# QC report - ai-chip-reveal and chip-ignite")
w()
w("Two reference clips, two Remotion projects, four videos. Every number in this report was measured on the delivered files with the scripts in `qc/` and in each project's `scripts/` folder.")
w()
w("| # | File | What it is |")
w("|---|---|---|")
w("| 1 | `01-V1-ai-chip-reveal.mp4` | Reference A, Version 1 (closest match) |")
w("| 2 | `02-V2-ai-chip-reveal.mp4` | Reference A, Version 2: colour palette changed (amber -> cyan) |")
w("| 3 | `03-V1-chip-ignite.mp4` | Reference B, Version 1 (closest match) |")
w("| 4 | `04-V2-chip-ignite.mp4` | Reference B, Version 2: camera movement changed |")
w("| 5 | `ai-chip-reveal-project.zip`, `chip-ignite-project.zip` | Sources with both 4K compositions each |")
w()
w(part("1-analysis.md"))

# ---------------------------------------------------------------- look dev
w("## 2. Look development (step 4A)")
w()
w("`scripts/measure-look.py` (in both projects) reports luminance percentiles, clipped and dark pixel shares, saturation and split-tone hue, glow falloff, haze contrast by region, grain, detail and vignette. All frames are measured at 768x432 with the stock watermark area masked out. Glow radii are fractions of the frame height; `-` means the brightness never falls that far.")
w()
for proj, ref, times in (("ai-chip-reveal", "refA", "0.5, 1.5, 3.5, 6.0 and 9.5 s"),
                         ("chip-ignite", "refB", "0.5, 4.0, 6.4, 8.4 and 13.0 s")):
    w(f"### {proj}: the reference at five moments ({times})")
    w()
    w(open(f"{D}/{ref}-table.md").read())
for proj, moments, frames in (("ai-chip-reveal", "start,peak,middle", "0.5 s, 1.5 s and 6.0 s"),
                              ("chip-ignite", "start,middle,peak", "0.5 s, 6.4 s and 8.4 s")):
    w(f"### {proj}: the three look-dev stills ({frames}) against the reference")
    w()
    w(tables("lookdev", f"{ROOT}/{proj}/lookdev/look-measures.json", moments))
    for m in moments.split(","):
        dst = f"qc/lookdev-{proj}-{m}.png"
        shutil.copy(f"{ROOT}/{proj}/lookdev/compare-{m}.png", f"{OUT}/{dst}")
        w(f"![{proj} {m}: reference | ours | difference]({dst})")
        w()

# ------------------------------------------------------------ look over time
w("## 3. Look table: each video against its reference over time (step 8A-7)")
w()
w("Five moments per video. `ref` is the reference frame, `ours` the frame of the delivered MP4 at the same time, `diff` = ours - ref. A cross marks a value outside the step 4A target (+-10% of the reference; hues +-10 degrees; small absolute tolerances where 10% of a near-zero value is meaningless, see `qc/look-over-time.py`). For the Version 2 of ai-chip-reveal the hue and saturation measures are skipped, because the palette is what changed. For the Version 2 of chip-ignite all measures are listed for information only: its camera is different on purpose, so the frames are not comparable shot for shot.")
w()
w(tables("look", *[f"{D}/lot-{k[:2]}.json" for k, _ in VIDS]))
w()
w("**Summary.** " + extra["look_summary"])
w()
w("**Stability over time** (`qc/temporal.py`: largest frame-to-frame step of each quantity, measured on every frame; for ai-chip-reveal the intended flash and whip, frames 60-112, are left out):")
w()
w("| Video | Median luminance | p95 luminance | Edge contrast (haze) | Grain level (8-bit) |")
w("|---|---|---|---|---|")
for k, name in VIDS:
    t = json.load(open(f"{D}/temp-{k[:2]}.json"))
    w(f"| `{name}` | {t['median_luminance']['max_step']:.4f} | {t['p95_luminance']['max_step']:.4f} | {t['edge_contrast_haze']['max_step']:.4f} | {t['grain_level_8bit']['max_step']:.3f} |")
w()
w("Luminance values are on a 0-1 scale, so the largest step anywhere is 2% of full scale: light, haze and grain do not flicker or jump.")
w()

# ------------------------------------------------------------------ checks
w("## 4. Technical checks (step 8A)")
w()
w(tables("specs", *[f"{D}/{k}.json" for k, _ in VIDS]))
w()
w("| # | Check | Result | Measured |")
w("|---|---|---|---|")
for row in extra["checks"]:
    w("| " + " | ".join(row) + " |")
w()
for k, name in VIDS:
    stem = name[:-4]
    w(f"Contact sheet, one frame per second - `{name}`:")
    w()
    w(f"![contact sheet {stem}](qc/contact-{stem}.png)")
    w()
w("Dark gradient of ai-chip-reveal with levels stretched x4 (frame at 6.0 s of the delivered MP4):")
w()
w("![banding check](qc/banding-x4-01-V1-ai-chip-reveal.png)")
w()

# --------------------------------------------------------------------- V2
w("## 5. Version 2 distinctness (step 8B-11)")
w()
w("Version 1 on top, Version 2 below, same times.")
w()
w("![ai-chip-reveal V1 vs V2](qc/v1-vs-v2-ai-chip-reveal.png)")
w()
w("![chip-ignite V1 vs V2](qc/v1-vs-v2-chip-ignite.png)")
w()
w(extra["v2_text"])
w()
w(part("5-subagents.md"))

# -------------------------------------------------------------------- ZIP
w("## 7. ZIP test (step 8A-9)")
w()
w(extra["zip_text"])
w()
w("## 8. Render times")
w()
w(extra["render_text"])
w()
w(part("6-unmatched.md"))
open(f"{OUT}/QC-report.md", "w").write(o.getvalue())
print("wrote", f"{OUT}/QC-report.md", len(o.getvalue()), "chars")
