// Renders the full 35s at 1920x1080 as PNG frames, then muxes to H.264 mp4.
// riv_render_video caps at 30s and always starts at t=0; renderFrames takes a
// startTime, so the piece is rendered in continuous chunks instead.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { RiveHost } from "/opt/node22/lib/node_modules/rive-mcp-server/dist/riveHost.js";
import { PAGE_SCRIPT } from "/opt/node22/lib/node_modules/rive-mcp-server/dist/pageScript.js";

const DIR = "/home/user/Toma/rive-explainer";
const OUT = `${DIR}/frames/seq`;
const TOTAL = 1050, FPS = 30, CHUNK = 150;
const W = Number(process.env.RW || 1920), H = Number(process.env.RH || 1080);

mkdirSync(OUT, { recursive: true });
const buf = Buffer.from(readFileSync(`${DIR}/adhd-brain.riv`));
const host = new RiveHost(PAGE_SCRIPT);

let n = 0;
for (let start = 0; start < TOTAL; start += CHUNK) {
  const count = Math.min(CHUNK, TOTAL - start);
  const r = await host.renderFrames(buf, {
    stateMachine: "Main", artboard: "Explainer",
    startTime: start / FPS, frameCount: count, fps: FPS,
    width: W, height: H, background: "#131A33", format: "png",
  });
  r.frames.forEach((b64, i) => {
    writeFileSync(`${OUT}/${String(start + i).padStart(5, "0")}.png`, Buffer.from(b64, "base64"));
    n++;
  });
  console.log(`  frames ${start}..${start + count - 1} (${(start / FPS).toFixed(2)}s)`);
}
await host.close();
console.log(`rendered ${n} frames at ${W}x${H}`);
