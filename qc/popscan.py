#!/usr/bin/env python3
"""Local flash/pop detector: 16x9 grid cell means per frame; flags cells that
jump and return within 1-3 frames (transients) by more than 3 luma levels."""
import sys,subprocess,numpy as np
p=sys.argv[1]; W,H=480,270
raw=subprocess.run(['ffmpeg','-v','error','-i',p,'-vf',f'scale={W}:{H}:flags=area','-f','rawvideo','-pix_fmt','gray','-'],capture_output=True).stdout
Y=np.frombuffer(raw,np.uint8).reshape(-1,H,W).astype(np.float32); n=len(Y)
# 16x9 grid cell means (30x30 px cells)
G=Y.reshape(n,9,30,16,30).mean((2,4))
step=np.abs(np.diff(G,axis=0))            # n-1,9,16
# robust baseline per cell
med=np.median(step,axis=0); mad=np.median(np.abs(step-med),axis=0)+0.05
z=(step-med)/mad
mx=step.reshape(n-1,-1).max(1); zmax=z.reshape(n-1,-1).max(1)
print('frames',n,'max cell step overall %.2f at %d; median of per-frame max %.2f'%(mx.max(),mx.argmax()+1,np.median(mx)))
flag=[(i+1,round(float(mx[i]),2)) for i in range(n-1) if mx[i]>max(4.0,3*np.median(mx))]
print('flagged steps (frame, max cell step):',flag[:40])
# transient detection: cell goes up and back within 1-3 frames
tr=[]
for k in (1,2,3):
    for i in range(1,n-k):
        a=G[i-1]; b=G[i:i+k].mean(0); c=G[i+k]
        dev=np.minimum(np.abs(b-a),np.abs(b-c))*(np.sign(b-a)==np.sign(b-c))
        if dev.max()>3: tr.append((i,k,round(float(dev.max()),2)))
print('transients >3 levels (start frame, length, size):',tr[:40])
m=Y.mean((1,2)); print('global mean min %.2f max %.2f max|d| %.3f'%(m.min(),m.max(),np.abs(np.diff(m)).max()))
