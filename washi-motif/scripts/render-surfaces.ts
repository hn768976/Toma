/**
 * Render the surface set — every full-bleed texture in the palette it was
 * designed for — and then the surface sheet.
 *
 * Run with: npm run batch:surfaces
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { SURFACES, SURFACE_NAMES } from "../src/surfaces";

const OUT_DIR = "out/surfaces";
const SHEET = "out/surface-sheet.png";

mkdirSync(OUT_DIR, { recursive: true });

const remotion = (args: string[]) => {
  execFileSync("npx", ["remotion", ...args], { stdio: "inherit" });
};

console.log(`Rendering ${SURFACE_NAMES.length} surfaces into ${OUT_DIR}/\n`);

SURFACE_NAMES.forEach((name, index) => {
  const spec = SURFACES[name];
  const file = `${OUT_DIR}/washi-${name}-${spec.palette}.png`;
  console.log(`[${index + 1}/${SURFACE_NAMES.length}] ${file}`);
  remotion([
    "still",
    "WashiSurface",
    file,
    `--props=${JSON.stringify({ surface: name, palette: spec.palette })}`,
  ]);
});

console.log(`\nRendering the surface sheet into ${SHEET}`);
remotion(["still", "SurfaceSheet", SHEET]);

console.log("\nDone.");
