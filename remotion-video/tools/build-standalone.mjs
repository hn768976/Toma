/**
 * Builds the two self-contained, independently runnable Remotion projects -
 * one per variant - from this repo's shared source, then zips each one.
 *
 *   node tools/build-standalone.mjs
 *
 * Each project gets only its own composition and only its own variant data:
 * the regions marked `// @variant-only:<id>` in src/periodic/variants.ts are
 * stripped for the other variant, so neither zip ships a two-key object.
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(root, "standalone");

const PROJECTS = [
  {
    variant: "assemble",
    dir: "periodic-assemble",
    compositionId: "PeriodicAssemble",
    outputName: "periodic-assemble",
    title: "Periodic Assemble",
    blurb:
      "118 element cells scatter in from off-frame in a seeded random order and " +
      "settle into the standard periodic table. Every cell is the same blue: the " +
      "shape of the table is the subject, not its chemistry.",
    holdBlurb:
      "Frames 150-300 hold the assembled table: cells breathe on a seeded sine, a " +
      "few brighten each second, and the whole table drifts +/-10px. There is no " +
      "category highlighting.",
  },
  {
    variant: "categories",
    dir: "periodic-categories",
    compositionId: "PeriodicCategories",
    outputName: "periodic-categories",
    title: "Periodic Categories",
    blurb:
      "118 element cells arrive in atomic number order, 1 through 118, each sliding " +
      "in from the frame edge nearest its destination, so the table builds row by " +
      "row. Each cell is coloured by its element's category, and the f-block rows " +
      "fill at their real place in the sequence - after La and after Ac.",
    holdBlurb:
      "Frames 150-300 cycle through the ten categories: one brightens to full while " +
      "the rest dim to 30%, held 15 frames each with a 5-frame cross-fade. Ten " +
      "categories x 15 frames fills the hold exactly.",
  },
];

const SHARED_SRC = [
  "periodic/elements.ts",
  "periodic/layout.ts",
  "periodic/motion.ts",
  "periodic/variants.ts",
  "periodic/fonts.ts",
  "periodic/ElementCell.tsx",
  "periodic/TableGrid.tsx",
  "periodic/HighlightPass.tsx",
  "periodic/PeriodicTable.tsx",
];

/** Drop every `// @variant-only:<other>` region, keeping this variant's. */
const stripOtherVariant = (source, keep) => {
  const drop = keep === "assemble" ? "categories" : "assemble";
  const lines = source.split("\n");
  const kept = [];
  let depth = 0;
  for (const line of lines) {
    if (line.includes(`@variant-only:${drop} start`)) {
      depth++;
      continue;
    }
    if (line.includes(`@variant-only:${drop} end`)) {
      depth--;
      continue;
    }
    if (depth > 0) {
      continue;
    }
    if (line.includes(`@variant-only:${keep} start`) || line.includes(`@variant-only:${keep} end`)) {
      continue;
    }
    kept.push(line);
  }
  if (depth !== 0) {
    throw new Error(`unbalanced @variant-only:${drop} regions`);
  }
  const out = kept.join("\n");
  const idLine = 'export type VariantId = "assemble" | "categories";';
  if (!out.includes(idLine)) {
    throw new Error("VariantId declaration not found - update the generator");
  }
  return out.replace(idLine, `export type VariantId = "${keep}";`);
};

const packageJson = (project) =>
  JSON.stringify(
    {
      name: project.dir,
      version: "1.0.0",
      description: `${project.title} - a 4K periodic table animation in Remotion`,
      license: "UNLICENSED",
      private: true,
      scripts: {
        dev: "remotion studio",
        build: "remotion bundle",
        render: `remotion render ${project.compositionId} out/${project.outputName}.mp4 --codec=h264 --crf=12 --concurrency=8`,
        lint: "tsc",
      },
      dependencies: {
        "@remotion/cli": "4.0.515",
        react: "19.2.3",
        "react-dom": "19.2.3",
        remotion: "4.0.515",
      },
      devDependencies: {
        "@types/react": "19.2.7",
        "@types/web": "0.0.166",
        typescript: "5.9.3",
      },
    },
    null,
    2,
  ) + "\n";

const tsconfig = `{
  "compilerOptions": {
    "target": "ES2018",
    "module": "Preserve",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "lib": ["es2015"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true
  },
  "exclude": ["remotion.config.ts"]
}
`;

const remotionConfig = `/**
 * Note: When using the Node.JS APIs, the config file doesn't apply.
 * Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The animation has no audio, so no silent track is muxed into the output.
Config.setMuted(true);
`;

const indexTs = `import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
`;

const rootTsx = (project) => `import { Composition } from "remotion";
import { PeriodicTable } from "./periodic/PeriodicTable";
import {
  DURATION_IN_FRAMES,
  FPS,
  FRAME_HEIGHT,
  FRAME_WIDTH,
} from "./periodic/layout";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${project.compositionId}"
      component={PeriodicTable}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={FRAME_WIDTH}
      height={FRAME_HEIGHT}
      defaultProps={{ variant: "${project.variant}" as const }}
    />
  );
};
`;

const readme = (project) => `# ${project.title}

${project.blurb}

${project.holdBlurb}

## The composition

| | |
| --- | --- |
| Composition id | \`${project.compositionId}\` |
| Resolution | **3840 x 2160 (4K UHD)** |
| Duration | 300 frames = 10.0 s |
| Frame rate | 30 fps |
| Audio | none |

**This animation does not loop.** Frame 0 is an empty frame and frame 300 is the
finished table - that is by design, so the clip has a beginning and an end and
must not be cut back to its start.

## Render at 4K

\`\`\`bash
npm install
npx remotion render ${project.compositionId} out/${project.outputName}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

Lower \`--concurrency\` if the machine has fewer cores than the value given;
Remotion refuses a concurrency above the available core count. For a fast 1080p
check, add \`--scale=0.5\`.

Preview interactively with \`npm run dev\` (Remotion Studio).

## How it is built

2D only - inline SVG in a \`viewBox="0 0 3840 2160"\`, no 3D and no Three.js.

Every value is a pure function of \`useCurrentFrame()\` combined with
\`interpolate()\` and \`spring()\`, and all randomness goes through Remotion's
\`random()\` with stable string seeds. Nothing reads the clock, uses
\`requestAnimationFrame\`, animates in CSS or keeps React state, so a render is
deterministic and any frame can be produced in isolation.

\`\`\`
src/
  Root.tsx                    registers the single composition
  periodic/
    elements.ts               all 118 elements: symbol, number, name, group,
                              period, category
    layout.ts                 standard periodic table geometry and frame size
    variants.ts               the only place a colour literal appears: palette,
                              cell colour rule, arrival mode, highlight behaviour
    motion.ts                 seeded arrival schedule, breathing, brighten pass,
                              ambient drift, highlight intensity
    ElementCell.tsx           one cell: halo, fill, border, number, symbol
    TableGrid.tsx             all 118 cells, split into a body and an ink layer
    HighlightPass.tsx         the additive glow pass over emphasised cells
    PeriodicTable.tsx         defs, bloom, vignette, grain
    fonts.ts                  Poppins 400/700, gated with delayRender()
public/
  fonts/                      the two Poppins faces, served locally
\`\`\`

## Layout

The arrangement is the standard one: hydrogen at group 1 and helium at group 18
with the wide gap between them, groups 1-2 then a gap then groups 13-18 for
periods 2 and 3, all 18 groups filled for periods 4-7, La and Ac in the main
block at period 6/7 group 3, and the lanthanides (Ce-Lu) and actinides (Th-Lr)
in two separate rows below the main block, offset right with a visible gap
above them.

## Fonts

Poppins (SIL Open Font License 1.1) is served from \`public/fonts\` rather than
fetched from a CDN, so a render never depends on network access.
\`delayRender()\` holds the renderer until both weights are ready.
`;

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

for (const project of PROJECTS) {
  const dir = join(outRoot, project.dir);
  mkdirSync(join(dir, "src", "periodic"), { recursive: true });
  mkdirSync(join(dir, "public", "fonts"), { recursive: true });

  for (const file of SHARED_SRC) {
    const source = readFileSync(join(root, "src", file), "utf8");
    const contents =
      file === "periodic/variants.ts"
        ? stripOtherVariant(source, project.variant)
        : source;
    writeFileSync(join(dir, "src", file), contents);
  }

  writeFileSync(join(dir, "src", "index.ts"), indexTs);
  writeFileSync(join(dir, "src", "Root.tsx"), rootTsx(project));
  writeFileSync(join(dir, "package.json"), packageJson(project));
  writeFileSync(join(dir, "tsconfig.json"), tsconfig);
  writeFileSync(join(dir, "remotion.config.ts"), remotionConfig);
  writeFileSync(join(dir, "README.md"), readme(project));
  writeFileSync(
    join(dir, ".gitignore"),
    ["node_modules", "out", ".DS_Store", ""].join("\n"),
  );

  for (const face of ["Poppins-Regular.woff2", "Poppins-Bold.woff2"]) {
    cpSync(join(root, "public", "fonts", face), join(dir, "public", "fonts", face));
  }

  execFileSync("zip", ["-qr", `../${project.dir}.zip`, "."], { cwd: dir });
  console.log(`built ${project.dir}/ and ${project.dir}.zip`);
}
