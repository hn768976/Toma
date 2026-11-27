#!/usr/bin/env python3
"""Tiny tuning helper: scripts/set.py file key=value ... (first match of `key: <number>`)."""
import re, sys
p = sys.argv[1]; s = open(p).read()
for kv in sys.argv[2:]:
    k, v = kv.split("=")
    s, n = re.subn(r"(\b%s:\s*)-?[0-9.]+(?:\s*/\s*[0-9.]+)?" % re.escape(k), r"\g<1>" + v, s, count=1)
    assert n == 1, k
open(p, "w").write(s)
