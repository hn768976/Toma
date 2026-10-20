# Pixel/byte comparisons for scripts/verify.sh.
import sys, glob, hashlib
from PIL import Image, ImageChops
name, d = sys.argv[1], sys.argv[2]
seq = sorted(glob.glob(f"{d}/seq/*.png"))
first, last = seq[0], seq[-1]
a, b = Image.open(first).convert("RGB"), Image.open(last).convert("RGB")
diff = ImageChops.difference(a, b).getbbox()
mid = [p for p in seq if p.endswith("300.png")][0]
sha = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
same_bytes = sha(mid) == sha(f"{d}/cold-300.png")
same_px = ImageChops.difference(Image.open(mid).convert("RGB"), Image.open(f"{d}/cold-300.png").convert("RGB")).getbbox() is None
print(f"{name}: frames={len(seq)} size={a.size} loop 0==600: {'PASS' if diff is None else 'FAIL ' + str(diff)} | cold 300 bytes: {'PASS' if same_bytes else 'FAIL'} pixels: {'PASS' if same_px else 'FAIL'}")
