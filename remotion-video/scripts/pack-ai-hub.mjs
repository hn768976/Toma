// Builds `ai-hub-project.zip`: a standalone, self-contained Remotion
// project for the AI Hub Network clip.
//
// The delivered project deliberately isn't a copy of this repo. It
// carries only the ai-hub sources, a Root that registers just the two
// hub compositions, and a config without the sandbox-specific browser
// override that this repo needs. Dependency versions are read from the
// real package.json so the pinned set can't drift from what the clip
// was actually rendered with.

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "out");
const stage = join(outDir, "ai-hub-project");

const source = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const pick = (obj, names) =>
  Object.fromEntries(names.map((n) => [n, obj[n]]).filter(([, v]) => v));

rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, "src"), { recursive: true });

cpSync(join(root, "src", "ai-hub"), join(stage, "src", "ai-hub"), {
  recursive: true,
});

writeFileSync(
  join(stage, "package.json"),
  `${JSON.stringify(
    {
      name: "ai-hub-network",
      version: "1.0.0",
      description: "AI Hub Network - radial hub motion graphic (Remotion)",
      license: "UNLICENSED",
      private: true,
      scripts: {
        dev: "remotion studio",
        lint: "eslint src && tsc",
        "render:v1":
          "remotion render V1-AIHubBlue out/V1_AIHubBlue.mp4 --scale=1 --crf=16",
        "render:v2":
          "remotion render V2-AIHubTeal out/V2_AIHubTeal.mp4 --scale=1 --crf=16",
      },
      dependencies: pick(source.dependencies, [
        "@remotion/cli",
        "react",
        "react-dom",
        "remotion",
        "zod",
      ]),
      devDependencies: pick(source.devDependencies, [
        "@remotion/eslint-config-flat",
        "@types/react",
        "@types/web",
        "eslint",
        "prettier",
        "typescript",
      ]),
    },
    null,
    2,
  )}\n`,
);

writeFileSync(
  join(stage, "src", "index.ts"),
  'import { registerRoot } from "remotion";\nimport { RemotionRoot } from "./Root";\n\nregisterRoot(RemotionRoot);\n',
);

writeFileSync(
  join(stage, "src", "Root.tsx"),
  `import { Composition } from "remotion";
import {
  AIHubNetwork,
  aiHubSchema,
  aiHubBlueDefaults,
  aiHubTealDefaults,
} from "./ai-hub/AIHubNetwork";
import {
  BASE_WIDTH,
  BASE_HEIGHT,
  DURATION_IN_FRAMES,
  FPS,
} from "./ai-hub/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-AIHubBlue"
        component={AIHubNetwork}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        schema={aiHubSchema}
        defaultProps={aiHubBlueDefaults}
      />
      <Composition
        id="V2-AIHubTeal"
        component={AIHubNetwork}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        schema={aiHubSchema}
        defaultProps={aiHubTealDefaults}
      />
    </>
  );
};
`,
);

writeFileSync(
  join(stage, "remotion.config.ts"),
  `import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// bt709 rather than the default, which tags the output full-range and
// makes ffprobe report yuvj420p instead of the yuv420p asked for.
Config.setColorSpace("bt709");
// The clip has no sound; without this Remotion still writes a silent
// AAC track into the container.
Config.setMuted(true);
`,
);

cpSync(join(root, "tsconfig.json"), join(stage, "tsconfig.json"));
cpSync(join(root, "eslint.config.mjs"), join(stage, "eslint.config.mjs"));
cpSync(join(root, ".prettierrc"), join(stage, ".prettierrc"));
writeFileSync(join(stage, ".gitignore"), "node_modules\nout\n");
cpSync(join(root, "src", "ai-hub", "README.md"), join(stage, "README.md"));

rmSync(join(stage, "src", "ai-hub", "README.md"), { force: true });

const zipPath = join(outDir, "ai-hub-project.zip");
rmSync(zipPath, { force: true });
execFileSync("zip", ["-qr", zipPath, "ai-hub-project"], { cwd: outDir });
console.log(`wrote ${zipPath}`);
