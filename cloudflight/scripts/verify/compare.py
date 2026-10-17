# python3 compare.py a.png b.png label  -> pixel-exact and byte-exact comparison
import hashlib, sys
from PIL import Image
import numpy as np
a, b, label = sys.argv[1], sys.argv[2], sys.argv[3]
A = np.asarray(Image.open(a).convert("RGB")).astype(int)
B = np.asarray(Image.open(b).convert("RGB")).astype(int)
same_px = A.shape == B.shape and np.array_equal(A, B)
md = lambda p: hashlib.md5(open(p, "rb").read()).hexdigest()
same_bytes = md(a) == md(b)
diff = 0 if A.shape != B.shape else int(np.abs(A - B).max())
print(f"{label}: pixels {'IDENTICAL' if same_px else 'DIFFER'} (max diff {diff}), file bytes {'IDENTICAL' if same_bytes else 'differ'}")
