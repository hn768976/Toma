/**
 * Builds `radial-equalizer-project.zip`: a self-contained Remotion project
 * holding just the two Radial Audio Equalizer compositions, ready to render at
 * 4K on another machine.
 *
 * The compositions live in this repo's shared `remotion-video` project
 * alongside unrelated pieces, so the standalone project is assembled here
 * rather than duplicated in the tree. node_modules, .git and render output are
 * never copied in.
 *
 * Run with: npm run package
 */

import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const staging = join(root, "out", "radial-equalizer-project");
const zipPath = join(root, "out", "radial-equalizer-project.zip");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const pin = (name) => {
  const v = pkg.dependencies[name] ?? pkg.devDependencies[name];
  if (!v) {
    throw new Error(`${name} is not a dependency of the host project`);
  }
  // Pin exactly — the point of the zip is a reproducible 4K render.
  return v.replace(/^[\^~]/, "");
};

rmSync(staging, { recursive: true, force: true });
mkdirSync(join(staging, "src"), { recursive: true });
mkdirSync(join(staging, "scripts"), { recursive: true });

cpSync(join(root, "src", "radial-equalizer"), join(staging, "src", "radial-equalizer"), {
  recursive: true,
});
cpSync(join(root, "scripts", "verify-loop.mjs"), join(staging, "scripts", "verify-loop.mjs"));
cpSync(join(root, "tsconfig.json"), join(staging, "tsconfig.json"));

writeFileSync(
  join(staging, "package.json"),
  JSON.stringify(
    {
      name: "radial-equalizer",
      version: "1.0.0",
      description:
        "Radial Audio Equalizer — looping 4K circular spectrum visualiser (Remotion)",
      license: "UNLICENSED",
      private: true,
      scripts: {
        dev: "remotion studio",
        build: "remotion bundle",
        "verify-loop": "node scripts/verify-loop.mjs",
        typecheck: "tsc",
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
  RadialEqualizer,
  radialEqualizerSchema,
} from "./radial-equalizer/RadialEqualizer";
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  DURATION_IN_FRAMES,
  FPS,
} from "./radial-equalizer/constants";

// Both compositions are defined at 3840x2160 so they can be rendered at full
// 4K; use --scale=0.5 for a 1080p preview.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-RadialEqualizerOrangeBlue"
        component={RadialEqualizer}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        schema={radialEqualizerSchema}
        defaultProps={{ variant: "orangeBlue" as const }}
      />
      <Composition
        id="V2-RadialEqualizerGoldMagenta"
        component={RadialEqualizer}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        schema={radialEqualizerSchema}
        defaultProps={{ variant: "goldMagenta" as const }}
      />
    </>
  );
};
`,
);

writeFileSync(
  join(staging, "remotion.config.ts"),
  `import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// PNG frames keep the additive highlights clean before the H.264 encode.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// The piece has no audio, so never mux a silent track into the output.
Config.setMuted(true);

// Some sandboxed CI images block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium. On a normal machine this path does not
// exist and Remotion uses its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
`,
);

writeFileSync(join(staging, ".gitignore"), "node_modules\nout\n.DS_Store\n");

cpSync(join(root, "scripts", "zip-readme.md"), join(staging, "README.md"));

rmSync(zipPath, { force: true });
execFileSync("zip", ["-r", "-q", zipPath, "radial-equalizer-project"], {
  cwd: join(root, "out"),
});
rmSync(staging, { recursive: true, force: true });
console.log(`Wrote ${zipPath}`);
