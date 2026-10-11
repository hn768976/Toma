# usage: python3 tools/compare.py a.png b.png  -> prints identical / max abs diff / pixels differing
import sys
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert("RGB"); b = Image.open(sys.argv[2]).convert("RGB")
if a.size != b.size: print("SIZE MISMATCH", a.size, b.size); sys.exit(1)
d = ImageChops.difference(a, b)
ext = d.getextrema(); mx = max(e[1] for e in ext)
n = sum(1 for p in d.get_flattened_data() if p != (0, 0, 0)) if hasattr(d, "get_flattened_data") else sum(1 for p in d.getdata() if p != (0, 0, 0))
print(("IDENTICAL" if mx == 0 else "DIFFERENT"), "maxdiff=%d" % mx, "pixels_differing=%d" % n)
sys.exit(0 if mx == 0 else 2)
