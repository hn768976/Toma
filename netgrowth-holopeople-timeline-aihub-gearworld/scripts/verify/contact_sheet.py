# Usage: contact_sheet.py video.mp4 out.png N   (N evenly spaced frames)
import sys, subprocess, json
from PIL import Image, ImageDraw
v, out, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
dur = float(json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", v]))["format"]["duration"])
tiles = []
for i in range(n):
    t = dur * (i + 0.5) / n
    png = subprocess.check_output(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", v, "-frames:v", "1", "-vf", "scale=640:360", "-f", "image2pipe", "-vcodec", "png", "-"])
    from io import BytesIO
    im = Image.open(BytesIO(png)).convert("RGB")
    ImageDraw.Draw(im).text((8, 8), f"{t:.1f}s", fill=(255, 0, 0))
    tiles.append(im)
cols = 4
rows = (n + cols - 1) // cols
sheet = Image.new("RGB", (640 * cols, 360 * rows), (40, 40, 40))
for i, im in enumerate(tiles):
    sheet.paste(im, ((i % cols) * 640, (i // cols) * 360))
sheet.save(out)
