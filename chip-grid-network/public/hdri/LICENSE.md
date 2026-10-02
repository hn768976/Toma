# studio_small_03_1k.hdr

- **Asset:** "Studio Small 03", 1k equirectangular Radiance HDR
- **Source:** Poly Haven (formerly HDRI Haven) — https://polyhaven.com/a/studio_small_03
- **Licence:** CC0 1.0 Universal (public domain dedication) — https://polyhaven.com/license
  No attribution required. Author credit is on the asset page above.
- **How it was obtained:** this build environment could not reach polyhaven.com
  directly, so the identical Poly Haven file was taken from the pmndrs/drei-assets
  mirror (`hdri/studio_small_03_1k.hdr`, the same file drei's `studio` environment
  preset uses; that repository credits its HDRIs to HDRI Haven):
  https://raw.githubusercontent.com/pmndrs/drei-assets/master/hdri/studio_small_03_1k.hdr
- **SHA-256:** `29267a4aa8c10de26cae758e4e3c4daadde88673798666ad657724bab7224a35`
- **Size:** 1,680,234 bytes, 1024 × 512

At load time the scene compresses the softbox highlights in memory
(`src/scene/useHdri.ts`); the shipped file is unmodified.
