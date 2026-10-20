// Bundled by scripts/render-stills.mjs for Node: renders a machine at a frame
// as one standalone vector SVG (with an SVG-native background).
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MACHINES } from "../src/machines/index.ts";
import { MachineSvg } from "../src/lib/Stage.tsx";
import { LOOKS, type LookName } from "../src/lib/look.ts";
import { cameraAt } from "../src/lib/camera.ts";

export function svgOf(id: string, look: LookName, frame: number, width: number, height: number) {
  const def = MACHINES[id];
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + renderToStaticMarkup(<MachineSvg def={def} frame={frame} look={LOOKS[look]} camera={cameraAt(frame)} standalone width={width} height={height} />);
}
