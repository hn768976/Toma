# src/lib — vendored from remotion-lib

These files are a copy of the shared library at `~/projects/remotion-lib/src`,
vendored so that this repository — and the standalone zips built from it —
stand alone with no external path dependency.

The library is the canonical source. See its `CATALOG.md` for what each module
does and the house rules new modules must follow (fully parameterised,
palette-agnostic, deterministic, direction-agnostic).

Fix bugs in the library first, then re-copy:

```bash
cp ~/projects/remotion-lib/src/*.ts ~/projects/remotion-lib/src/*.tsx src/lib/
cp ~/projects/remotion-lib/src/passes/*                               src/lib/passes/
```

Nothing here is arrow-field-specific. If you find yourself adding something
that is, it belongs in `src/arrow-field/` instead.
