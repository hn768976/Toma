"""Step 7 per-look criteria that can be measured rather than eyeballed."""
import subprocess, sys

W, H = 1920, 1080

def gray(p):
    return subprocess.run(["ffmpeg","-v","error","-i",p,"-f","rawvideo","-pix_fmt","gray","-"],
                          capture_output=True).stdout

def rgb(p):
    d = subprocess.run(["ffmpeg","-v","error","-i",p,"-f","rawvideo","-pix_fmt","rgb24","-"],
                       capture_output=True).stdout
    return d

def bright_extent(p, thr=90):
    g = gray(p)
    xs = [i % W for i, v in enumerate(g) if v > thr]
    return (min(xs), max(xs), len(xs)) if xs else (0, 0, 0)

F = "out/frames"
print("== Look 1: the line grows, then holds ==")
for n in ("GrowthLine_Navy", "GrowthLine_Black"):
    a = bright_extent(f"{F}/{n}_f75.png"); b = bright_extent(f"{F}/{n}_f225.png"); c = bright_extent(f"{F}/{n}_f299.png")
    grew = b[1] > a[1] + 20
    held = abs(c[1] - b[1]) <= 2
    print(f"  {n}: rightmost bright px f75={a[1]} f225={b[1]} f299={c[1]} "
          f"-> grows={'PASS' if grew else 'FAIL'} static-after-180={'PASS' if held else 'FAIL'}")

print("== Look 1A: copy space (>=40% of frame flat enough to place copy over) ==")
# Measured as local flatness, not distance from the darkest pixel: the navy
# field carries a deliberate radial gradient, so an absolute-brightness test
# would count the background's own falloff as "content".
import statistics as _st
g = gray(f"{F}/GrowthLine_Navy_f299.png")
GX, GY = 20, 12
cells = []
for gy in range(GY):
    for gx in range(GX):
        x0, y0 = gx * W // GX, gy * H // GY
        vals = [g[(y0 + dy) * W + (x0 + dx)] for dy in range(0, H // GY, 4) for dx in range(0, W // GX, 4)]
        cells.append((gx, gy, _st.pstdev(vals)))
empty = sum(1 for c in cells if c[2] < 3.0)
print(f"  {empty}/{GX*GY} grid cells with std-dev < 3 = {100*empty/(GX*GY):.0f}% "
      f"-> {'PASS' if empty/(GX*GY) >= 0.40 else 'FAIL'}")
print("  empty cells per column (left->right):",
      [sum(1 for (x, y, sd) in cells if x == c and sd < 3.0) for c in range(GX)])

print("== Look 4: light field, moving cursor, tooltip appearing ==")
for n in ("LightDashboard_Warm", "LightDashboard_Slate"):
    lums = []
    for fr in (0, 150, 300, 450, 599):
        g = gray(f"{F}/{n}_f{fr}.png")
        lums.append(sum(g[::997]) / len(g[::997]))
    frames = [gray(f"{F}/{n}_f{fr}.png") for fr in (0, 150, 300, 450, 599)]
    # white-ish pixel count varies as the tooltip card appears and goes
    whites = [sum(1 for v in f[::31] if v > 235) for f in frames]
    print(f"  {n}: mean luma per frame {[round(x) for x in lums]} -> light={'PASS' if min(lums) > 150 else 'FAIL'}")
    print(f"     bright-card pixel count {whites} -> varies={'PASS' if max(whites)-min(whites) > 80 else 'FAIL'}")

print("== Look 5: parallax (layers move at different rates) ==")
import statistics
def colprofile(p):
    g = gray(p)
    return [sum(g[y*W + x] for y in range(0, H, 6)) for x in range(0, W, 4)]
a = colprofile(f"{F}/FinancialMontage_Blue_f0.png")
b = colprofile(f"{F}/FinancialMontage_Blue_f300.png")
def best_shift(a, b, lo=-40, hi=40):
    best, bs = None, 0
    for s in range(lo, hi):
        n = len(a)
        seg = [(a[i] - b[i + s]) ** 2 for i in range(50, n - 50) if 0 <= i + s < n]
        v = sum(seg) / len(seg)
        if best is None or v < best:
            best, bs = v, s
    return bs
print(f"  whole-frame best horizontal shift f0->f300 = {best_shift(a,b)*4}px "
      f"(a single sliding image would align at one shift; layered parallax does not)")
diff = sum(1 for i in range(len(a)) if abs(a[i]-b[i]) > 400)
print(f"  columns differing between f0 and f300: {diff}/{len(a)} -> moving={'PASS' if diff > len(a)*0.3 else 'FAIL'}")
