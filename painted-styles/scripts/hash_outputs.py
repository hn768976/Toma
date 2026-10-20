"""sha256 of every painted output (layers, draw-on frames, stills) -> a sorted list, for the re-paint check.
  python scripts/hash_outputs.py > docs/hashes_run1.txt"""
import hashlib, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dirs = [os.path.join(ROOT, 'remotion', 'public', 'layers'), os.path.join(ROOT, 'remotion', 'public', 'drawon'),
        os.path.join(ROOT, 'stills')] + [os.path.join(ROOT, 'build', 'prefix')]
for d in dirs:
    for base, _, files in sorted(os.walk(d)):
        for f in sorted(files):
            if f.endswith('.png'):
                p = os.path.join(base, f)
                print(hashlib.sha256(open(p, 'rb').read()).hexdigest(), os.path.relpath(p, ROOT))
