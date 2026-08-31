/**
 * Builds one self-contained Remotion project per search bar variant and zips
 * it, so each version can be handed over and rendered on its own.
 *
 * Each project gets only its own composition and only its own data: the
 * three-key VARIANTS object is reduced to the single variant, and the
 * components the other versions add are dropped along with the code that
 * mounts them. Pruning is driven by markers in the shared source:
 *
 *   something                       // @only green
 *   // @only-start light          (or {/* @only-start light *\/} inside JSX)
 *   ...
 *   // @only-end
 *
 * Lines and regions tagged for a variant survive only in that variant's copy.
 *
 * Usage: node scripts/build-variant-zips.mjs
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "dist-zips");

const VARIANTS = [
  {
    key: "cyan",
    compositionId: "SearchBarCyan",
    title: "AI search bar — cyan",
    blurb: "Deep navy with a glowing cyan pill over a field of square columns.",
    output: "searchbar-cyan.mp4",
  },
  {
    key: "green",
    compositionId: "SearchBarGreen",
    title: "AI search bar — green",
    blurb:
      "A terminal treatment: square corners, monospace type and a result count that keeps resolving.",
    output: "searchbar-green.mp4",
  },
  {
    key: "light",
    compositionId: "SearchBarLight",
    title: "AI search bar — light",
    blurb:
      "Light mode: a drop shadow instead of a glow, with an autocomplete panel under the bar.",
    output: "searchbar-light.mp4",
  },
];

/** Drops every line and region tagged for a variant other than this one. */
const prune = (source, variant) => {
  const lines = source.split("\n");
  const out = [];
  let skipDepth = 0;
  for (const line of lines) {
    const start = line.match(/(?:\/\/|\{\/\*)\s*@only-start\s+([\w ]+?)\s*(?:\*\/\})?$/);
    if (start !== null) {
      const wanted = start[1].trim().split(/\s+/);
      if (wanted.indexOf(variant) === -1) {
        skipDepth = 1;
      }
      continue;
    }
    if (/(?:\/\/|\{\/\*)\s*@only-end\s*(?:\*\/\})?$/.test(line)) {
      skipDepth = 0;
      continue;
    }
    if (skipDepth > 0) {
      continue;
    }
    const only = line.match(/\/\/\s*@only\s+([\w\s]+)$/);
    if (only !== null) {
      if (only[1].trim().split(/\s+/).indexOf(variant) === -1) {
        continue;
      }
      out.push(line.replace(/\s*\/\/\s*@only\s+[\w\s]+$/, ""));
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
};

/** Reduces VARIANTS to a single key and narrows the VariantName union. */
const singleVariantSource = (source, variant) => {
  const keys = VARIANTS.map((v) => v.key);
  let result = source;
  for (const key of keys) {
    if (key === variant) {
      continue;
    }
    const startMarker = `\n  ${key}: {`;
    const start = result.indexOf(startMarker);
    if (start === -1) {
      throw new Error(`Could not find the ${key} entry in VARIANTS`);
    }
    // Walk braces to the end of this entry, then swallow the trailing comma.
    let i = result.indexOf("{", start);
    let depth = 0;
    for (; i < result.length; i++) {
      if (result[i] === "{") depth++;
      else if (result[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    let end = i + 1;
    if (result[end] === ",") end++;
    if (result[end] === "\n") end++;
    // Take the banner comment above the entry with it.
    let from = start + 1;
    const banner = result.lastIndexOf("\n  /* ", start + 1);
    if (banner !== -1 && result.slice(banner, start).indexOf("};") === -1) {
      from = banner + 1;
    }
    result = result.slice(0, from) + result.slice(end);
  }
  return result
    .replace(/export type VariantName =[^;]+;/, `export type VariantName = "${variant}";`)
    .replace(/\n{2,}\};/, "\n};");
};

const packageJson = (variant) =>
  `${JSON.stringify(
    {
      name: `search-bar-${variant.key}`,
      version: "1.0.0",
      description: variant.blurb,
      license: "UNLICENSED",
      private: true,
      scripts: {
        dev: "remotion studio",
        build: "remotion bundle",
        render: `remotion render ${variant.compositionId} out/${variant.output} --codec=h264 --crf=14 --concurrency=8`,
        lint: "tsc",
      },
      dependencies: {
        "@remotion/cli": "4.0.515",
        "@remotion/google-fonts": "4.0.515",
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

const rootTsx = (variant) => `import { Composition } from "remotion";
import {
  SearchBar,
  SEARCH_BAR_DURATION,
  SEARCH_BAR_FPS,
  SEARCH_BAR_HEIGHT,
  SEARCH_BAR_WIDTH,
} from "./search-bar/SearchBar";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${variant.compositionId}"
      component={SearchBar}
      durationInFrames={SEARCH_BAR_DURATION}
      fps={SEARCH_BAR_FPS}
      width={SEARCH_BAR_WIDTH}
      height={SEARCH_BAR_HEIGHT}
      defaultProps={{ variant: "${variant.key}" as const }}
    />
  );
};
`;

const remotionConfig = `/**
 * Config for the CLI. When driving Remotion from the Node APIs instead, pass
 * these options directly to the API.
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium at this path. Reuse it there; on a
// normal machine the path does not exist and Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
`;

const indexTs = `import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
`;

const readme = (variant, term, extras) => `# ${variant.title}

${variant.blurb}

| | |
| --- | --- |
| Composition id | \`${variant.compositionId}\` |
| Resolution | 3840 x 2160 (4K UHD) |
| Duration | 480 frames — 16.0 s |
| Frame rate | 30 fps |
| Loops | Yes, seamlessly. Frame 480 is pixel-identical to frame 0, so the clip can be looped with no cut. |
| Search term | \`${term}\` |

## The cycle

| Frames | |
| --- | --- |
| 0–30 | Empty bar, cursor blinking |
| 30–${extras.typeEnd} | The term types in, character by character |
| ${extras.typeEnd}–290 | The completed term holds, cursor blinking |
| 290–330 | The term deletes, right to left, faster and more evenly than it typed |
| 330–480 | Empty bar, cursor blinking — then the loop repeats |

${extras.notes}

## Running it

\`\`\`bash
npm install
npm run dev          # Remotion Studio
\`\`\`

## Rendering at 4K

\`\`\`bash
npx remotion render ${variant.compositionId} out/${variant.output} --codec=h264 --crf=14 --concurrency=8
\`\`\`

Drop \`--concurrency\` (or lower it) on a machine with fewer than 8 cores —
Remotion refuses a concurrency above the core count.

## How it is put together

Every pixel is drawn to a canvas from \`useCurrentFrame()\` alone: no
\`Date.now()\`, no \`requestAnimationFrame\`, no CSS animation and no component
state on the drawing path, so a render is deterministic and repeatable. All
randomness comes from Remotion's \`random()\` with fixed string seeds, which is
why the typing rhythm is identical on every render.

\`\`\`
src/search-bar/
  variants.ts              palette, term, timings — the only place a colour
                           or a search string appears
  typing.ts                the typing engine: irregular intervals, word
                           boundary hesitations, bursts, cursor blink
  layout.ts                geometry, all derived from the pill's height
  fonts.ts                 font loading, gated with delayRender()
  components/              Bar, TypedText, Cursor, MagnifierIcon, DataField${extras.componentList}
\`\`\`

Fonts are Inter and JetBrains Mono, served from \`public/fonts\` rather than
fetched from Google at render time so that a render never depends on the
network.
`;

const copyTree = (from, to, filter) => {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const src = join(from, entry);
    const dest = join(to, entry);
    if (statSync(src).isDirectory()) {
      copyTree(src, dest, filter);
      continue;
    }
    if (filter !== undefined && !filter(src)) {
      continue;
    }
    const text = readFileSync(src, "utf8");
    writeFileSync(dest, text);
  }
};

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const EXTRA_COMPONENTS = {
  cyan: { file: null, notes: "", componentList: "" },
  green: {
    file: "ResultCount.tsx",
    notes:
      "Once typing completes, a result count fades up under the bar and keeps re-rolling every 20–30 frames — the same order of magnitude, small changes — as though the count were still resolving. It fades out when deletion begins.",
    componentList: ", ResultCount",
  },
  light: {
    file: "Autocomplete.tsx",
    notes:
      "An autocomplete panel expands under the bar once about half the term is typed, with the matched prefix of each suggestion in the normal weight and the completion in bold. The highlight steps down the rows every 40 frames, and the panel collapses when deletion begins.",
    componentList: ", Autocomplete",
  },
};

for (const variant of VARIANTS) {
  const stage = join(outDir, `search-bar-${variant.key}`);
  const extras = EXTRA_COMPONENTS[variant.key];
  const drop = ["ResultCount.tsx", "Autocomplete.tsx"].filter(
    (name) => name !== extras.file,
  );

  copyTree(
    join(root, "src", "search-bar"),
    join(stage, "src", "search-bar"),
    (file) => !drop.some((name) => file.endsWith(name)),
  );

  // Prune the tagged lines and regions in every copied source file.
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      writeFileSync(path, prune(readFileSync(path, "utf8"), variant.key));
    }
  };
  walk(join(stage, "src", "search-bar"));

  const variantsPath = join(stage, "src", "search-bar", "variants.ts");
  writeFileSync(
    variantsPath,
    singleVariantSource(readFileSync(variantsPath, "utf8"), variant.key),
  );

  writeFileSync(join(stage, "src", "Root.tsx"), rootTsx(variant));
  writeFileSync(join(stage, "src", "index.ts"), indexTs);
  writeFileSync(join(stage, "package.json"), packageJson(variant));
  writeFileSync(join(stage, "remotion.config.ts"), remotionConfig);
  cpSync(join(root, "tsconfig.json"), join(stage, "tsconfig.json"));

  mkdirSync(join(stage, "public", "fonts"), { recursive: true });
  for (const font of [
    "Inter-latin-variable.woff2",
    "JetBrainsMono-latin-variable.woff2",
  ]) {
    cpSync(join(root, "public", "fonts", font), join(stage, "public", "fonts", font));
  }

  // Read the term straight out of the generated single-variant file, so the
  // README can never drift from the code.
  const term = /term:\s*"([^"]+)"/.exec(readFileSync(variantsPath, "utf8"))[1];
  const typeEnd = /typeEnd:\s*(\d+)/.exec(readFileSync(variantsPath, "utf8"))[1];
  writeFileSync(
    join(stage, "README.md"),
    readme(variant, term, {
      typeEnd,
      notes: extras.notes,
      componentList: extras.componentList,
    }),
  );
  writeFileSync(join(stage, ".gitignore"), "node_modules\nout\ndist\n");

  const zipPath = join(outDir, `search-bar-${variant.key}.zip`);
  execFileSync("zip", ["-rq", zipPath, `search-bar-${variant.key}`], { cwd: outDir });
  console.log(`built ${zipPath}`);
}
