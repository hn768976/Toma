#!/usr/bin/env python3
"""
Batch raster -> SVG tracer.

Reads raster images from ./input, writes one SVG per input to ./output using the
same basename. Images without an alpha channel get their background knocked out
with ImageMagick first; images that already carry alpha are traced as-is.

Usage:
    ./trace_images.py                # trace everything not already done
    ./trace_images.py --force        # retrace even if the SVG exists
    ./trace_images.py --limit 3      # only the first N inputs (sorted by name)
"""

# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------
INPUT_DIR = "./input"
OUTPUT_DIR = "./output"
EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")

# vtracer
COLOR_MODE = "color"      # "color" or "bw"
FILTER_SPECKLE = 4        # discard patches smaller than N px
PATH_PRECISION = 3        # decimal places in path data

# background knockout (only applied to images with no alpha channel)
KNOCKOUT_FUZZ = "12%"
KNOCKOUT_COLOR = "white"

# a <rect> counts as a full-canvas background if it covers at least
# (1 - BG_RECT_TOLERANCE) of the canvas in both axes, anchored at the origin
BG_RECT_TOLERANCE = 0.02
# ---------------------------------------------------------------------------

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)

VTRACER_INSTALL = "cargo install vtracer"
MAGICK_INSTALL = (
    "macOS:          brew install imagemagick\n"
    "  Fedora/RHEL:    sudo dnf install ImageMagick\n"
    "  Arch:           sudo pacman -S imagemagick\n"
    "  Debian/Ubuntu:  apt ships ImageMagick 6 (`convert`, no `magick`) — build 7 from source:\n"
    "                  git clone --depth 1 https://github.com/ImageMagick/ImageMagick.git \\\n"
    "                    && cd ImageMagick && ./configure --prefix=/usr/local && make -j$(nproc) \\\n"
    "                    && sudo make install && sudo ldconfig"
)


# ---------------------------------------------------------------------------
# Dependency checking
# ---------------------------------------------------------------------------
def check_dependencies():
    """Abort with install instructions unless vtracer and ImageMagick 7 exist."""
    missing = []

    if shutil.which("vtracer") is None:
        missing.append(("vtracer", VTRACER_INSTALL))

    magick = shutil.which("magick")
    if magick is None:
        detail = MAGICK_INSTALL
        if shutil.which("convert"):
            detail = (
                "found `convert` (ImageMagick 6) but this script needs the v7 `magick` binary.\n  "
                + MAGICK_INSTALL
            )
        missing.append(("magick (ImageMagick 7)", detail))
    else:
        try:
            banner = subprocess.run(
                [magick, "-version"], capture_output=True, text=True, timeout=30
            ).stdout
        except (OSError, subprocess.SubprocessError) as exc:
            missing.append(("magick (ImageMagick 7)", f"`magick -version` failed: {exc}"))
        else:
            if not re.search(r"ImageMagick\s+7\.", banner):
                version = banner.splitlines()[0] if banner else "unknown"
                missing.append(
                    ("magick (ImageMagick 7)", f"found {version.strip()}, need 7.x\n  " + MAGICK_INSTALL)
                )

    if missing:
        print("error: missing required tool(s) on PATH:\n", file=sys.stderr)
        for name, how in missing:
            print(f"  {name}\n  {how}\n", file=sys.stderr)
        sys.exit(1)


# ---------------------------------------------------------------------------
# Image inspection
# ---------------------------------------------------------------------------
def has_alpha(path):
    """True if the image carries an alpha channel.

    Uses %[channels] ("srgba", "graya", "rgb", ...) and falls back to %A. On a
    read failure we return False so the caller still attempts the knockout --
    a needless knockout is recoverable, a skipped one leaves a solid background.
    """
    try:
        result = subprocess.run(
            ["magick", "identify", "-format", "%[channels]|%A", path],
            capture_output=True, text=True, timeout=120,
        )
    except (OSError, subprocess.SubprocessError):
        return False
    if result.returncode != 0:
        return False

    channels, _, alpha_flag = result.stdout.strip().partition("|")
    # IM7 reports %[channels] as "srgba 4.0" / "srgb 3.0" -- the colourspace
    # token carries the alpha, the trailing number is the channel count.
    token = channels.strip().lower().split()[0] if channels.strip() else ""
    # "srgba"/"graya"/"cmyka" end in 'a'; "gray"/"srgb" do not
    if token.endswith("a"):
        return True
    return alpha_flag.strip().lower() in ("true", "on", "blend")


def knockout_background(src, dst):
    """Make KNOCKOUT_COLOR transparent, writing a PNG to dst."""
    subprocess.run(
        ["magick", src, "-fuzz", KNOCKOUT_FUZZ, "-transparent", KNOCKOUT_COLOR, dst],
        capture_output=True, text=True, check=True, timeout=600,
    )


def run_vtracer(src, dst):
    subprocess.run(
        [
            "vtracer",
            "--input", src,
            "--output", dst,
            "--colormode", COLOR_MODE,
            "--filter_speckle", str(FILTER_SPECKLE),
            "--path_precision", str(PATH_PRECISION),
        ],
        capture_output=True, text=True, check=True, timeout=1800,
    )


# ---------------------------------------------------------------------------
# SVG post-processing
# ---------------------------------------------------------------------------
def _number(value, default=None, reference=None):
    """Parse an SVG length. Percentages resolve against `reference`."""
    if value is None:
        return default
    text = value.strip()
    if not text:
        return default
    if text.endswith("%"):
        try:
            pct = float(text[:-1])
        except ValueError:
            return default
        return default if reference is None else pct / 100.0 * reference
    match = re.match(r"^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)", text)
    return float(match.group(1)) if match else default


def _parse_viewbox(value):
    if not value:
        return None
    parts = [p for p in re.split(r"[\s,]+", value.strip()) if p]
    if len(parts) != 4:
        return None
    try:
        return [float(p) for p in parts]
    except ValueError:
        return None


def _is_background_rect(rect, canvas_w, canvas_h, min_x, min_y):
    """True if this <rect> spans (near enough) the whole canvas."""
    if canvas_w <= 0 or canvas_h <= 0:
        return False

    width = _number(rect.get("width"), reference=canvas_w)
    height = _number(rect.get("height"), reference=canvas_h)
    if width is None or height is None:
        return False

    x = _number(rect.get("x"), default=0.0, reference=canvas_w)
    y = _number(rect.get("y"), default=0.0, reference=canvas_h)
    if x is None or y is None:
        return False

    tol_x = canvas_w * BG_RECT_TOLERANCE
    tol_y = canvas_h * BG_RECT_TOLERANCE
    origin_ok = abs(x - min_x) <= tol_x and abs(y - min_y) <= tol_y
    covers = width >= canvas_w - tol_x and height >= canvas_h - tol_y
    return origin_ok and covers


def postprocess_svg(path):
    """Strip root width/height (synthesising a viewBox if needed) and drop any
    full-canvas background <rect>. Returns (viewbox, path_count, rects_removed)."""
    tree = ET.parse(path)
    root = tree.getroot()

    viewbox = _parse_viewbox(root.get("viewBox"))
    width = _number(root.get("width"))
    height = _number(root.get("height"))

    # vtracer emits width/height and no viewBox, so removing the dimensions
    # outright would leave an SVG that cannot scale. Derive one first.
    if viewbox is None and width is not None and height is not None:
        viewbox = [0.0, 0.0, width, height]
        root.set("viewBox", " ".join(_fmt(v) for v in viewbox))

    if viewbox is None:
        print(f"  warning: {os.path.basename(path)} has no viewBox and no usable "
              f"width/height; leaving dimensions intact", file=sys.stderr)
    else:
        root.attrib.pop("width", None)
        root.attrib.pop("height", None)

    removed = 0
    if viewbox is not None:
        min_x, min_y, canvas_w, canvas_h = viewbox
        parents = {child: parent for parent in root.iter() for child in parent}
        for rect in list(root.iter(f"{{{SVG_NS}}}rect")):
            if _is_background_rect(rect, canvas_w, canvas_h, min_x, min_y):
                parent = parents.get(rect)
                if parent is not None:
                    parent.remove(rect)
                    removed += 1

    path_count = sum(1 for _ in root.iter(f"{{{SVG_NS}}}path"))
    tree.write(path, encoding="utf-8", xml_declaration=True)
    return viewbox, path_count, removed


def _fmt(value):
    return str(int(value)) if float(value).is_integer() else repr(value)


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------
def collect_inputs(input_dir):
    if not os.path.isdir(input_dir):
        print(f"error: input directory not found: {input_dir}", file=sys.stderr)
        sys.exit(1)
    files = [
        entry for entry in os.listdir(input_dir)
        if os.path.isfile(os.path.join(input_dir, entry))
        and entry.lower().endswith(EXTENSIONS)
    ]
    return sorted(files, key=str.lower)


def process(name, input_dir, output_dir):
    """Trace one image. Returns (viewbox, path_count, bytes, knocked_out)."""
    src = os.path.join(input_dir, name)
    dst = os.path.join(output_dir, os.path.splitext(name)[0] + ".svg")

    workdir = tempfile.mkdtemp(prefix="trace-")
    try:
        traced_from = src
        knocked_out = False
        if not has_alpha(src):
            traced_from = os.path.join(workdir, "knockout.png")
            knockout_background(src, traced_from)
            knocked_out = True

        # Trace to a temp file and move into place, so a crash mid-run never
        # leaves a partial SVG that the next run would treat as "already done".
        staged = os.path.join(workdir, "traced.svg")
        run_vtracer(traced_from, staged)
        viewbox, path_count, _ = postprocess_svg(staged)

        os.makedirs(output_dir, exist_ok=True)
        shutil.move(staged, dst)
        return viewbox, path_count, os.path.getsize(dst), knocked_out
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def human(size):
    value = float(size)
    for unit in ("B", "KiB", "MiB", "GiB"):
        if value < 1024 or unit == "GiB":
            return f"{value:.0f} {unit}" if unit == "B" else f"{value:.1f} {unit}"
        value /= 1024


def main():
    parser = argparse.ArgumentParser(description="Batch trace raster images to SVG.")
    parser.add_argument("--force", action="store_true",
                        help="retrace images whose output SVG already exists")
    parser.add_argument("--limit", type=int, metavar="N",
                        help="only process the first N inputs (sorted by name)")
    parser.add_argument("--input-dir", default=INPUT_DIR)
    parser.add_argument("--output-dir", default=OUTPUT_DIR)
    args = parser.parse_args()

    check_dependencies()

    names = collect_inputs(args.input_dir)
    if args.limit is not None:
        names = names[:args.limit]
    if not names:
        print(f"no images matching {', '.join(EXTENSIONS)} in {args.input_dir}")
        return 0

    os.makedirs(args.output_dir, exist_ok=True)

    processed = skipped = failed = 0
    written_bytes = 0

    for name in names:
        dst = os.path.join(args.output_dir, os.path.splitext(name)[0] + ".svg")
        if os.path.exists(dst) and os.path.getsize(dst) > 0 and not args.force:
            print(f"skip    {name} -> {os.path.basename(dst)} (exists)")
            skipped += 1
            continue
        try:
            viewbox, path_count, size, knocked_out = process(name, args.input_dir, args.output_dir)
        except subprocess.CalledProcessError as exc:
            tool = os.path.basename(exc.cmd[0])
            detail = (exc.stderr or exc.stdout or "").strip().splitlines()
            print(f"FAIL    {name}: {tool} exited {exc.returncode}"
                  f"{': ' + detail[-1] if detail else ''}", file=sys.stderr)
            failed += 1
        except subprocess.TimeoutExpired as exc:
            print(f"FAIL    {name}: {os.path.basename(exc.cmd[0])} timed out", file=sys.stderr)
            failed += 1
        except (OSError, ET.ParseError) as exc:
            print(f"FAIL    {name}: {exc}", file=sys.stderr)
            failed += 1
        else:
            processed += 1
            written_bytes += size
            box = " ".join(_fmt(v) for v in viewbox) if viewbox else "none"
            print(f"ok      {name} -> {os.path.basename(dst)}  "
                  f"viewBox=[{box}]  paths={path_count}  {human(size)}"
                  f"{'  (bg knocked out)' if knocked_out else '  (had alpha)'}")

    total_output = 0
    for name in names:
        dst = os.path.join(args.output_dir, os.path.splitext(name)[0] + ".svg")
        if os.path.exists(dst):
            total_output += os.path.getsize(dst)

    print("\n--- summary ---")
    print(f"processed:          {processed}")
    print(f"skipped:            {skipped}")
    print(f"failed:             {failed}")
    print(f"written this run:   {human(written_bytes)}")
    print(f"total output size:  {human(total_output)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
