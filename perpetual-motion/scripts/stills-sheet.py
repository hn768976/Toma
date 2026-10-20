# StillsSheet.png: all 10 stills at 640×360, labelled, for review.
import os, sys
from PIL import Image, ImageDraw, ImageFont
d = sys.argv[1] if len(sys.argv) > 1 else "renders/stills"
names = ["OverbalancedWheel", "WaterScrewMill", "SelfFlowingFlask", "MagnetRamp", "RollingBallWheel"]
looks = ["Workshop", "Blueprint"]
W, H, LABEL, PAD = 640, 360, 34, 16
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
except OSError:
    font = ImageFont.load_default()
sheet = Image.new("RGB", (PAD + 2 * (W + PAD), PAD + 5 * (H + LABEL + PAD)), (246, 242, 233))
draw = ImageDraw.Draw(sheet)
for r, n in enumerate(names):
    for c, look in enumerate(looks):
        im = Image.open(os.path.join(d, f"PerpetualMotion_{n}_{look}.png")).convert("RGB").resize((W, H), Image.LANCZOS)
        x, y = PAD + c * (W + PAD), PAD + r * (H + LABEL + PAD)
        sheet.paste(im, (x, y))
        draw.text((x + 4, y + H + 7), f"{n} — {look}", fill=(40, 30, 20), font=font)
sheet.save(os.path.join(d, "StillsSheet.png"))
print("StillsSheet.png", sheet.size)
