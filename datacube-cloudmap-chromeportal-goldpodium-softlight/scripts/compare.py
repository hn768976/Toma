import sys, hashlib
from PIL import Image
import numpy as np
a, b = sys.argv[1], sys.argv[2]
ha = hashlib.sha256(open(a, 'rb').read()).hexdigest()
hb = hashlib.sha256(open(b, 'rb').read()).hexdigest()
A = np.asarray(Image.open(a).convert('RGB')).astype(int)
B = np.asarray(Image.open(b).convert('RGB')).astype(int)
diff = np.abs(A - B)
print(f"file-bytes-identical={ha == hb} pixels-identical={bool((diff == 0).all())} "
      f"max-diff={diff.max()} differing-pixels={(diff.sum(-1) > 0).sum()}")
