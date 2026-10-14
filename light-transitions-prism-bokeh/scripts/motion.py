# Step 6: frame-to-frame change. Flags single-frame jumps (a diff much larger than both neighbours).
import subprocess, sys, numpy as np
def frames(path, start, count, w=320, h=180):
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',path,'-vf',f'select=between(n\\,{start}\\,{start+count-1}),scale={w}:{h}:flags=area','-vsync','0','-f','rawvideo','-pix_fmt','rgb24','-'])
    return np.frombuffer(raw,np.uint8).reshape(-1,h,w,3).astype(float)
for name,start,count in [('LightSweep_Violet',0,240),('LightSweep_Gold',0,240),('FlareBurst_VioletGold',0,180),('FlareBurst_Cyan',0,180),
                         ('LightLeak_VioletBlue',0,360),('LightLeak_WarmAmber',0,360),('PrismLight_Rainbow',270,60),('RedBokeh_RedGold',270,60)]:
    F = frames(f'out/previews/{name}.mp4', start, count)
    mean = F.mean((1,2,3))
    d = np.abs(np.diff(F,axis=0)).mean((1,2,3))
    spikes = [i+start+1 for i in range(1,len(d)-1) if d[i] > 3*max(d[i-1],d[i+1],0.3)]
    # brightness steps: largest single-frame change in mean brightness
    db = np.abs(np.diff(mean))
    print(f"{name}: frames {start}-{start+count-1}; max mean-brightness step {db.max():.2f}/255 at f{int(db.argmax())+start+1}; "
          f"median frame diff {np.median(d):.2f}, max {d.max():.2f}; isolated single-frame spikes: {spikes or 'none'}")
