# Contact sheet: N evenly spaced frames from an mp4, in a grid. Usage: sheet.py in.mp4 out.png N [cols]
import subprocess, sys, json
from PIL import Image
src, out, n = sys.argv[1], sys.argv[2], int(sys.argv[3]); cols = int(sys.argv[4]) if len(sys.argv) > 4 else n
info = json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v','-show_entries','stream=nb_read_frames','-of','json',src]))
total = int(info['streams'][0]['nb_read_frames'])
idx = [round(i*(total-1)/(n-1)) for i in range(n)]
tw, th = 426, 240
rows = (n + cols - 1)//cols
sheet = Image.new('RGB', (cols*tw, rows*th))
for k, f in enumerate(idx):
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',src,'-vf',f'select=eq(n\\,{f}),scale={tw}:{th}','-vsync','0','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'])
    im = Image.frombytes('RGB',(tw,th),raw)
    sheet.paste(im, ((k%cols)*tw, (k//cols)*th))
sheet.save(out); print(out, idx)
