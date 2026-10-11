# side-by-side: python3 scripts/sbs.py ref.png ours.png out.png
import sys
from PIL import Image
a = Image.open(sys.argv[1]).convert("RGB").resize((960, 540), Image.LANCZOS)
b = Image.open(sys.argv[2]).convert("RGB").resize((960, 540), Image.LANCZOS)
im = Image.new("RGB", (960, 1090), (128, 128, 128))
im.paste(a, (0, 0)); im.paste(b, (0, 550))
im.save(sys.argv[3])
