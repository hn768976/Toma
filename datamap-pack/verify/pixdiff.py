import sys
from PIL import Image, ImageChops
a, b, label = sys.argv[1], sys.argv[2], sys.argv[3]
A = Image.open(a).convert("RGB"); B = Image.open(b).convert("RGB")
if A.size != B.size:
    print(f"FAIL {label}: size {A.size} vs {B.size}"); sys.exit(1)
d = ImageChops.difference(A, B)
bbox = d.getbbox()
if bbox is None:
    print(f"PASS {label}: pixels identical")
else:
    px = sum(1 for p in d.getdata() if p != (0, 0, 0))
    print(f"FAIL {label}: {px} pixels differ, max {max(max(p) for p in d.getdata())}, bbox {bbox}")
