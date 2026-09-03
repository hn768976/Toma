# remotion-lib

Source-only shared components for Remotion canvas work.

Read `CATALOG.md` before building anything, and copy in whatever fits rather
than rebuilding it. Keep the `src/lib` + `src/components` layout when you
vendor files into a project, so the relative imports resolve unchanged.

After a build works, extract anything fully parameterised, palette-agnostic,
deterministic and plausibly reusable back into here, add a `CATALOG.md` entry,
then import it back into the project and confirm the render is unchanged.

---

This directory is the canonical copy of `~/projects/remotion-lib`, committed
into this repository so it survives the ephemeral build environment. Keep the
two in sync.
