import React, { useCallback, useMemo, useRef } from "react";
import type { RoughCanvas } from "roughjs/bin/canvas";
import { hexToLinear, hexToOD } from "../lib/color";
import { boilSeed, onTwos } from "../lib/random";
import { roughOn } from "../lib/sketch";
import { Stage, useOverlay, type FrameContext } from "../lib/Stage";
import { MAP_H, MAP_W, loadWorld, type World } from "../lib/world";
import type { MapColourway } from "../palettes";

const SCENE = /* glsl */ `
uniform sampler2D uSea;
uniform sampler2D uLand;
uniform sampler2D uInk;
uniform vec4 uMapRect;   // x, y, w, h in comp px
uniform vec3 uInkOD;
uniform vec3 uSeaOD;
uniform float uStain;
void main() {
  vec2 q = screenComp();
  vec2 s = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
  vec2 m = (q - uMapRect.xy) / uMapRect.zw;
  // map-space coordinate (3840 basis) so textures stick to the map as it drifts
  vec2 mq = m * vec2(${MAP_W.toFixed(1)}, ${MAP_H.toFixed(1)});
  vec3 col = paperBase(q);
  // antique paper: tea-coloured blotches and a faint darkening at the edges
  float st = smoothstep(0.45, 0.8, noiseAt(mq, 3600.0).x) * 0.6 + smoothstep(0.55, 0.85, noiseAt(mq + 900.0, 1300.0).y) * 0.4;
  vec2 v = s - 0.5;
  float vig = smoothstep(0.25, 0.75, length(v * vec2(1.0, 0.8)));
  col *= exp(-vec3(0.08, 0.16, 0.32) * (st * 0.9 + vig * 0.8) * uStain);

  // sea wash, stopping a little shy of the coast like a hand-laid wash
  float landSoft = textureLod(uLand, m, 1.0).r;
  float landWide = textureLod(uLand, m, 4.0).r;
  float n = noiseAt(mq, 140.0).x;
  float sea = 1.0 - smoothstep(0.04, 0.22, landSoft + (n - 0.5) * 0.12);
  float D = 1.0 - texture(uSea, m).r;
  // pigment pools along the coast (water-lining)
  float pool = smoothstep(0.02, 0.4, landWide) * 0.3 * (0.5 + noiseAt(mq, 700.0).y);
  float dens = (D * 1.8 + pool) * sea * granulate(q, 0.6);
  col *= exp(-uSeaOD * dens);

  float ink = texture(uInk, s).a;
  float tooth = 0.85 + 0.25 * paperAt(q).r;
  col *= exp(-uInkOD * ink * tooth);
  outColor = vec4(col, 1.0);
}
`;

// Compass rose, drawn with Rough.js around the origin.
export const drawCompass = (rc: RoughCanvas, r: number, seed: number, ink: string) => {
  const o = { stroke: ink, strokeWidth: 3.2, roughness: 1.1, bowing: 0.8, seed };
  rc.circle(0, 0, r * 1.55, { ...o, strokeWidth: 2.4 });
  rc.circle(0, 0, r * 1.38, { ...o, strokeWidth: 1.6, seed: seed + 1 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const L = i % 2 === 0 ? r : r * 0.55;
    const w = i % 2 === 0 ? r * 0.16 : r * 0.11;
    const tip: [number, number] = [Math.cos(a) * L, Math.sin(a) * L];
    const l: [number, number] = [Math.cos(a - Math.PI / 2) * w, Math.sin(a - Math.PI / 2) * w];
    const rr: [number, number] = [Math.cos(a + Math.PI / 2) * w, Math.sin(a + Math.PI / 2) * w];
    // one half hatched, one half open, like an engraved rose
    rc.polygon([[0, 0], l, tip], { ...o, seed: seed + 3 + i, fill: ink, fillStyle: "hachure", hachureGap: 7, fillWeight: 1.6, hachureAngle: (a * 180) / Math.PI + 30 });
    rc.polygon([[0, 0], tip, rr], { ...o, seed: seed + 13 + i });
  }
  // "N"
  const y = -r * 1.08;
  rc.linearPath(
    [
      [-r * 0.09, y],
      [-r * 0.09, y - r * 0.24],
      [r * 0.09, y],
      [r * 0.09, y - r * 0.24],
    ],
    { ...o, strokeWidth: 3.6, seed: seed + 40 },
  );
};

export type HatchedMapProps = { loopCheck?: boolean; colourway: MapColourway; still?: boolean };

export const HatchedMap: React.FC<HatchedMapProps> = ({ colourway, still = false }) => {
  const getOverlay = useOverlay();
  const worldRef = useRef<World | null>(null);
  const landUploaded = useRef(false);
  const cache = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);
  const prepare = useCallback(async () => {
    worldRef.current = await loadWorld();
  }, []);
  const od = useMemo(() => ({ ink: hexToOD(colourway.ink), sea: hexToOD(colourway.sea) }), [colourway]);

  // map line art for one boil seed, in map space at device scale
  const drawMap = useCallback((seed: number, k: number) => {
    const key = `${seed}:${k}`;
    if (cache.current?.key === key) return cache.current.canvas;
    const world = worldRef.current!;
    const c = cache.current?.canvas ?? document.createElement("canvas");
    c.width = Math.ceil(MAP_W * k);
    c.height = Math.ceil(MAP_H * k);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, MAP_W, MAP_H);
    const rc = roughOn(c);
    ctx.globalAlpha = 0.22;
    world.graticule.forEach((l, i) => rc.linearPath(l, { stroke: "#000", strokeWidth: 2, roughness: 1.6, bowing: 5, seed: seed + 500 + i, disableMultiStroke: false }));
    ctx.globalAlpha = 0.62;
    for (let i = 0; i < world.hatch.length; i++) {
      const [x1, y1, x2, y2] = world.hatch[i];
      ctx.globalAlpha = 0.3 + 0.3 * (((i * 2654435761) >>> 0) % 100) / 100;
      rc.line(x1, y1, x2, y2, { stroke: "#000", strokeWidth: 1.4 + (i % 5) * 0.2, roughness: 1.0, bowing: 1.6, seed: seed + i * 3, disableMultiStroke: true });
    }
    // faint second pass of the coast, slightly off register
    ctx.globalAlpha = 0.3;
    ctx.translate(2.2, 1.6);
    world.rings.forEach((r, i) => rc.linearPath([...r, r[0]], { stroke: "#000", strokeWidth: 2.2, roughness: 1.3, bowing: 0.6, seed: seed + 7 + i, disableMultiStroke: true }));
    ctx.translate(-2.2, -1.6);
    ctx.globalAlpha = 1;
    world.rings.forEach((r, i) => rc.linearPath([...r, r[0]], { stroke: "#000", strokeWidth: 3.3, roughness: 0.8, bowing: 0.4, seed: seed + i, disableMultiStroke: true }));
    cache.current = { key, canvas: c };
    return c;
  }, []);

  const onFrame = useCallback(
    ({ comp, frame, scale, width, height }: FrameContext) => {
      const W = 3840;
      const H = 2160;
      const k = (comp.comp[0] / W) * scale;
      const t = onTwos(frame % 600);
      const amp = (MAP_W - W) / 2 - 24;
      const x0 = (W - MAP_W) / 2 + amp * Math.cos((Math.PI * 2 * t) / 600);
      const y0 = (H - MAP_H) / 2;
      const seed = boilSeed(9001, still ? 0 : frame, 600);
      const map = drawMap(seed, k);
      const ov = getOverlay(width, height);
      const ctx = ov.getContext("2d")!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(map, Math.round(x0 * k), Math.round(y0 * k));
      ctx.setTransform(k, 0, 0, k, 330 * k, 1800 * k);
      drawCompass(roughOn(ov), 190, seed * 7 + 3, "#000");
      comp.setCanvas("uInk", ov);
      if (!landUploaded.current) {
        comp.setCanvas("uLand", worldRef.current!.landMask, { mipmap: true });
        landUploaded.current = true;
      }
      comp.render(frame, 600, {
        uMapRect: [Math.round(x0 * k) / k, y0, MAP_W, MAP_H],
        uInkOD: od.ink,
        uSeaOD: od.sea,
        uStain: colourway.stain,
        uPaperColor: hexToLinear(colourway.paper),
      });
    },
    [drawMap, getOverlay, od, colourway, still],
  );

  return <Stage sceneSrc={SCENE} images={{ uSea: "layers/sea_wash.png" }} prepare={prepare} onFrame={onFrame} />;
};
