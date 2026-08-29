/**
 * Builds the two self-contained, independently runnable Remotion projects that
 * ship as lab-dashboard-steady.zip / lab-dashboard-alert.zip.
 *
 * Each output registers only its own composition and carries that variant's
 * data inlined in src/config.ts instead of importing a shared two-key object.
 * Every seed string is preserved exactly, so a standalone project renders the
 * same pixels as the combined project it was cut from.
 */
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "dist-projects");

const VARIANT_SPECS = [
  {
    key: "steady",
    dir: "lab-dashboard-steady",
    compId: "LabDashGreen",
    outName: "labdash-steady",
    loops: true,
    blurb:
      "Green, normal operation. All three signals stay within bounds, the " +
      "readouts drift inside narrow bands and no alarms fire.",
  },
  {
    key: "alert",
    dir: "lab-dashboard-alert",
    compId: "LabDashAlert",
    outName: "labdash-alert",
    loops: false,
    blurb:
      "Amber, the system destabilising. A single instability value ramps 0 -> 1 " +
      "across the 600 frames and drives the waveform degradation, the climbing " +
      "readouts and the escalating event schedule together.",
  },
];

/** Pull one variant's object literal out of the shared VARIANTS map. */
const extractVariant = (source, key) => {
  const start = source.indexOf(`\n  ${key}: {`);
  if (start === -1) throw new Error(`variant ${key} not found`);
  let i = source.indexOf("{", start);
  let depth = 0;
  for (let j = i; j < source.length; j++) {
    if (source[j] === "{") depth++;
    else if (source[j] === "}") {
      depth--;
      if (depth === 0) return source.slice(i, j + 1);
    }
  }
  throw new Error(`unbalanced braces for variant ${key}`);
};

/** Everything above the VARIANTS map: the types and the shared label set. */
const extractPreamble = (source) => {
  const marker = "export const VARIANTS";
  const cut = source.slice(0, source.indexOf(marker));
  return cut
    .replace(/export type VariantName[^\n]*\n/, "")
    .replace(
      "/** Copy is shared between the variants; only the tone of the piece changes. */",
      "/** All display copy used by the dashboard. */",
    )
    .replace(
      /^\/\*\*[\s\S]*?\*\/\n/,
      `/**
 * The ONE place where a colour, a piece of display copy, a signal character,
 * a readout behaviour or an event schedule is defined.
 *
 * Nothing else in this project contains a hex literal or a label string:
 * every component receives this config and reads what it needs from it.
 */\n`,
    );
};

const buildConfig = (source, spec) => {
  const preamble = extractPreamble(source);
  // The literal sat one level deep inside VARIANTS; bring it back to column 0.
  const literal = extractVariant(source, spec.key)
    .split("\n")
    .map((line, i) => (i === 0 ? line : line.replace(/^  /, "")))
    .join("\n");
  return `${preamble}/** The one variant this project renders: "${spec.key}". */
export const CONFIG: VariantConfig = ${literal};
`;
};

const patch = (text, pairs) => {
  let out = text;
  for (const [from, to] of pairs) {
    if (!out.includes(from)) throw new Error(`patch target missing: ${from}`);
    out = out.split(from).join(to);
  }
  return out;
};

const README = (spec) => `# Lab Monitoring Dashboard — ${spec.key}

${spec.blurb}

| | |
| --- | --- |
| Composition id | \`${spec.compId}\` |
| Resolution | **3840 × 2160** (4K UHD) |
| Duration | **600 frames** |
| Frame rate | **30 fps** (20.0 s) |
| Loops | **${spec.loops ? "Yes" : "No"}** |

${
  spec.loops
    ? `Frame 0 and frame 600 are pixel-identical — verified as a byte-identical
PNG at full 4K. Every waveform's scroll covers exactly one signal period, and
every reroll and blink derives from \`frame % 600\`, so the piece can be looped
without a visible seam.`
    : `This version is a **one-shot, not a loop**. The instability ramp does not
reset, the two data tables freeze permanently at frame 450 and the cell matrix
goes mostly dark from frame 520, so frames 560-600 hold in the degraded state.
Frame 0 and frame 600 differ by design.`
}

## Install

\`\`\`
npm install
\`\`\`

## Render at 4K

\`\`\`
npx remotion render ${spec.compId} out/${spec.outName}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

A faster 1080p preview of the same composition:

\`\`\`
npx remotion render ${spec.compId} out/${spec.outName}-preview.mp4 --codec=h264 --crf=18 --scale=0.5
\`\`\`

\`npx remotion studio\` opens the composition for scrubbing.

## How it is put together

- \`src/config.ts\` is the only file holding a colour or a piece of display copy.
  Palette, waveform character, readout behaviour and event schedule all hang off
  the one exported \`CONFIG\` object.
- \`src/LabDashboard.tsx\` composes the frame on one offscreen 3840 × 2160 canvas
  and blits it to the single visible canvas. Each component draws into that
  shared context in JSX order, so the tree reads bottom-of-stack first.
- Static panel chrome — background, fills, borders, corner ticks, grids and
  fixed labels — is rasterised once in a \`useMemo\` and copied in with a single
  \`drawImage\` per frame. Only traces, changing values and blinking elements are
  redrawn.
- The three centre signals are generated once, seeded, each as exactly one
  period, and each translates by exactly one of its own periods across the 600
  frames. Panel 2's period is three times panel 1's, which is where the speed
  difference comes from.
- Every value is a pure function of \`useCurrentFrame()\`. No clock, no
  \`requestAnimationFrame\`, no CSS animation, and all randomness goes through
  Remotion's \`random()\` with stable string seeds, so \`npx remotion render\` is
  deterministic.
- Fonts load through \`@remotion/google-fonts\`, gated with
  \`delayRender()\`/\`continueRender()\`; the readouts draw their digits on a fixed
  advance so they do not jitter as digits change.
`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const variantsSource = readFileSync(join(ROOT, "src/variants.ts"), "utf8");

for (const spec of VARIANT_SPECS) {
  const dest = join(OUT, spec.dir);
  mkdirSync(dest, { recursive: true });

  for (const f of ["tsconfig.json", "remotion.config.ts", ".gitignore"]) {
    cpSync(join(ROOT, f), join(dest, f));
  }
  cpSync(join(ROOT, "public"), join(dest, "public"), { recursive: true });
  cpSync(join(ROOT, "src"), join(dest, "src"), { recursive: true });

  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  pkg.name = spec.dir;
  pkg.description = `4K lab monitoring dashboard animation — ${spec.key} variant`;
  writeFileSync(join(dest, "package.json"), JSON.stringify(pkg, null, 2) + "\n");

  // The two-key VARIANTS map becomes this project's single inlined CONFIG.
  rmSync(join(dest, "src/variants.ts"));
  writeFileSync(join(dest, "src/config.ts"), buildConfig(variantsSource, spec));

  for (const f of [
    "src/lib/frame.ts",
    "src/components/PanelChrome.tsx",
    "src/components/DataTable.tsx",
  ]) {
    const p = join(dest, f);
    const depth = f.startsWith("src/lib") || f.startsWith("src/components") ? ".." : ".";
    writeFileSync(
      p,
      patch(readFileSync(p, "utf8"), [
        [`from "${depth}/variants"`, `from "${depth}/config"`],
      ]),
    );
  }

  const dash = join(dest, "src/LabDashboard.tsx");
  writeFileSync(
    dash,
    patch(readFileSync(dash, "utf8"), [
      [
        'import { VARIANTS, type VariantName } from "./variants";',
        'import { CONFIG } from "./config";',
      ],
      [
        "export type LabDashboardProps = { variant: VariantName };\n\n",
        "",
      ],
      [
        "export const LabDashboard: React.FC<LabDashboardProps> = ({ variant }) => {",
        "export const LabDashboard: React.FC = () => {",
      ],
      ["  const cfg = VARIANTS[variant];", "  const cfg = CONFIG;"],
      [`\`alerts-\${variant}\``, `"alerts-${spec.key}"`],
      [`\`glitch-\${variant}\``, `"glitch-${spec.key}"`],
      ["    [cfg, variant],", "    [cfg],"],
      [
        "  }, [ctx, cfg, frame, signals, alerts, variant]);",
        "  }, [ctx, cfg, frame, signals, alerts]);",
      ],
    ]),
  );

  writeFileSync(
    join(dest, "src/Root.tsx"),
    `import React from "react";
import { Composition } from "remotion";
import { LabDashboard } from "./LabDashboard";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./layout";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${spec.compId}"
      component={LabDashboard}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
`,
  );

  writeFileSync(join(dest, "README.md"), README(spec));
  console.log(`built ${dest}`);
}
