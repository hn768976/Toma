// Map accuracy check (README "Verification").
//
//   node scripts/map-check.mjs [outDir]
//
// Renders each map's full texture (MapTexture-* compositions, ~2000 px wide),
// collects the placed labels from the browser log, and checks them against
// the shipped Natural Earth data with d3-geo:
//   - every country label anchor lies inside that country's polygon
//   - every sea label anchor lies inside that marine polygon
//   - every state label anchor lies inside that state's polygon
//   - no label anchor lies inside a disputed area
//   - no two label rectangles overlap
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";

const outDir = path.resolve(process.argv[2] ?? "out/map-check");
fs.mkdirSync(outDir, { recursive: true });
const regions = (process.env.REGIONS ?? "Europe,NorthAmerica,World").split(",");

const read = (f) => JSON.parse(fs.readFileSync(path.join("public/data", f), "utf8"));
const fcOf = (topo, name) => (topo.objects[name] ? feature(topo, topo.objects[name]).features : []);
const regional = read("ne_10m_regional.json");
const world = read("ne_50m_world.json");
const admin1 = read("ne_50m_admin1_na.json");

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browserExecutable = fs.existsSync("/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell")
  ? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"
  : undefined;
let failures = 0;
for (const region of regions) {
  const id = `MapTexture-${region}`;
  let payload = null;
  const composition = await selectComposition({ serveUrl, id, browserExecutable });
  await renderStill({
    serveUrl,
    composition,
    output: path.join(outDir, `${id}.png`),
    browserExecutable,
    chromiumOptions: { gl: "angle" },
    timeoutInMilliseconds: 600000,
    onBrowserLog: (log) => {
      if (log.text.startsWith("MAPLABELS ")) payload = JSON.parse(log.text.slice(10));
    },
  });
  if (!payload) throw new Error(`no label log for ${region}`);
  fs.writeFileSync(path.join(outDir, `${id}-labels.json`), JSON.stringify(payload, null, 1));
  const topo = region === "World" ? world : regional;
  const countries = fcOf(topo, "countries");
  const marine = fcOf(topo, "marine");
  const states = fcOf(admin1, "states");
  const disputed = fcOf(regional, "disputed").filter((f) => ["Disputed", "Indeterminate", "Breakaway"].includes(f.properties.TYPE));
  const problems = [];
  const counts = {};
  for (const l of payload.labels) {
    counts[l.kind] = (counts[l.kind] ?? 0) + 1;
    const pt = [l.lon, l.lat];
    let owner = null;
    if (l.kind === "country") owner = countries.filter((f) => f.properties.ADM0_A3 === l.owner);
    if (l.kind === "sea") owner = marine.filter((f) => f.properties.name === l.owner);
    if (l.kind === "state") owner = states.filter((f) => f.properties.name === l.owner);
    if (owner && !owner.some((f) => geoContains(f, pt))) problems.push(`${l.kind} "${l.text}" anchor outside ${l.owner}`);
    const d = disputed.find((f) => geoContains(f, pt));
    if (d) problems.push(`${l.kind} "${l.text}" inside disputed area ${d.properties.NAME}`);
  }
  const L = payload.labels;
  for (let i = 0; i < L.length; i++)
    for (let j = i + 1; j < L.length; j++) {
      const a = L[i].rect, b = L[j].rect;
      if (a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]) problems.push(`overlap: "${L[i].text}" / "${L[j].text}"`);
    }
  // Programmatic sample: 10 country labels, spread through the list.
  // Maps with few country names (North America: states carry the map) top
  // the sample up with state labels, checked against the state polygons.
  let cl = L.filter((l) => l.kind === "country");
  if (cl.length < 10) cl = cl.concat(L.filter((l) => l.kind === "state").slice(0, 10 - cl.length));
  const sample = Array.from({ length: Math.min(10, cl.length) }, (_, i) => cl[Math.floor((i * cl.length) / Math.min(10, cl.length))]);
  const sampleRes = sample.map((l) => {
    const pool = l.kind === "state" ? states.filter((f) => f.properties.name === l.owner) : countries.filter((f) => f.properties.ADM0_A3 === l.owner);
    const ok = pool.some((f) => geoContains(f, [l.lon, l.lat]));
    return `${ok ? "PASS" : "FAIL"} ${l.kind} ${l.text} (${l.owner}) @ ${l.lon.toFixed(2)},${l.lat.toFixed(2)}`;
  });
  console.log(`\n== ${region}: ${JSON.stringify(counts)} texture ${payload.width}x${payload.height}`);
  console.log(`stats ${JSON.stringify(payload.stats)}`);
  console.log("10-label sample:\n  " + sampleRes.join("\n  "));
  console.log(problems.length ? `PROBLEMS (${problems.length}):\n  ${problems.join("\n  ")}` : "no problems");
  failures += problems.length + sampleRes.filter((s) => s.startsWith("FAIL")).length;
  console.log("labels: " + L.map((l) => `${l.kind[0]}:${l.text}`).join(" | "));
}
process.exit(failures ? 1 : 0);
