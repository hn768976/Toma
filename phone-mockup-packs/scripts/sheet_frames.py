import json, sys
# Prints comma-separated frames: for each segment, the given fractions of its length.
fr = [float(x) for x in sys.argv[2].split(",")] if len(sys.argv) > 2 else [0.5]
d = json.load(open("data/packs.json"))
p = [p for p in d["packs"] if p["id"] == sys.argv[1]][0]
out = []
for s in p["segments"]:
    for f in fr:
        out.append(str(min(s["start"] + s["length"] - 1, int(s["start"] + s["length"] * f))))
print(",".join(out))
