#!/usr/bin/env python3
"""Integrity + completeness check for a Remotion project ZIP.

usage: qc_zip.py <project.zip> <extracted-project-dir>

- zip CRC test (zipfile.testzip)
- required project files present (source, config, lockfile, assets, docs)
- no node_modules / build output inside the archive
- compositions in the extracted, installed project are 3840x2160 @ 30 fps
  (runs `npx remotion compositions` in the extracted dir)
"""
import json
import re
import subprocess
import sys
import zipfile

REQUIRED = [
    "package.json",
    "package-lock.json",
    "remotion.config.ts",
    "tsconfig.json",
    "README.md",
    "src/index.ts",
    "src/Root.tsx",
    "src/engine/layers.ts",
    "src/engine/post.ts",
    "src/engine/random.ts",
]


def main():
    zpath, pdir = sys.argv[1], sys.argv[2]
    res = {"zip": zpath, "checks": {}, "pass": True}

    def check(name, ok, detail):
        res["checks"][name] = {"ok": bool(ok), "detail": detail}
        if not ok:
            res["pass"] = False

    with zipfile.ZipFile(zpath) as z:
        bad = z.testzip()
        check("crc_integrity", bad is None, "all members OK" if bad is None else f"corrupt member {bad}")
        names = z.namelist()
        root = names[0].split("/")[0]
        rel = [n[len(root) + 1:] for n in names if n.startswith(root + "/")]
        missing = [r for r in REQUIRED if r not in rel]
        check("required_files", not missing, f"missing: {missing}" if missing else f"{len(REQUIRED)} required files present")
        junk = [r for r in rel if r.startswith(("node_modules/", "out/", "build/"))]
        check("no_build_artifacts", not junk, f"{len(junk)} unwanted entries" if junk else "no node_modules/out/build")
        src = [r for r in rel if r.startswith("src/") and r.endswith((".ts", ".tsx"))]
        assets = [r for r in rel if r.startswith("public/") and not r.endswith("/")]
        res["files"] = {"total": len([r for r in rel if not r.endswith('/')]), "source_files": len(src), "public_assets": assets}

    out = subprocess.run(["npx", "remotion", "compositions"], cwd=pdir, capture_output=True, text=True).stdout
    comps = re.findall(r"^(\S+-V\d)\s+(\d+)\s+(\d+)x(\d+)\s+(\d+)", out, re.M)
    res["compositions"] = [
        {"id": c[0], "fps": int(c[1]), "width": int(c[2]), "height": int(c[3]), "frames": int(c[4])} for c in comps
    ]
    ok4k = len(comps) == 2 and all(c[1] == "30" and c[2] == "3840" and c[3] == "2160" for c in comps)
    check("compositions_4k_30fps", ok4k, "; ".join(f"{c[0]} {c[2]}x{c[3]} @{c[1]}fps {c[4]}f" for c in comps))
    print(json.dumps(res, indent=2))
    sys.exit(0 if res["pass"] else 1)


if __name__ == "__main__":
    main()
