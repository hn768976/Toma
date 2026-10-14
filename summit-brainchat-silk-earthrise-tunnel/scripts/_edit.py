import sys,json
def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        if a not in s: raise SystemExit(f"MISSING in {p}: {a[:70]}")
        s=s.replace(a,b)
    open(p,'w').write(s)
