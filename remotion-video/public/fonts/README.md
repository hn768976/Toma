# Vendored typefaces

The HUD uses a condensed technical sans and a monospace, both self-hosted here
rather than fetched at render time. A render that reaches out to a font CDN is
a render that can fail, or worse, silently substitute a fallback face into the
first few frames and make them differ from the rest.

- `BarlowCondensed-*.woff2` — Barlow Condensed (400/500/600), SIL Open Font
  License 1.1. https://fonts.google.com/specimen/Barlow+Condensed
- `RobotoMono-var.woff2` — Roboto Mono (variable weight), Apache License 2.0.
  https://fonts.google.com/specimen/Roboto+Mono

Latin subsets only; nothing on the HUD needs more.
