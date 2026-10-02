# tiny helper: python3 scripts/rep.py file <<< JSON list of [old, new]
import sys, json
p = sys.argv[1]
s = open(p).read()
for a, b in json.load(sys.stdin):
    assert a in s, f"NOT FOUND in {p}: {a[:80]}"
    s = s.replace(a, b)
open(p, "w").write(s)
