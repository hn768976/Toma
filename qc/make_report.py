#!/usr/bin/env python3
"""Render the per-file QC JSON results into a Markdown table.

usage: make_report.py label=video.json [label=video.json ...] -- label=zip.json ...
"""
import json
import sys

args = sys.argv[1:]
split = args.index("--") if "--" in args else len(args)
videos = [a.split("=", 1) for a in args[:split]]
zips = [a.split("=", 1) for a in args[split + 1:]]

ROWS = [
    ("codec_h264", "H.264 codec"),
    ("container_mp4", "MP4 container"),
    ("resolution_1080p", "1920×1080"),
    ("pixel_format", "yuv420p"),
    ("fps_30_exact", "Exactly 30 fps (CFR)"),
    ("frame_count_matches_reference", "Frame count = reference"),
    ("duration_matches_reference", "Duration = reference"),
    ("audio", "Audio matches reference (none)"),
    ("full_decode_no_errors", "Full decode, no errors"),
    ("no_black_frames", "No black frames"),
    ("no_flicker_spikes", "No flicker spikes"),
    ("no_frozen_frames", "No frozen frames"),
    ("no_corrupted_or_torn_frames", "No corrupted/torn frames"),
]

data = [(lbl, json.load(open(p))) for lbl, p in videos]
out = ["| Check | " + " | ".join(l for l, _ in data) + " |", "|---|" + "---|" * len(data)]
for key, name in ROWS:
    cells = []
    for _, d in data:
        c = d["checks"][key]
        cells.append(("✅ " if c["ok"] else "⚠️ ") + c["detail"].split(";")[0][:60])
    out.append(f"| {name} | " + " | ".join(cells) + " |")
out.append("| Mean RGB (ref) | " + " | ".join(f'{d["stats"]["mean_rgb"]} ({d["stats"]["reference_mean_rgb"]})' for _, d in data) + " |")
out.append("| Bitrate / size | " + " | ".join(f'{d["stats"]["bitrate_kbps"]} kb/s / {d["stats"]["size_mb"]} MB' for _, d in data) + " |")
print("\n".join(out))
print()
if zips:
    zd = [(lbl, json.load(open(p))) for lbl, p in zips]
    print("| ZIP check | " + " | ".join(l for l, _ in zd) + " |")
    print("|---|" + "---|" * len(zd))
    for key, name in [("crc_integrity", "CRC integrity"), ("required_files", "Required project files"),
                      ("no_build_artifacts", "No node_modules/build output"), ("compositions_4k_30fps", "Compositions 3840×2160 @ 30 fps")]:
        print(f"| {name} | " + " | ".join(("✅ " if d["checks"][key]["ok"] else "❌ ") + d["checks"][key]["detail"] for _, d in zd) + " |")
