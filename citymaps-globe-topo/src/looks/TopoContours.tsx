// Look 6 — Topo Contours (3D). Glowing contour lines floating at their own
// heights; every 5th is a bold index contour. Slow closed orbit and push,
// ±3% height breathing, depth of field focused on the central peak.

import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { fsMaterial, fullscreenMesh, vec3Of } from "../gl/fullscreen";
import { buildPointsGeometry, buildRibbonGeometry, dofUniforms, hexRGB, pointsMaterial, ribbonMaterial, RibbonLine } from "../gl/materials";
import { PostFX } from "../gl/post";
import { Stage, StageFactory } from "../gl/Stage";
import { CodeLines, HudTheme, Svg, Txt, counterValue, pad } from "../hud/widgets";
import { LOOP, loopFrame, phase } from "../lib/loop";
import { buildTerrain, Terrain } from "../topo/terrain";
import { TopoPalette } from "../versions";

export interface TopoContoursProps {
  seed: number;
  palette: TopoPalette;
}

const HSCALE = 0.13; // world height of the terrain's top
const ELEV = (50 * Math.PI) / 180;
const DIST = 0.68;

const terrains = new Map<number, Terrain>();
const getTerrain = (seed: number) => {
  let t = terrains.get(seed);
  if (!t) {
    t = buildTerrain(seed);
    terrains.set(seed, t);
  }
  return t;
};

const BG_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform vec3 uBg;
uniform vec2 uRes;
void main() {
  vec2 q = vUv - vec2(0.5, 0.62);
  q.x *= uRes.x / uRes.y;
  vec3 col = uBg * (1.25 - 0.55 * smoothstep(0.1, 1.0, length(q)));
  // faint fine grid
  float cell = uRes.y / 54.0;
  vec2 g = abs(fract(gl_FragCoord.xy / cell + 0.5) - 0.5) * cell;
  float lw = max(1.5, uRes.y / 720.0 * 1.2);
  float d = min(g.x, g.y);
  col += uBg * 0.35 * (1.0 - smoothstep(lw * 0.5 - 0.5, lw * 0.5 + 0.5, d));
  fragColor = vec4(col, 1.0);
}`;

const makeFactory =
  (props: TopoContoursProps): StageFactory =>
  ({ renderer, width, height }) => {
    const pal = props.palette;
    const terrain = getTerrain(props.seed);
    const k = height / 720;
    const dof = dofUniforms(DIST, 26 * k, 16 * k);
    dof.uFogNear.value = DIST * 1.05;
    dof.uFogFar.value = DIST * 1.9;
    dof.uFogMin.value = 0.5;

    const root = new THREE.Group();
    const scene = new THREE.Scene();
    scene.add(root);

    const lc = hexRGB(pal.lines);
    const ic = hexRGB(pal.index);
    const lines: RibbonLine[] = terrain.contours.map((c) => {
      const isIndex = c.level % 5 === 4;
      const pts: number[] = [];
      for (let i = 0; i < c.pts.length; i += 2) pts.push(c.pts[i], c.height * HSCALE, c.pts[i + 1]);
      // higher lines slightly brighter
      const lift = 0.75 + 0.35 * c.height;
      return {
        pts,
        closed: c.closed,
        color: isIndex ? ic : lc,
        alpha: isIndex ? 1.0 : 0.62 * lift * 1.25,
        width: isIndex ? 1.7 : 1.05,
      };
    });
    const contourMat = ribbonMaterial({ basePx: 1.5 * k, resolution: [width, height], dof, softness: 0.55 });
    // MAX blending: lines stacked edge-on on far slopes don't sum to white
    contourMat.blendEquation = THREE.MaxEquation;
    const contourMesh = new THREE.Mesh(buildRibbonGeometry(lines), contourMat);
    contourMesh.frustumCulled = false;
    root.add(contourMesh);

    // summit dots + a sprinkle of small markers on lines
    const sp: number[] = [];
    const scol: number[] = [];
    const ssz: number[] = [];
    const sc = hexRGB(pal.summit);
    terrain.summits.forEach((s) => {
      sp.push(s.x, s.h * HSCALE + 0.004, s.z);
      scol.push(sc[0], sc[1], sc[2], 1.4);
      ssz.push(4.2);
    });
    terrain.contours.forEach((c, i) => {
      if (i % 7 !== 3 || c.pts.length < 40) return;
      const m = Math.floor(c.pts.length / 4) * 2;
      sp.push(c.pts[m], c.height * HSCALE, c.pts[m + 1]);
      scol.push(sc[0], sc[1], sc[2], 1.1);
      ssz.push(3.0);
    });
    const dots = new THREE.Points(
      buildPointsGeometry(new Float32Array(sp), new Float32Array(scol), new Float32Array(ssz)),
      pointsMaterial({ basePx: k, dof, hard: 0.7 }),
    );
    dots.frustumCulled = false;
    root.add(dots);

    const bgMat = fsMaterial(BG_FRAG, { uBg: { value: vec3Of(pal.background) }, uRes: { value: new THREE.Vector2(width, height) } });
    const bgScene = new THREE.Scene();
    bgScene.add(fullscreenMesh(bgMat));
    const ocam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const cam = new THREE.PerspectiveCamera(42, width / height, 0.01, 20);
    const post = new PostFX(width, height, { bloom: { strength: 0.5, threshold: 0.35, knee: 0.3, radius: 1 }, vignette: 0.5, grain: 0.015 });
    const focusPeak = new THREE.Vector3(0, 0.75 * HSCALE, -0.05);
    return {
      render(r, f) {
        const ph = phase(f, 1);
        // closed orbit ±10° and a gentle push
        const az = ((10 * Math.PI) / 180) * Math.sin(ph);
        const el = ELEV + ((3 * Math.PI) / 180) * Math.sin(ph * 2 + 0.7);
        const d = DIST * (1 - 0.05 * (0.5 - 0.5 * Math.cos(ph)));
        const target = new THREE.Vector3(0.02 * Math.sin(ph + 0.5), 0.05, 0.02);
        cam.position.set(target.x + d * Math.cos(el) * Math.sin(az), target.y + d * Math.sin(el), target.z + d * Math.cos(el) * Math.cos(az));
        cam.lookAt(target);
        cam.updateMatrixWorld(true);
        // breathing heights, whole cycles
        root.scale.y = 1 + 0.03 * Math.sin(phase(f, 2));
        root.updateMatrixWorld(true);
        const fp = focusPeak.clone().applyMatrix4(root.matrixWorld).applyMatrix4(cam.matrixWorldInverse);
        dof.uFocus.value = -fp.z;
        post.render(r, f, (rr) => {
          rr.render(bgScene, ocam);
          rr.render(scene, cam);
        });
      },
      dispose() {
        post.dispose();
      },
    };
  };

const Overlay: React.FC<{ p: TopoPalette }> = ({ p }) => {
  const f = loopFrame(useCurrentFrame());
  const theme: HudTheme = { text: p.hud, dim: p.hud, accent: p.index, line: p.hud };
  const cross = (x: number, y: number, s = 30) => (
    <g key={`${x}-${y}`}>
      <line x1={x - s} y1={y} x2={x + s} y2={y} stroke={p.hud} strokeWidth={3} />
      <line x1={x} y1={y - s} x2={x} y2={y + s} stroke={p.hud} strokeWidth={3} />
    </g>
  );
  const scanY = 1100 + 0 * f;
  const scanX = 300 + ((f / LOOP) * 2 % 1) * 3240;
  return (
    <AbsoluteFill>
      <Svg>
        <g opacity={0.8}>
          {[
            [460, 300],
            [3380, 300],
            [460, 1860],
            [3380, 1860],
            [1920, 1860],
          ].map(([x, y]) => cross(x, y))}
        </g>
        {/* vertical scale on the right */}
        <line x1={3480} y1={420} x2={3480} y2={980} stroke={p.hud} strokeWidth={2.5} opacity={0.7} />
        {Array.from({ length: 29 }, (_, i) => (
          <line key={i} x1={3480} y1={420 + i * 20} x2={3480 - (i % 5 === 0 ? 34 : 16)} y2={420 + i * 20} stroke={p.hud} strokeWidth={2.5} opacity={0.7} />
        ))}
        <polygon points={`3496,${560 + 120 * Math.sin((f / LOOP) * 6.283)} 3514,${550 + 120 * Math.sin((f / LOOP) * 6.283)} 3514,${570 + 120 * Math.sin((f / LOOP) * 6.283)}`} fill={p.index} />
        {/* horizontal scan line with ticks, a marker moving across */}
        <line x1={260} y1={scanY} x2={3580} y2={scanY} stroke={p.hud} strokeWidth={2} opacity={0.45} />
        {Array.from({ length: 34 }, (_, i) => (
          <line key={i} x1={260 + i * 100} y1={scanY - 8} x2={260 + i * 100} y2={scanY + 8} stroke={p.hud} strokeWidth={2} opacity={0.45} />
        ))}
        <rect x={scanX - 3} y={scanY - 40} width={6} height={80} fill={p.hud} opacity={0.85} />
        <circle cx={2760} cy={1046} r={7} fill={p.index} />
        {/* small square glyphs */}
        {[0, 1].map((i) => (
          <rect key={i} x={250} y={470 + i * 1040} width={26} height={26} fill="none" stroke={p.hud} strokeWidth={2.5} opacity={0.7} />
        ))}
        {[0, 1, 2].map((i) => (
          <rect key={i} x={1920 + i * 46} y={2030} width={26} height={26} fill="none" stroke={p.hud} strokeWidth={2.5} opacity={0.7} />
        ))}
      </Svg>
      <CodeLines f={f} x={600} y={420} rows={14} seed={701} size={17} theme={theme} cols={[8]} holds={[20, 30, 60]} />
      <Txt x={760} y={560} size={18} color={p.hud}>{"ALT 2.0145 / FPS 30 / 4K"}</Txt>
      <CodeLines f={f} x={760} y={600} rows={3} seed={702} size={16} theme={theme} cols={[14]} />
      <Txt x={3480 - 30} y={380} size={18} color={p.hud} align="right" width={300}>{`ELEV ${pad(counterValue(f, 703, 15, 1000, 4800), 4)}`}</Txt>
      <CodeLines f={f} x={3240} y={1180} rows={5} seed={704} size={17} theme={theme} cols={[10, 8]} />
      <Txt x={3240} y={1140} size={18} color={p.index}>{`SECTOR ${pad(counterValue(f, 705, 30, 1, 99), 2)} // SCAN`}</Txt>
      <CodeLines f={f} x={1240} y={1950} rows={3} seed={706} size={16} theme={theme} cols={[12]} />
      <Txt x={300} y={2060} size={18} color={p.hud} opacity={0.8}>{`CONTOUR INTERVAL 25M   INDEX 125M   GRID ${pad(counterValue(f, 707, 60, 100, 999), 3)}`}</Txt>
    </AbsoluteFill>
  );
};

export const TopoContours: React.FC<TopoContoursProps> = (props) => {
  const key = JSON.stringify(props);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const factory = useMemo(() => makeFactory(props), [key]);
  return (
    <AbsoluteFill style={{ background: props.palette.background }}>
      <Stage factory={factory} />
      <Overlay p={props.palette} />
    </AbsoluteFill>
  );
};
