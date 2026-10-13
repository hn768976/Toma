"""Compare two PNGs pixel for pixel. Prints IDENTICAL or the diff stats."""
import sys
from PIL import Image, ImageChops

a = Image.open(sys.argv[1]).convert("RGB")
b = Image.open(sys.argv[2]).convert("RGB")
if a.size != b.size:
    print(f"DIFFERENT size {a.size} vs {b.size}")
    sys.exit(1)
d = ImageChops.difference(a, b)
bbox = d.getbbox()
if bbox is None:
    print("IDENTICAL")
    sys.exit(0)
px = sum(1 for p in d.getdata() if p != (0, 0, 0))
print(f"DIFFERENT pixels={px} bbox={bbox} max={max(max(p) for p in d.getdata())}")
sys.exit(1)
