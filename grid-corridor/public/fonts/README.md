`RobotoMono-latin.woff2` is the latin subset of Google's Roboto Mono, licensed
under the SIL Open Font License 1.1. It is vendored here so the render never
depends on reaching a font CDN; `src/fonts.ts` loads it alongside the
`@remotion/google-fonts` face and uses whichever arrives.
