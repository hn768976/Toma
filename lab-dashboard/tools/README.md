# tools

`build-standalone.mjs` cuts this combined project into the two self-contained
Remotion projects that ship as archives:

```
node tools/build-standalone.mjs
zip -rq ../deliverables/lab-dashboard-steady.zip lab-dashboard-steady
zip -rq ../deliverables/lab-dashboard-alert.zip  lab-dashboard-alert
```

Each output registers only its own composition and carries that variant's data
inlined in `src/config.ts` rather than importing the shared two-key `VARIANTS`
object. Every seed string is preserved, so a standalone project renders frames
byte-identical to the ones this project renders.
