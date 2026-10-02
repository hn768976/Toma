import sys, zlib, struct
def load(p):
    import subprocess
    w,h=map(int,subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=width,height','-of','csv=p=0',p]).decode().strip().split(','))
    raw=subprocess.check_output(['ffmpeg','-v','error','-i',p,'-f','rawvideo','-pix_fmt','rgb24','-'])
    return w,h,raw
a=load(sys.argv[1]); b=load(sys.argv[2])
if a[:2]!=b[:2]: print('size differs',a[:2],b[:2]); sys.exit()
d=sum(1 for x,y in zip(a[2],b[2]) if x!=y)
print('pixel-identical' if d==0 else f'{d} channel values differ, max diff {max(abs(x-y) for x,y in zip(a[2],b[2]))}')
