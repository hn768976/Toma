"""
Pre-processing that produced public/textures for composition 2. Not needed to
render (outputs are committed); included so the assets can be rebuilt/audited.

Inputs (public-domain NASA imagery / Natural Earth data):
  --day     2_no_clouds_4k.jpg      NASA Blue Marble (no clouds), 4096x2048
  --night   earth_night_4096.jpg    NASA Black Marble city lights, 4096x2048
  --clouds  earth_bump_roughness_clouds_4096.jpg (three.js examples; NASA-derived),
            cloud cover is its blue channel, 4096x2048
  --land    land_8k.png             land mask built by globe-network-comp1/scripts/build_assets.py
  --lights  lights.json             city-light points built by the same script
Outputs:
  public/textures/day_4k.jpg, night_4k.jpg, clouds_4k.jpg, land_8k.png, public/data/lights.json
"""
import argparse, os, shutil
import numpy as np
from PIL import Image

p = argparse.ArgumentParser()
for k in ("day", "night", "clouds", "land", "lights", "out"):
    p.add_argument("--" + k, required=True)
a = p.parse_args()
t = os.path.join(a.out, "public/textures")
os.makedirs(t, exist_ok=True)
os.makedirs(os.path.join(a.out, "public/data"), exist_ok=True)
Image.open(a.day).convert("RGB").save(os.path.join(t, "day_4k.jpg"), quality=92)
Image.open(a.night).convert("RGB").save(os.path.join(t, "night_4k.jpg"), quality=92)
# cloud density is stored in the blue channel; lift the black point slightly
c = np.asarray(Image.open(a.clouds).convert("RGB"), dtype=np.float32)[..., 2]
c = np.clip((c - 18.0) / (255.0 - 18.0), 0, 1) * 255.0
Image.fromarray(c.astype(np.uint8)).save(os.path.join(t, "clouds_4k.jpg"), quality=92)
# only the land-mask channel is needed here (R), saved as 8-bit grey
Image.open(a.land).getchannel("R").save(os.path.join(t, "land_8k.png"), optimize=True)
shutil.copy(a.lights, os.path.join(a.out, "public/data/lights.json"))
print("done")
