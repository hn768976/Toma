"""Numbered contact sheets.
  python3 scripts/contact-sheet.py grid OUT.png IMG1 IMG2 ...   (numbered grid, 4 per row)
  python3 scripts/contact-sheet.py row OUT.png IMG1 ... IMG5   (one row, labelled with frame names)
"""
import sys
from PIL import Image, ImageDraw, ImageFont

mode, out, files = sys.argv[1], sys.argv[2], sys.argv[3:]
ims = [Image.open(f).convert('RGB') for f in files]
w, h = 640, 360
try:
    font = ImageFont.truetype('public/fonts/SourceSans3-Bold.ttf', 34)
except OSError:
    font = ImageFont.load_default()
cols = 4 if mode == 'grid' else len(ims)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * h), 'white')
d = ImageDraw.Draw(sheet)
for i, im in enumerate(ims):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im.resize((w, h), Image.LANCZOS), (x, y))
    tag = str(i + 1) if mode == 'grid' else files[i].split('/')[-1].rsplit('.', 1)[0][-8:]
    d.rectangle([x, y, x + 20 + 22 * len(tag), y + 44], fill='black')
    d.text((x + 10, y + 3), tag, fill='white', font=font)
sheet.save(out)
