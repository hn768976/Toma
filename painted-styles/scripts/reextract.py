"""Re-run layer extraction from the cached prefixes (no re-painting)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import layers as L
from drawkit import ROOT
for k in sys.argv[1:]:
    G = list(__import__(f'scenes.{k}_lake', fromlist=['x']).GROUPS)
    out = os.path.join(ROOT, 'remotion', 'public', 'layers', k)
    lay, st = L.extract(k, G, os.path.join(ROOT, 'build', 'prefix', k), out)
    m = json.load(open(os.path.join(out, 'layers.json')))
    m.update(check=st, boatPivot=st['boatPivot'], layers=[[g, os.path.basename(p)] for g, p in lay])
    json.dump(m, open(os.path.join(out, 'layers.json'), 'w'), indent=1)
    print(k, st, flush=True)
