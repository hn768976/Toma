#!/usr/bin/env python3
"""ffprobe every preview + pixel-exact loop check (frame 0 vs frame 600) on the PNG sequences."""
import json, subprocess, sys, os
from PIL import Image, ImageChops
os.chdir(os.path.join(os.path.dirname(__file__), '..'))
names = {'GPSTrack-Teal': 'GPSTrack_Teal', 'GPSTrack-Interface': 'GPSTrack_Interface', 'GPSAnalysis-Blue': 'GPSAnalysis_Blue',
         'GPSAnalysis-Amber': 'GPSAnalysis_Amber', 'NightMap-HUD': 'NightMap_HUD', 'MapFlyover-Blue': 'MapFlyover_Blue',
         'MapFlyover-Amber': 'MapFlyover_Amber', 'TargetLocator-Grey': 'TargetLocator_Grey', 'TargetLocator-Red': 'TargetLocator_Red'}
loops = {'GPSTrack-Teal', 'GPSTrack-Interface', 'NightMap-HUD', 'TargetLocator-Grey', 'TargetLocator-Red'}
ok = True
for cid, fn in names.items():
    path = f'previews/{fn}.mp4'
    if not os.path.exists(path):
        print(f'{fn}: MISSING'); ok = False; continue
    pr = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]))
    v = [s for s in pr['streams'] if s['codec_type'] == 'video'][0]
    a = [s for s in pr['streams'] if s['codec_type'] == 'audio']
    nb = v.get('nb_frames')
    res = f"{v['width']}x{v['height']} {v['r_frame_rate']} {v['codec_name']} {v['pix_fmt']} audio={len(a)} dur={float(pr['format']['duration']):.3f}s frames={nb}"
    good = v['width'] == 1280 and v['height'] == 720 and v['r_frame_rate'] == '30/1' and v['codec_name'] == 'h264' and v['pix_fmt'] == 'yuv420p' and not a and abs(float(pr['format']['duration']) - 20.0) < 0.02
    line = f'{fn}: {res} -> {"PASS" if good else "FAIL"}'
    if cid in loops:
        d = f'out/frames/{cid}'
        f0 = Image.open(f'{d}/element-000.png').convert('RGB'); f600 = Image.open(f'{d}/element-600.png').convert('RGB')
        same = ImageChops.difference(f0, f600).getbbox() is None
        byte = open(f'{d}/element-000.png', 'rb').read() == open(f'{d}/element-600.png', 'rb').read()
        line += f' | loop 0 vs 600: {"PIXEL-IDENTICAL" if same else "DIFFERENT"}{" (byte-identical PNG)" if byte else ""}'
        good = good and same
    ok = ok and good
    print(line)
print('ALL PASS' if ok else 'SOME FAILED')
