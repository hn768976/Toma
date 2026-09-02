#!/usr/bin/env python3
"""Trace a black-on-transparent glyph PNG into a normalised SVG path module.

    pip install opencv-python-headless pillow
    python3 scripts/trace-glyph.py scripts/bitcoin-reference.png \
        src/hud-centre/bitcoin-glyph.ts

Emits a TypeScript module exporting the glyph's aspect ratio and a
`bitcoinPath(height)` builder. Coordinates are normalised so the glyph's full
height is exactly 1. Contours come out as separate closed subpaths, so the
result must be filled and clipped with the "evenodd" rule.
"""
import sys

import cv2
import numpy as np
from PIL import Image

# Simplification tolerance, in pixels of the 2x-upsampled trace. 1.0 keeps the
# error well under half a pixel at any sane render size.
EPSILON = 1.0


def fmt(v: float) -> str:
    s = f"{v:.4f}".rstrip("0").rstrip(".")
    return s if s not in ("", "-0") else "0"


def main(src_png: str, out_ts: str) -> None:
    im = Image.open(src_png).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    flat = np.array(Image.alpha_composite(bg, im).convert("L"))

    # Upsample before thresholding so the outline inherits sub-pixel detail
    # from the antialiased edges instead of snapping to the source raster.
    big = cv2.resize(flat, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    _, mask = cv2.threshold(big, 128, 255, cv2.THRESH_BINARY_INV)

    contours, _ = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    simplified = [cv2.approxPolyDP(c, EPSILON, True) for c in contours]
    simplified.sort(key=lambda c: -cv2.contourArea(c))

    xs = np.concatenate([c[:, 0, 0] for c in simplified])
    ys = np.concatenate([c[:, 0, 1] for c in simplified])
    x0, y0 = xs.min(), ys.min()
    height = ys.max() - y0 + 1
    aspect = (xs.max() - x0 + 1) / height

    subpaths = []
    for c in simplified:
        pts = [((p[0][0] - x0) / height, (p[0][1] - y0) / height) for p in c]
        subpaths.append("M" + " ".join(f"{fmt(x)},{fmt(y)}" for x, y in pts) + "Z")
    path_d = "".join(subpaths)

    # Slice at fixed width rather than wrapping on whitespace: textwrap DROPS
    # the space it breaks on, which would silently glue two coordinates
    # together ("0.2681" + "0.2808" -> "0.26810.2808") and corrupt the path.
    chunks = [path_d[i : i + 92] for i in range(0, len(path_d), 92)]
    literal = "\n".join(f'  "{c}" +' for c in chunks).rstrip(" +")
    total_points = sum(len(c) for c in simplified)
    print(
        f"{len(simplified)} contours, {total_points} points, "
        f"aspect {aspect:.4f} -> {out_ts}"
    )
    with open(out_ts, "w") as fh:
        fh.write(TEMPLATE.format(aspect=fmt(aspect), literal=literal))


TEMPLATE = '''// The Bitcoin mark, traced from the reference artwork.
//
// This is a real letterform, not a construction of rounded rectangles: the top
// bar carries a flag that overhangs the stem to the left, the bottom bar has a
// slanted tail, the two bowls are different widths, and the two vertical
// strokes sit at their own positions rather than at tidy fractions. Any
// parametric approximation reads as "a B with lines through it" rather than as
// the mark itself, so the outline is traced instead.
//
// Coordinates are normalised so the glyph's full height — INCLUDING the
// vertical strokes above and below the letterform — is exactly 1, and x runs
// 0..{aspect}. Three subpaths: the outer silhouette and the two counters.
//
// FILL RULE: the counters are separate closed subpaths, so every use of this
// path must pass "evenodd". Under the default nonzero rule the counters fill
// in and the mark becomes a solid blob.
//
// GENERATED — do not hand-edit. Regenerate with:
//   python3 scripts/trace-glyph.py <reference.png> src/hud-centre/bitcoin-glyph.ts

/** Glyph width as a multiple of its height. */
export const BITCOIN_ASPECT = {aspect};

const BITCOIN_PATH_D =
{literal};

/**
 * A Path2D of the mark, scaled so its total height is `height` px with its
 * top-left corner at the origin. Fill and clip with "evenodd".
 */
export const bitcoinPath = (height: number): Path2D => {{
  const scaled = new Path2D();
  scaled.addPath(new Path2D(BITCOIN_PATH_D), {{
    a: height,
    b: 0,
    c: 0,
    d: height,
    e: 0,
    f: 0,
  }});
  return scaled;
}};
'''


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
