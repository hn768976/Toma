# Previews

1080p (half-scale) H.264 renders of both compositions, committed so they survive
the machine they were rendered on. Both are `--crf=18 --scale=0.5` renders of the
4K compositions — same framing, a quarter of the pixels.

| file | composition | loops |
| --- | --- | --- |
| `access-denied-preview.mp4` | `AccessDenied` | yes — frames 0 and 300 are pixel-identical |
| `access-granted-preview.mp4` | `AccessGranted` | no — one-shot resolution, by design |

Regenerate with:

```bash
npx remotion render AccessDenied  out/access-denied-preview.mp4  --codec=h264 --crf=18 --scale=0.5
npx remotion render AccessGranted out/access-granted-preview.mp4 --codec=h264 --crf=18 --scale=0.5
```

Full 4K, for the final render:

```bash
npx remotion render AccessDenied  out/access-denied.mp4  --codec=h264 --crf=12 --concurrency=8
npx remotion render AccessGranted out/access-granted.mp4 --codec=h264 --crf=12 --concurrency=8
```
