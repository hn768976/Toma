def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        if a in s:
            s=s.replace(a,b); continue
        a2,b2=a.strip(),b.strip()
        if a2 and s.count(a2)>=1:
            s=s.replace(a2,b2); continue
        raise SystemExit(f"MISSING in {p}: {a[:70]}")
    open(p,'w').write(s)
