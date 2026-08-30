/**
 * Builds three self-contained, independently runnable Remotion projects — one
 * per variant — under build/, and zips each.
 *
 * Each project registers only its own composition and carries that variant's
 * layout inlined as fully resolved data, rather than importing a shared
 * three-key object. Components the variant does not use are removed outright.
 *
 * The layout data is not retyped here: src/variants.ts is transpiled and its
 * real buildLayout() is called, so a packaged project can never drift from the
 * source of truth.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const build = join(root, "build");
const dist = join(root, "dist-zips");
const tmp = join(build, ".ts");

const VARIANT_INFO = {
  nodes: {
    compositionId: "CoreHudNodes",
    packageName: "core-hud-nodes",
    zip: "core-hud-nodes.zip",
    title: "Core HUD — Nodes",
    blurb:
      "A node-graph core assembly upper-centre-left, at full panel density: three code panels, two data tables, a side ruler, a radar dial, a reticle and a data-tape bar strip.",
  },
  rings: {
    compositionId: "CoreHudRings",
    packageName: "core-hud-rings",
    zip: "core-hud-rings.zip",
    title: "Core HUD — Rings",
    blurb:
      "The mirrored layout, with a concentric ring assembly upper-centre-right in place of the node graph: radial and ordered where the graph is irregular and web-like. Same palette and panel density.",
  },
  sparse: {
    compositionId: "CoreHudSparse",
    packageName: "core-hud-sparse",
    zip: "core-hud-sparse.zip",
    title: "Core HUD — Sparse",
    blurb:
      "Six elements instead of eleven, each scaled up, leaving roughly 60% of the frame empty black. Stroke weights step up by 1px rather than scaling with the elements.",
  },
};

const ALWAYS_KEPT = ["canvas", "Grain"];

/** The config keys each component actually reads. Entries are trimmed to these
 *  so a packaged layout carries nothing the component ignores. */
const CONFIG_KEYS = {
  NodeGraph: ["seed", "nodes", "edges"],
  RingAssembly: ["seed"],
  RadarDial: ["seed"],
  Reticle: ["seed"],
  CodePanel: ["seed", "lines", "cols", "fontSize", "leading"],
  DataTable: ["seed", "rows", "columns", "title"],
  PercentReadout: ["seed"],
  BarStrip: ["seed"],
  SideRuler: ["seed", "y2"],
};

const trimConfig = (entry) => ({
  ...entry,
  config: Object.fromEntries(
    CONFIG_KEYS[entry.component]
      .filter((k) => entry.config[k] !== undefined)
      .map((k) => [k, entry.config[k]]),
  ),
});

/** Serialise as a TypeScript object literal: identifier keys go unquoted. */
const literal = (value) =>
  JSON.stringify(value, null, 2).replace(/"([A-Za-z_$][A-Za-z0-9_$]*)":/g, "$1:");

const REMOTION_CONFIG = `/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
`;

const transpileVariants = () => {
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  execFileSync(
    "npx",
    [
      "tsc", join(root, "src", "variants.ts"),
      "--outDir", tmp,
      "--module", "esnext",
      "--target", "es2020",
      "--moduleResolution", "bundler",
      "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" },
  );
  const from = join(tmp, "variants.js");
  const to = join(tmp, "variants.mjs");
  writeFileSync(to, readFileSync(from, "utf8"));
  return to;
};

const readme = (name, spec, entries) => {
  const info = VARIANT_INFO[name];
  const components = [...new Set(entries.map((e) => e.component))].sort();
  return `# ${info.title}

${info.blurb}

## The composition

| | |
| --- | --- |
| Composition id | \`${info.compositionId}\` |
| Resolution | **3840 × 2160 (4K UHD)** |
| Duration | 600 frames |
| Frame rate | 30 fps |
| Length | 20.0 seconds |
| Loop | Seamless — frame 600 is pixel-identical to frame 0 |

It loops. Every rotation completes a whole number of its own symmetry periods
across the 600 frames, and every reroll, scroll, drift and flicker schedule is
derived from \`frame % 600\`, so the clip can be repeated end to end with no
visible seam.

## Rendering

Install once:

\`\`\`bash
npm install
\`\`\`

Render at full 4K:

\`\`\`bash
npx remotion render ${info.compositionId} out/${info.packageName}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

A faster 1080p preview:

\`\`\`bash
npx remotion render ${info.compositionId} out/${info.packageName}-preview.mp4 --codec=h264 --crf=18 --scale=0.5
\`\`\`

Or open the studio to scrub the timeline:

\`\`\`bash
npm run dev
\`\`\`

## How it is put together

The layout is data. \`src/variants.ts\` holds this variant's spec — centre
element, mirror flag, element scale, panel density, and which panels are
present — alongside \`LAYOUT\`, an array of \`{ component, x, y, scale }\`
entries in fractions of the frame. \`src/CoreHud.tsx\` walks that array, asks
each component to measure itself, and places it. No layout coordinate is
hard-coded anywhere else.

Components in this variant: ${components.map((c) => `\`${c}\``).join(", ")}.

Everything is 2D canvas — no 3D, no Three.js, no SVG. Each element owns a
canvas at true 4K backing resolution and draws once per React render. Motion is
a pure function of \`useCurrentFrame()\`: there is no \`requestAnimationFrame\`,
no CSS animation, no component state and no \`Date.now()\`, so
\`npx remotion render\` is deterministic and re-rendering gives byte-identical
frames. All randomness comes from Remotion's \`random()\` with stable string
seeds.

For performance, each panel's static chrome and each component's fixed detail
are rendered once to offscreen canvases with \`useMemo\` and blitted; only
rotating bands, changing values and drifting nodes are redrawn per frame.

## The look

Monochrome on pure black. Thin strokes throughout: ${spec.stroke.structure}px for structure
and ${spec.stroke.emphasis}px for emphasis at 4K, and nothing thicker. No fills except tiny
solid dots and the bar strip's blocks. No gradients and no soft edges. Text is
small and mostly illegible; it is texture, and all of it is invented — there is
no real library source anywhere in the project.

The single accent colour, a pale cyan, appears only on the radar dial's
readout. Everything else is grey, which is what makes that one readout work.

The finish is deliberately minimal: no bloom, no vignette, no scanlines, no
chromatic aberration. The only treatment is fine grain at about 2% alpha, just
enough to keep large black areas from banding. The crispness is the product.

## Fonts

The two faces are bundled in \`public/fonts\` and loaded from there, gated with
\`delayRender()\`/\`continueRender()\`, so the project renders with no network
access. Roboto Mono is monospaced, which gives the numeric readouts tabular
figures — without them the percentage jitters as its digits change.

See \`public/fonts/NOTICE.md\` for their licences.
`;
};

const variantsModule = (name, spec, entries) => `import type { ComponentKey, ResolvedEntry } from "./layout";
import type { StrokeSet } from "./theme";

export type VariantSpec = {
  /** Which component fills the centre slot. */
  centre: ComponentKey;
  /** Whether this layout is the mirrored one. */
  mirror: boolean;
  /** The multiplier already applied to every entry's scale below. */
  elementScale: number;
  panelDensity: "full" | "sparse";
  /** Exactly the entry ids present in this variant. */
  panels: string[];
  /** Stroke weights are a property of the piece, not of element size. */
  stroke: StrokeSet;
};

export const VARIANT: VariantSpec = ${literal({
  centre: spec.centre,
  mirror: spec.mirror,
  elementScale: spec.elementScale,
  panelDensity: spec.panelDensity,
  panels: spec.panels,
  stroke: spec.stroke,
})};

/**
 * The layout, as data: one entry per element, positioned in fractions of the
 * frame. The renderer walks this array; anchoring is a property of each
 * component, so nothing here needs to know a panel's size.
 */
export const LAYOUT: ResolvedEntry[] = ${literal(entries)};

export const buildLayout = (): ResolvedEntry[] => LAYOUT;
`;

const registryModule = (components) => {
  const meta = {
    NodeGraph: { measure: "measureNodeGraph", anchor: "center", avoids: true },
    RingAssembly: { measure: "measureRingAssembly", anchor: "center" },
    RadarDial: { measure: "measureRadarDial", anchor: "center" },
    Reticle: { measure: "measureReticle", anchor: "center" },
    CodePanel: { measure: "measureCodePanel", anchor: "topLeft" },
    DataTable: { measure: "measureDataTable", anchor: "topLeft" },
    PercentReadout: { measure: "measurePercentReadout", anchor: "topLeft" },
    BarStrip: { measure: "measureBarStrip", anchor: "span" },
    SideRuler: { measure: "measureSideRuler", anchor: "line" },
  };
  const imports = components
    .map((c) => `import { ${c}, ${meta[c].measure} } from "./components/${c}";`)
    .join("\n");
  const entries = components
    .map(
      (c) =>
        `  ${c}: {\n    Comp: ${c},\n    measure: ${meta[c].measure},\n    anchor: "${meta[c].anchor}",${
          meta[c].avoids ? "\n    avoidsNeighbours: true," : ""
        }\n  },`,
    )
    .join("\n");
  return `import type React from "react";
import type { Anchor, ComponentKey, ElementRenderProps, Measurer } from "./layout";
${imports}

type Registration = {
  Comp: React.FC<ElementRenderProps>;
  measure: Measurer;
  anchor: Anchor;
  /** Elements that place their own internals around their neighbours. */
  avoidsNeighbours?: boolean;
};

export const REGISTRY: Record<ComponentKey, Registration> = {
${entries}
};
`;
};

const rootModule = (name) => {
  const info = VARIANT_INFO[name];
  return `import React from "react";
import { Composition } from "remotion";
import { CoreHud } from "./CoreHud";
import { DURATION, FPS, FRAME_HEIGHT, FRAME_WIDTH } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${info.compositionId}"
      component={CoreHud}
      durationInFrames={DURATION}
      fps={FPS}
      width={FRAME_WIDTH}
      height={FRAME_HEIGHT}
    />
  );
};
`;
};

const replaceOnce = (source, from, to, what) => {
  if (!source.includes(from)) {
    throw new Error(`packaging: could not find ${what} in the source — it has drifted`);
  }
  return source.replace(from, to);
};

const rewriteCoreHud = (source, name) => {
  let out = source;
  out = replaceOnce(
    out,
    `import { buildLayout, VARIANTS } from "./variants";\nimport type { VariantName } from "./variants";`,
    `import { buildLayout, VARIANT } from "./variants";`,
    "the variants import",
  );
  out = replaceOnce(
    out,
    `export const CoreHud: React.FC<{ variant: VariantName }> = ({ variant }) => {`,
    `export const CoreHud: React.FC = () => {`,
    "the CoreHud signature",
  );
  out = replaceOnce(out, `  const spec = VARIANTS[variant];`, `  const spec = VARIANT;`, "the spec lookup");
  out = replaceOnce(
    out,
    `    () => resolveLayout(buildLayout(variant), width, height),\n    [variant, width, height, fontsReady],`,
    `    () => resolveLayout(buildLayout(), width, height),\n    [width, height, fontsReady],`,
    "the layout memo",
  );
  out = replaceOnce(
    out,
    "    () => flickerSchedule(placed.map((p) => p.id), `flicker-${variant}`),\n    [placed, variant],",
    `    () => flickerSchedule(placed.map((p) => p.id), "flicker-${name}"),\n    [placed],`,
    "the flicker memo",
  );
  return out;
};

const fontNotice = `# Bundled fonts

Both faces ship with this project so it renders with no network access.

## Roboto Mono

Copyright the Roboto Mono Project Authors. Licensed under the Apache License,
Version 2.0. You may obtain a copy of the licence at
<http://www.apache.org/licenses/LICENSE-2.0>.

Source: <https://fonts.google.com/specimen/Roboto+Mono>

## Barlow Semi Condensed

Copyright the Barlow Project Authors. Licensed under the SIL Open Font License,
Version 1.1. The full licence text is available at
<https://openfontlicense.org>.

Source: <https://fonts.google.com/specimen/Barlow+Semi+Condensed>

Both licences permit redistribution and embedding, including in commercial work.
`;

const main = async () => {
  const modulePath = transpileVariants();
  const { VARIANTS, buildLayout } = await import(`file://${modulePath}`);

  rmSync(build, { recursive: true, force: true });
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  for (const name of Object.keys(VARIANT_INFO)) {
    const info = VARIANT_INFO[name];
    const spec = VARIANTS[name];
    const entries = buildLayout(name).map(trimConfig);
    const components = [...new Set(entries.map((e) => e.component))];
    const target = join(build, info.packageName);

    mkdirSync(target, { recursive: true });
    for (const file of ["package.json", "package-lock.json", "tsconfig.json", ".gitignore"]) {
      cpSync(join(root, file), join(target, file));
    }
    writeFileSync(join(target, "remotion.config.ts"), REMOTION_CONFIG);
    cpSync(join(root, "public"), join(target, "public"), { recursive: true });
    cpSync(join(root, "src"), join(target, "src"), { recursive: true });

    // Drop every component this variant does not place.
    const keep = new Set([...components, ...ALWAYS_KEPT]);
    for (const c of Object.keys({
      NodeGraph: 1, RingAssembly: 1, RadarDial: 1, Reticle: 1, CodePanel: 1,
      DataTable: 1, PercentReadout: 1, BarStrip: 1, SideRuler: 1,
      canvas: 1, Grain: 1,
    })) {
      if (!keep.has(c)) {
        rmSync(join(target, "src", "components", `${c}.tsx`), { force: true });
      }
    }

    writeFileSync(join(target, "src", "variants.ts"), variantsModule(name, spec, entries));
    writeFileSync(join(target, "src", "registry.ts"), registryModule(components));
    writeFileSync(join(target, "src", "Root.tsx"), rootModule(name));
    writeFileSync(
      join(target, "src", "CoreHud.tsx"),
      rewriteCoreHud(readFileSync(join(root, "src", "CoreHud.tsx"), "utf8"), name),
    );

    // Narrow ComponentKey to the components this project actually ships.
    const layout = readFileSync(join(target, "src", "layout.ts"), "utf8");
    const union = components.map((c) => `  | "${c}"`).join("\n");
    writeFileSync(
      join(target, "src", "layout.ts"),
      replaceOnce(
        layout,
        layout.slice(layout.indexOf("export type ComponentKey ="), layout.indexOf('| "SideRuler";') + '| "SideRuler";'.length),
        `export type ComponentKey =\n${union};`,
        "the ComponentKey union",
      ),
    );

    const pkg = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
    pkg.name = info.packageName;
    pkg.description = `${info.title} — 4K AI core HUD interface animation`;
    writeFileSync(join(target, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);

    const lock = JSON.parse(readFileSync(join(target, "package-lock.json"), "utf8"));
    lock.name = info.packageName;
    if (lock.packages?.[""]) {
      lock.packages[""].name = info.packageName;
    }
    writeFileSync(join(target, "package-lock.json"), `${JSON.stringify(lock, null, 2)}\n`);

    writeFileSync(join(target, "README.md"), readme(name, spec, entries));
    writeFileSync(join(target, "public", "fonts", "NOTICE.md"), fontNotice);

    execFileSync("zip", ["-q", "-r", "-X", join(dist, info.zip), info.packageName], { cwd: build });
    console.log(`packaged ${info.zip}`);
  }

  rmSync(tmp, { recursive: true, force: true });
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
