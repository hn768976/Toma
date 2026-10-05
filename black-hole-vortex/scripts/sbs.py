# dev helper: side-by-side ref|render rows.  usage: sbs.py out.png ref1 img1 [ref2 img2 ...]
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
rows = len(files) // 2
W = Image.new("RGB", (1280, 360 * rows))
for i in range(rows):
    W.paste(Image.open(files[2 * i]).convert("RGB").resize((640, 360)), (0, 360 * i))
    W.paste(Image.open(files[2 * i + 1]).convert("RGB").resize((640, 360)), (640, 360 * i))
W.save(out)
