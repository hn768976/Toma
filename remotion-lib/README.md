# remotion-lib

Shared building blocks for Remotion projects in this repo.

Everything in here must be:

- **fully parameterised** — no hardcoded colours, sizes or positions;
- **palette-agnostic** — colours always arrive as props/arguments;
- **deterministic** — a pure function of `frame` plus a stable string seed,
  never `Math.random()`, `Date.now()`, `requestAnimationFrame` or component
  state;
- **project-neutral** — nothing that only makes sense for one video.

See [CATALOG.md](./CATALOG.md) for the component index.

## Consuming it

Projects alias `@lib` at the bundler and at TypeScript:

```ts
// remotion.config.ts
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: { ...config.resolve?.alias, "@lib": path.resolve(__dirname, "../remotion-lib/src") },
  },
}));
```

```jsonc
// tsconfig.json
{ "compilerOptions": { "paths": { "@lib/*": ["../remotion-lib/src/*"] } } }
```

Standalone/vendored copies point the same `@lib` alias at their own
`src/lib`, so no import statements need rewriting when a project is
packaged for distribution.
