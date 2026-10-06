# Banding check on a frame decoded from the ENCODED mp4.
# For dark rows and a glow falloff we print:
#  - means of consecutive 64-px segments along the row (a smooth gradient changes
#    by small fractional amounts; banding shows as equal plateaus then whole-level jumps)
#  - local noise (std inside each segment after removing the segment's linear trend):
#    with dither+grain present it stays ≳0.5 levels, so 8-bit steps are broken up.
# Verdict: CHECK if a dark segment is noise-free (std < 0.25) AND steps by a whole
# level (1–6) to a neighbour — the signature of a band edge.
import sys
import numpy as np
from PIL import Image
im = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(float)
Y = im @ [0.2126, 0.7152, 0.0722]
h, w = Y.shape
bad = 0
def report(name, line):
    global bad
    seg = 64
    means, stds = [], []
    for s in range(0, len(line) - seg + 1, seg):
        v = line[s:s + seg]
        x = np.arange(seg)
        fit = np.polyval(np.polyfit(x, v, 1), x)
        means.append(v.mean())
        stds.append((v - fit).std())
    means = np.array(means); stds = np.array(stds)
    # a band = a noise-free dark plateau that meets its neighbour with a whole-level jump
    for i in range(len(means)):
        if means[i] < 60 and stds[i] < 0.25:
            nb = [abs(means[i] - means[j]) for j in (i - 1, i + 1) if 0 <= j < len(means)]
            if nb and max(nb) >= 1.0 and max(nb) < 6.0:
                bad += 1
    print(f"  {name}: segment means {' '.join(f'{m:.1f}' for m in means[:10])} …")
    print(f"  {'':{len(name)}}  local noise std min/median {stds.min():.2f}/{np.median(stds):.2f}; max step between segments {np.abs(np.diff(means)).max():.2f}")
for frac in (0.04, 0.5, 0.96):
    report(f"row {frac:.2f}", Y[int(h * frac)])
# glow falloff: vertical line through the brightest column
c = int(np.argmax(Y.sum(0)))
report(f"col {c} (glow)", Y[:, c])
print(f"  banding verdict: {'OK — no band edges (no noise-free plateau meeting a whole-level step)' if bad == 0 else 'CHECK'}")
