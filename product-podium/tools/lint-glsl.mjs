/**
 * A backtick inside a GLSL string closes the JavaScript template literal
 * that holds it. esbuild then fails on whatever follows, and because the
 * shader sources sit in the middle of long files the error points
 * somewhere unrelated. It has cost two debugging rounds in this project,
 * so it is a lint now.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

let bad = 0;
for (const file of walk("src").filter((f) => /\.tsx?$/.test(f))) {
  const text = readFileSync(file, "utf8");
  // Every glsl-tagged block must contain an even number of backticks —
  // its own opening and closing pair and nothing else.
  const blocks = text.split("/* glsl */").slice(1);
  for (const block of blocks) {
    const upToClose = block.slice(0, block.indexOf("\n`;") + 3);
    const ticks = (upToClose.match(/`/g) ?? []).length;
    if (ticks !== 2) {
      console.error(`${file}: a /* glsl */ block contains ${ticks} backticks; expected exactly 2 (one stray backtick inside the shader will close the template literal)`);
      bad++;
    }
  }
}
if (bad) process.exit(1);
console.log("glsl blocks: no stray backticks");
