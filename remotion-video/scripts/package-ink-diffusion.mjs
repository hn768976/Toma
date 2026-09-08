// Assemble the standalone "Ink Diffusion" Remotion project and zip it.
//
// The shader lives in src/ink-diffusion/ alongside this repo's other videos.
// A buyer rendering at 4K elsewhere should not have to take those with it, so
// this builds a self-contained project around just the ink sources: its own
// Root, its own entry point, and a package.json pinned to the versions this
// was developed against.
//
//   node scripts/package-ink-diffusion.mjs
//
// Writes deliverables/ink-diffusion-project.zip. node_modules, .git and any
// render output are excluded by construction — nothing is copied but source.

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const staging = join(repo, "deliverables", "ink-diffusion-project");
const zip = join(repo, "deliverables", "ink-diffusion-project.zip");

const pkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf8"));
const pin = (name) => {
  const v = pkg.dependencies[name] ?? pkg.devDependencies[name];
  if (!v) throw new Error(`Cannot pin ${name}: not a dependency of this project`);
  return v.replace(/^[\^~]/, "");
};

rmSync(staging, { recursive: true, force: true });
mkdirSync(join(staging, "src"), { recursive: true });

// The shader and its component, verbatim — this is the actual work.
cpSync(join(repo, "src", "ink-diffusion"), join(staging, "src", "ink-diffusion"), {
  recursive: true,
});
cpSync(join(repo, "README.ink-diffusion.md"), join(staging, "README.md"));

writeFileSync(
  join(staging, "package.json"),
  JSON.stringify(
    {
      name: "ink-diffusion",
      version: "1.0.0",
      description: 'Ink Diffusion — macro ink blooming through water, as a GLSL fragment shader',
      license: "UNLICENSED",
      private: true,
      scripts: {
        dev: "remotion studio",
        build: "remotion bundle",
        lint: "tsc",
      },
      dependencies: {
        "@remotion/cli": pin("@remotion/cli"),
        react: pin("react"),
        "react-dom": pin("react-dom"),
        remotion: pin("remotion"),
        zod: pin("zod"),
      },
      devDependencies: {
        "@types/react": pin("@types/react"),
        "@types/web": pin("@types/web"),
        typescript: pin("typescript"),
      },
    },
    null,
    2,
  ) + "\n",
);

writeFileSync(
  join(staging, "src", "index.ts"),
  `import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
`,
);

writeFileSync(
  join(staging, "src", "Root.tsx"),
  `import { Composition } from "remotion";
import {
  InkDiffusion,
  inkDiffusionSchema,
  inkDiffusionDefaults,
} from "./ink-diffusion/InkDiffusion";
import {
  DURATION_IN_FRAMES,
  FPS,
  WIDTH,
  HEIGHT,
} from "./ink-diffusion/constants";

// All three versions are authored at 4K. Render at \`--scale=1\` for the full
// 3840x2160 master, or \`--scale=0.5\` for a 1080p preview — the scale only
// changes the device pixel ratio, never the layout.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-InkBlackOnWhite"
        component={InkDiffusion}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={inkDiffusionSchema}
        defaultProps={{ ...inkDiffusionDefaults, variant: "black-on-white" as const, seed: 1 }}
      />
      <Composition
        id="V2-InkColourOnBlack"
        component={InkDiffusion}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={inkDiffusionSchema}
        defaultProps={{ ...inkDiffusionDefaults, variant: "colour-on-black" as const, seed: 1 }}
      />
      <Composition
        id="V3-MilkInWater"
        component={InkDiffusion}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={inkDiffusionSchema}
        defaultProps={{ ...inkDiffusionDefaults, variant: "milk" as const, seed: 1 }}
      />
    </>
  );
};
`,
);

writeFileSync(
  join(staging, "remotion.config.ts"),
  `/**
 * Note: when using the Node.JS APIs the config file does not apply — pass
 * these options directly to the APIs instead.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);

// Everything visible is a WebGL2 fragment shader, and headless Chromium needs
// ANGLE to expose a usable GL context. On a machine with no GPU, use "swangle"
// instead (ANGLE on top of SwiftShader).
Config.setChromiumOpenGlRenderer("angle");

// PNG rather than JPEG for the intermediate frames. The ink edges are high
// contrast and JPEG ringing there survives into the H.264 encode as mosquito
// noise around the thinnest tendrils.
Config.setVideoImageFormat("png");

Config.setOverwriteOutput(true);
`,
);

writeFileSync(
  join(staging, "tsconfig.json"),
  JSON.stringify(
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
  ) + "\n",
);

writeFileSync(join(staging, ".gitignore"), "node_modules\ndist\nout\n.DS_Store\n.env\n");

rmSync(zip, { force: true });
execFileSync("zip", ["-r", "-q", zip, "ink-diffusion-project"], {
  cwd: join(repo, "deliverables"),
});
rmSync(staging, { recursive: true, force: true });

console.log(`Wrote ${zip}`);
