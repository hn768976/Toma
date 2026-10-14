import sys, subprocess
from PIL import Image
src, n, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
frames = [round(i * (n - 1) / 4) for i in range(5)]
tiles = []
for f in frames:
    p = f"/tmp/_contact_{f}.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", f"select=eq(n\\,{f})", "-frames:v", "1", p], check=True)
    tiles.append(Image.open(p).convert("RGB").resize((384, 216), Image.LANCZOS))
sheet = Image.new("RGB", (384 * 5, 216))
for i, t in enumerate(tiles):
    sheet.paste(t, (384 * i, 0))
sheet.save(out)
print(out, frames)
