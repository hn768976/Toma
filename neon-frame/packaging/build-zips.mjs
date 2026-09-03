/**
 * Builds the two standalone distributable ZIPs.
 *
 * Each ZIP is a complete Remotion project that registers exactly one
 * composition, with the shared component library already vendored into
 * src/lib/ so nothing is resolved from outside the archive. node_modules/,
 * out/ and .git/ are excluded.
 *
 *   node packaging/build-zips.mjs
 */
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import path from "node:path";

const run = promisify(execFile);
const root = process.cwd();
const dist = path.join(root, "dist");

const VARIANTS = [
  { key: "blue", comp: "NeonFrameBlue", zip: "neon-frame-blue.zip" },
  { key: "amber", comp: "NeonFrameAmber", zip: "neon-frame-amber.zip" },
];

const COPY = [
  "src",
  "public",
  "package.json",
  "tsconfig.json",
  "remotion.config.ts",
  "scripts",
];

/** A Root.tsx registering only this variant's composition. */
const rootFor = ({ key, comp }) => `import React from "react";
import { Composition } from "remotion";
import { NeonFrame } from "./neon-frame/NeonFrame";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./neon-frame/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${comp}"
      component={NeonFrame}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "${key}" as const }}
    />
  );
};
`;

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

for (const variant of VARIANTS) {
  const stage = await mkdtemp(path.join(tmpdir(), `neon-frame-${variant.key}-`));
  const dir = path.join(stage, `neon-frame-${variant.key}`);
  await mkdir(dir, { recursive: true });

  for (const entry of COPY) {
    await cp(path.join(root, entry), path.join(dir, entry), {
      recursive: true,
    });
  }

  await writeFile(path.join(dir, "src/Root.tsx"), rootFor(variant));
  await cp(
    path.join(root, `packaging/README-${variant.key}.md`),
    path.join(dir, "README.md"),
  );
  await writeFile(
    path.join(dir, "package.json"),
    `${JSON.stringify(
      {
        ...pkg,
        name: `neon-frame-${variant.key}`,
        description: `4K neon title-plate animation (${variant.key} variant), built with Remotion`,
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(dir, ".gitignore"),
    "node_modules/\nout/\ndist/\n.env\n",
  );

  const target = path.join(dist, variant.zip);
  // -x guards against anything that slipped into the staged copy.
  await run(
    "zip",
    [
      "-r",
      "-q",
      target,
      `neon-frame-${variant.key}`,
      "-x",
      "*/node_modules/*",
      "*/out/*",
      "*/.git/*",
      "*/dist/*",
    ],
    { cwd: stage },
  );
  await rm(stage, { recursive: true, force: true });
  console.log(`Built ${target}`);
}
