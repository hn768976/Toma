import sys, glob, os
from PIL import Image, ImageDraw
# montage.py <dir> <out.png> <cols> [tile_w]
d, out, cols = sys.argv[1], sys.argv[2], int(sys.argv[3])
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 320
files = sorted(glob.glob(os.path.join(d, "*.png")))
ims = [Image.open(f).convert("RGB") for f in files]
th = int(tw * 9 / 16)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * (th + 14)), (40, 40, 40))
dr = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = (i % cols) * tw, (i // cols) * (th + 14)
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 14))
    dr.text((x + 3, y + 1), os.path.basename(f).split("_")[-1][:-4], fill=(255, 255, 0))
sheet.save(out)
