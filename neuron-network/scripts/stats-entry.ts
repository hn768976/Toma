import { buildField } from "../src/core/field";
import { LOOKS } from "../src/looks/looks";

export const run = () => {
  const rows: string[] = [];
  const header = [
    "composition",
    "neurons",
    "branches",
    "segments",
    "tubeTris",
    "somaTris",
    "particles",
    "sparks",
    "junctions",
    "buildMs",
    "drawCalls",
  ];
  rows.push(header.join("\t"));

  for (const look of LOOKS) {
    const t0 = Date.now();
    const f = buildField(look);
    const ms = Date.now() - t0;
    // Background + merged tubes + merged somas, plus particles and sparks
    // when the look uses them. Everything else is a post pass.
    const drawCalls =
      3 + (f.stats.particleCount > 0 ? 1 : 0) + (f.stats.sparkCount > 0 ? 1 : 0);
    rows.push(
      [
        look.id,
        f.stats.neuronCount,
        f.stats.branchCount,
        f.stats.segmentCount,
        f.stats.tubeTriangleCount,
        f.stats.somaTriangleCount,
        f.stats.particleCount,
        f.stats.sparkCount,
        f.stats.junctionCount,
        ms,
        drawCalls,
      ].join("\t"),
    );
  }
  console.log(rows.join("\n"));
};
