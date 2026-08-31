# Standalone project zips

Three self-contained, independently runnable Remotion projects, one per
version of the piece. Each contains only its own variant: the other two
palettes are not present in its source.

| Zip | Composition | Look |
| --- | --- | --- |
| `wave-field-blue.zip` | `WaveFieldBlue` | Warm amber particles on a deep blue ground, cyan leading edges |
| `wave-field-violet.zip` | `WaveFieldViolet` | Cool mint particles on a warm violet ground, magenta leading edges |
| `wave-field-mono.zip` | `WaveFieldMono` | White through grey on near-black, no colour at all |

All three are 3840x2160, 450 frames at 30fps (15.0s), seamlessly looping and
silent. Each zip carries its own README with the 4K render command.

Regenerate them from the shared source in `remotion-video/` with:

```sh
python3 packaging/build-zips.py
cd dist-projects && for v in blue violet mono; do
  zip -q -r wave-field-$v.zip wave-field-$v \
    -x "*/node_modules/*" "*/out/*" "*/.git/*" "*/package-lock.json"
done
```
