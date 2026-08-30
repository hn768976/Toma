/**
 * Builds two self-contained, independently runnable Remotion projects — one per
 * variant — from the shared source, and zips each of them.
 *
 * Each output project registers only its own composition and carries only its
 * own palette / rhythm / particle / tree data, inlined as a single VARIANT
 * object rather than a two-key record.
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist-variants");

const VARIANTS = [
  {
    key: "healthy",
    compositionId: "LungsHealthy",
    zip: "lungs-healthy.zip",
    dir: "lungs-healthy",
    outName: "lungs-healthy",
    blurb:
      "A deep, steady breathing cycle: three slow breaths across the loop, a generous " +
      "expansion, a dense seven-generation bronchial tree, and pale specks circulating " +
      "with the breath.",
  },
  {
    key: "strained",
    compositionId: "LungsStrained",
    zip: "lungs-strained.zip",
    dir: "lungs-strained",
    outName: "lungs-strained",
    blurb:
      "Shallow, rapid, obstructed breathing: seven quick breaths across the loop with a " +
      "stutter on two of them, barely any expansion, a sparse five-generation tree with " +
      "thickened terminal airways and constriction nodes, and sluggish specks that never " +
      "reach the periphery.",
  },
];

/** Pull one entry out of the shared VARIANTS record, comments and all. */
const extractVariant = (source, key) => {
  const marker = `  ${key}: {`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`variant ${key} not found`);
  let depth = 0;
  let i = source.indexOf("{", start);
  const bodyStart = i;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return source.slice(bodyStart, i + 1);
};

const singleVariantSource = (source, key) => {
  let head = source.slice(0, source.indexOf("export const VARIANTS"));

  head = head.replace(
    `/**
 * The single source of truth for everything that differs between the two
 * versions: palette, breath rhythm, particle behaviour and tree density.
 * No hex literal lives anywhere else in the piece.
 */`,
    `/**
 * The single source of truth for this version's palette, breath rhythm,
 * particle behaviour and tree density. No hex literal lives anywhere else in
 * the piece.
 */`,
  );

  // Narrow the variant-name union to the one this project ships.
  head = head.replace(
    /export type LungVariantName = .*;/,
    `export type LungVariantName = "${key}";`,
  );

  // A variant with no stutters has no use for the seeded-catch helper, and
  // `noUnusedLocals` would reject it.
  if (!extractVariant(source, key).includes("seededCatches(")) {
    const from = head.indexOf("/**\n * The stutters");
    const to = head.indexOf("export const VARIANTS");
    head = head.slice(0, from) + head.slice(to === -1 ? head.length : to);
    head = head.replace('import { random } from "remotion";\n\n', "");
  }

  const body = extractVariant(source, key)
    .split("\n")
    .map((line, idx) => (idx === 0 ? line : line.replace(/^ {2}/, "")))
    .join("\n");
  return `${head}/**
 * This project ships a single variant, so its data is inlined here rather than
 * looked up out of a shared record.
 */
export const VARIANT: LungVariant = ${body};
`;
};

const LUNGS_TSX = `import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FORK, FRAME_HEIGHT, FRAME_WIDTH, LOBES, LOOP_FRAMES } from "./anatomy";
import { BronchialTree } from "./BronchialTree";
import { LungBody } from "./LungBody";
import { ParticleField } from "./ParticleField";
import { Trachea } from "./Trachea";
import { breathTransform } from "./breath";
import { growTree, scatterParticles } from "./tree";
import { VARIANT } from "./variants";

export const Lungs: React.FC = () => {
  const frame = useCurrentFrame();

  // Tree and particle geometry are generated once. Per-frame work is only the
  // breath transform and the particle offsets.
  const { trees, particles } = useMemo(() => {
    const grown = LOBES.map((lobe) => growTree(lobe, VARIANT));
    return {
      trees: grown,
      particles: scatterParticles(LOBES, grown, VARIANT, FORK),
    };
  }, []);

  const breath = breathTransform(frame, VARIANT, FORK);
  // Every drift path is phrased against the fixed loop length, so frame 0 and
  // frame 420 land on identical values.
  const loopT = frame / LOOP_FRAMES;

  return (
    <AbsoluteFill style={{ backgroundColor: VARIANT.palette.background }}>
      <svg
        width="100%"
        height="100%"
        viewBox={\`0 0 \${FRAME_WIDTH} \${FRAME_HEIGHT}\`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {LOBES.map((lobe) => (
            <clipPath key={lobe.side} id={\`lobe-\${lobe.side}\`}>
              <path d={lobe.path} />
            </clipPath>
          ))}
        </defs>

        {/* The lobes and everything inside them breathe together. */}
        <g transform={breath.transform}>
          {LOBES.map((lobe, i) => (
            <g key={lobe.side}>
              <LungBody lobe={lobe} palette={VARIANT.palette} clipId={\`lobe-\${lobe.side}\`} />
              <g clipPath={\`url(#lobe-\${lobe.side})\`}>
                <BronchialTree tree={trees[i]} palette={VARIANT.palette} />
                {/* Sluggish specks sit still while the lobe moves: the inverse
                    transform cancels the breath for them exactly. */}
                <g
                  transform={
                    VARIANT.particles.behaviour === "circulating"
                      ? undefined
                      : breath.inverseTransform
                  }
                >
                  <ParticleField
                    particles={particles.filter((p) => p.lobe === i)}
                    variant={VARIANT}
                    loopT={loopT}
                    breath={breath.amount}
                  />
                </g>
              </g>
            </g>
          ))}
        </g>

        {/* Fixed: the lobes move relative to it. */}
        <Trachea palette={VARIANT.palette} />
      </svg>
    </AbsoluteFill>
  );
};
`;

const rootTsx = (compositionId) => `import { Composition } from "remotion";
import { FPS, FRAME_HEIGHT, FRAME_WIDTH, LOOP_FRAMES } from "./lungs/anatomy";
import { Lungs } from "./lungs/Lungs";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${compositionId}"
      component={Lungs}
      durationInFrames={LOOP_FRAMES}
      fps={FPS}
      width={FRAME_WIDTH}
      height={FRAME_HEIGHT}
    />
  );
};
`;

const INDEX_TS = `import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
`;

const packageJson = (name) =>
  `${JSON.stringify(
    {
      name,
      version: "1.0.0",
      description: "A 4K breathing-lungs loop built in Remotion",
      license: "UNLICENSED",
      private: true,
      scripts: {
        dev: "remotion studio",
        build: "remotion bundle",
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
  )}\n`;

const TSCONFIG = `${JSON.stringify(
  {
    compilerOptions: {
      target: "ES2018",
      module: "Preserve",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      strict: true,
      noEmit: true,
      lib: ["es2015"],
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      noUnusedLocals: true,
    },
    exclude: ["remotion.config.ts"],
  },
  null,
  2,
)}\n`;

const REMOTION_CONFIG = `import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The piece has no audio; this keeps a silent track out of the output file.
Config.setMuted(true);
`;

const GITIGNORE = "node_modules\nout\ndist\n.DS_Store\n";

const readme = (v) => `# Breathing Lungs — ${v.key}

A flat-vector, 2D breathing-lungs animation built in Remotion. ${v.blurb}

## The composition

| | |
| --- | --- |
| Composition id | \`${v.compositionId}\` |
| Resolution | **3840 × 2160 (4K)** |
| Duration | 420 frames |
| Frame rate | 30 fps |
| Length | 14.0 seconds |
| Loops | Yes — frame 0 and frame 420 are pixel-identical, so the file can be played back seamlessly on repeat |

Every frame is a pure function of \`useCurrentFrame()\`, and all randomness runs
through Remotion's seeded \`random()\`, so renders are deterministic: the same
frame always produces the same pixels.

## Render it at 4K

\`\`\`bash
npm install
npx remotion render ${v.compositionId} out/${v.outName}.mp4 --codec=h264 --crf=14 --concurrency=8
\`\`\`

\`--concurrency\` must not exceed the number of CPU cores on the machine; lower
it if the renderer complains.

## Preview it

\`\`\`bash
npm run dev
\`\`\`

## Layout

\`\`\`
src/
  Root.tsx                  registers the single composition
  index.ts                  entry point
  lungs/
    variants.ts             palette, breath rhythm, particles, tree density
    anatomy.ts              lobe outlines, trachea, geometry helpers
    breath.ts               the breath curve and its transform
    tree.ts                 recursive bronchial tree + particle scattering
    Lungs.tsx               composes the scene
    LungBody.tsx            one lobe: fill plus inner-edge shadow
    BronchialTree.tsx       the airway tree
    ParticleField.tsx       the drifting specks
    Trachea.tsx             the fixed trachea and primary bronchi
\`\`\`
`;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Only the zips are checked in; the unpacked projects are regenerable.
writeFileSync(
  join(dist, ".gitignore"),
  VARIANTS.map((v) => `${v.dir}/`).join("\n") + "\n",
);

const sharedVariants = readFileSync(join(root, "src/lungs/variants.ts"), "utf8");

for (const v of VARIANTS) {
  const projectDir = join(dist, v.dir);
  mkdirSync(join(projectDir, "src/lungs"), { recursive: true });
  mkdirSync(join(projectDir, "public"), { recursive: true });

  for (const file of [
    "anatomy.ts",
    "breath.ts",
    "tree.ts",
    "BronchialTree.tsx",
    "LungBody.tsx",
    "ParticleField.tsx",
    "Trachea.tsx",
  ]) {
    cpSync(join(root, "src/lungs", file), join(projectDir, "src/lungs", file));
  }

  writeFileSync(join(projectDir, "src/lungs/variants.ts"), singleVariantSource(sharedVariants, v.key));
  writeFileSync(join(projectDir, "src/lungs/Lungs.tsx"), LUNGS_TSX);
  writeFileSync(join(projectDir, "src/Root.tsx"), rootTsx(v.compositionId));
  writeFileSync(join(projectDir, "src/index.ts"), INDEX_TS);
  writeFileSync(join(projectDir, "package.json"), packageJson(v.dir));
  writeFileSync(join(projectDir, "tsconfig.json"), TSCONFIG);
  writeFileSync(join(projectDir, "remotion.config.ts"), REMOTION_CONFIG);
  writeFileSync(join(projectDir, ".gitignore"), GITIGNORE);
  writeFileSync(join(projectDir, "README.md"), readme(v));
  writeFileSync(join(projectDir, "public/.gitkeep"), "");

  rmSync(join(dist, v.zip), { force: true });
  execFileSync("zip", ["-r", "-q", join(dist, v.zip), v.dir, "-x", "*/node_modules/*", "*/out/*", "*/.git/*"], {
    cwd: dist,
  });
  console.log(`built ${v.zip}`);
}
