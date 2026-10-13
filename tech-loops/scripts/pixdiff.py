import sys
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert("RGB"); b = Image.open(sys.argv[2]).convert("RGB")
d = ImageChops.difference(a, b)
bbox = d.getbbox()
if bbox is None:
    print(f"{sys.argv[3]}: IDENTICAL pixel for pixel")
else:
    px = sum(1 for p in d.getdata() if p != (0, 0, 0))
    print(f"{sys.argv[3]}: DIFFER in {px} pixels, max channel diff {max(max(p) for p in d.getdata())}, bbox {bbox}")
