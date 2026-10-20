# Tiles out/contact/<name>-<frame>.png into one sheet per machine (review aid).
import sys, glob, os
from PIL import Image
src = sys.argv[1] if len(sys.argv) > 1 else "out/contact"
names = sorted({os.path.basename(p).rsplit("-", 1)[0] for p in glob.glob(f"{src}/*.png") if "-sheet" not in p})
for n in names:
    files = sorted(glob.glob(f"{src}/{n}-[0-9]*.png"))
    ims = [Image.open(f).convert("RGB") for f in files]
    w, h = ims[0].size
    cols = 4
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (w * cols, h * rows), "white")
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % cols) * w, (i // cols) * h))
    sheet.save(f"{src}/{n}-sheet.png")
    print(n, len(ims))
