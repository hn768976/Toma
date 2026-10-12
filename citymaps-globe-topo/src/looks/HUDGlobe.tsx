// Look 5 — HUD Globe. A particle Earth turning exactly 360° in 600 frames,
// with a teal rim, a periodic sheet of gold specks, projected target markers,
// and a 2D HUD around it.

import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { fsMaterial, fullscreenMesh, vec3Of } from "../gl/fullscreen";
import { buildPointsGeometry, buildRibbonGeometry, dofUniforms, hexRGB, pointsMaterial, ribbonMaterial, RibbonLine } from "../gl/materials";
import { PostFX } from "../gl/post";
import { Stage, StageFactory } from "../gl/Stage";
import { BarChart, CodeLines, HudTheme, Rect, SegStrip, Svg, Txt, counterValue, pad, tick } from "../hud/widgets";
import { LOOP, loopFrame, phase, smoothstep, TAU } from "../lib/loop";
import { mulberry32 } from "../lib/random";
import { coastlines, isLand } from "../world/world";
import { GlobePalette } from "../versions";

export interface HUDGlobeProps {
  seed: number;
  palette: GlobePalette;
}

const FOV = 20;
const GX = 0.42; // globe centre, fraction of width
const GY = 0.52; // fraction of height
const R_FRAC = 0.3; // radius, fraction of frame height
const TAN = Math.tan((FOV / 2) * (Math.PI / 180));
const DIST = 1 / (2 * R_FRAC * TAN); // camera distance so radius 1 -> 30% height
const AXIS_TILT = 0.38;

// Everything about the globe's pose comes from here (shared by GL + HUD).
export const globePose = (f: number, aspect: number) => {
  const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 100);
  cam.position.set(0, 0, DIST);
  cam.updateMatrixWorld(true);
  const centre = new THREE.Vector3((GX - 0.5) * 2 * TAN * DIST * aspect, -(GY - 0.5) * 2 * TAN * DIST, 0);
  const tilt = new THREE.Object3D();
  tilt.position.copy(centre);
  tilt.rotation.set(0.32, 0, AXIS_TILT);
  const spin = new THREE.Object3D();
  spin.rotation.y = phase(f, 1) - 1.2;
  tilt.add(spin);
  tilt.updateMatrixWorld(true);
  return { cam, centre, tilt, spin, matrix: spin.matrixWorld.clone() };
};

export const latLonToVec = (lat: number, lon: number, r = 1) => {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
};

const OCEAN_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
in vec3 position;
in vec3 normal;
out vec3 vN;
out vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const OCEAN_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uOcean;
uniform vec3 uRim;
in vec3 vN;
in vec3 vV;
out vec4 fragColor;
void main() {
  float nv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
    float rim2 = pow(1.0 - nv, 14.0);
  vec3 col = uOcean + uRim * (0.05 + pow(1.0 - nv, 3.0) * 0.32 + rim2 * 0.35);
  // faint inner sheen toward the upper left
  col += uRim * 0.05 * smoothstep(0.2, 1.0, dot(normalize(vN), normalize(vec3(-0.5, 0.6, 0.6))));
  fragColor = vec4(col, 0.0);
}`;

const BG_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform vec3 uBg;
uniform vec3 uRim;
uniform vec2 uRes;
uniform vec2 uC;      // globe centre in buffer px (bottom-left origin)
uniform float uR;     // globe radius in px
uniform float uPanelX; // sliding panel left edge, fraction of width
float grid(vec2 px, float cell, float w) {
  vec2 g = abs(fract(px / cell + 0.5) - 0.5) * cell;
  float d = min(g.x, g.y);
  return 1.0 - smoothstep(w * 0.5 - 0.5, w * 0.5 + 0.5, d);
}
void main() {
  vec2 px = gl_FragCoord.xy;
  vec3 col = uBg;
  float lw = max(1.5, uRes.y / 720.0 * 1.2);
  col += vec3(0.6, 0.75, 0.72) * grid(px, uRes.x / 64.0, lw) * 0.085;
  col += vec3(0.6, 0.75, 0.72) * 0.03 * exp(-length(px - uC) / (uR * 2.2));
  // big translucent grey panel sliding behind the globe
  vec2 uv = vUv;
  float inX = smoothstep(uPanelX, uPanelX + 0.002, uv.x) * (1.0 - smoothstep(uPanelX + 0.36, uPanelX + 0.362, uv.x));
  float inY = smoothstep(0.24, 0.242, uv.y) * (1.0 - smoothstep(0.62, 0.622, uv.y));
  col += vec3(0.75, 0.8, 0.8) * inX * inY * 0.075;
  // atmosphere glow outside the globe
  float r = length(px - uC);
  float out1 = max(r - uR, 0.0) / uR;
  col += uRim * exp(-out1 / 0.05) * 0.16 * step(uR * 0.985, r);
  col += uRim * exp(-out1 / 0.14) * 0.08;
  fragColor = vec4(col, 1.0);
}`;

const makeFactory =
  (props: HUDGlobeProps): StageFactory =>
  ({ renderer, width, height }) => {
    const pal = props.palette;
    const k = height / 720;
    const rng = mulberry32(props.seed * 131 + 7);
    const aspect = width / height;
    const scene = new THREE.Scene();
    const tilt = new THREE.Group();
    const spin = new THREE.Group();
    tilt.add(spin);
    scene.add(tilt);
    const dof = dofUniforms(DIST - 0.8, 9 * k, 6 * k);
    const speckDof = dofUniforms(DIST - 0.8, 9 * k, 7 * k);

    // ocean sphere (writes depth, hides the far side)
    const ocean = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 96),
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: OCEAN_VERT,
        fragmentShader: OCEAN_FRAG,
        uniforms: { uOcean: { value: vec3Of(pal.ocean) }, uRim: { value: vec3Of(pal.rim) } },
      }),
    );
    spin.add(ocean);

    // land points: Fibonacci sphere masked by Natural Earth land
    const N = 230000;
    const lp: number[] = [];
    const lc: number[] = [];
    const ls: number[] = [];
    const land = hexRGB(pal.land);
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N;
      const r = Math.sqrt(1 - y * y);
      const th = ga * i;
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      const lat = (Math.asin(y) * 180) / Math.PI;
      const lon = (Math.atan2(x, z) * 180) / Math.PI;
      if (!isLand(lon, lat)) {
        // sparse faint specks over the oceans
        if (rng() < 0.05) {
          const ro = 1.003 + rng() * 0.03;
          lp.push(x * ro, y * ro, z * ro);
          lc.push(land[0], land[1], land[2], 0.35 + 0.4 * rng());
          ls.push(0.9 + 0.5 * rng());
        }
        continue;
      }
      const rr = 1.003 + rng() * rng() * 0.03;
      lp.push(x * rr, y * rr, z * rr);
      const b = rng() < 0.02 ? 2.2 : 0.6 + 1.0 * rng() * rng() + 0.3 * rng();
      lc.push(land[0], land[1], land[2], b);
      ls.push(b > 1.7 ? 1.9 : 1.0 + 0.4 * rng());
    }
    const landPts = new THREE.Points(
      buildPointsGeometry(new Float32Array(lp), new Float32Array(lc), new Float32Array(ls)),
      pointsMaterial({ basePx: k, dof, hard: 0.6 }),
    );
    landPts.frustumCulled = false;
    spin.add(landPts);

    // coastlines
    const coastLines: RibbonLine[] = [];
    for (const ring of coastlines()) {
      let cur: number[] = [];
      const flush = () => {
        if (cur.length >= 6) coastLines.push({ pts: cur, color: land, alpha: 0.6, width: 1.0 });
        cur = [];
      };
      for (let i = 0; i < ring.length; i += 2) {
        const lon = ring[i];
        const lat = ring[i + 1];
        if (lat < -84 || (i > 0 && Math.abs(lon - ring[i - 2]) > 180)) {
          flush();
          if (lat < -84) continue;
        }
        const v = latLonToVec(lat, lon, 1.006);
        cur.push(v.x, v.y, v.z);
      }
      flush();
    }
    const coasts = new THREE.Mesh(buildRibbonGeometry(coastLines), ribbonMaterial({ basePx: k, resolution: [width, height], dof }));
    coasts.frustumCulled = false;
    spin.add(coasts);

    // gold specks: a swirling sheet, periodic in 600 frames
    const NS = 3600;
    const sp = new Float32Array(NS * 3);
    const sc = new Float32Array(NS * 4);
    const ss = new Float32Array(NS);
    const spar = new Float32Array(NS * 2);
    const gold = hexRGB(pal.specks);
    for (let i = 0; i < NS; i++) {
      // position attribute stores (u0, v, jitter); motion is in the shader
      sp[i * 3] = rng();
      sp[i * 3 + 1] = rng() * 2 - 1;
      sp[i * 3 + 2] = rng();
      sc.set([gold[0], gold[1], gold[2], 0.7 + 0.9 * rng()], i * 4);
      ss[i] = 0.8 + 0.9 * rng();
      spar[i * 2] = rng() < 0.7 ? 1 : 2; // whole cycles per loop
      spar[i * 2 + 1] = rng();
    }
    const uSpeckPhase = { value: 0 };
    const uSheetRot = { value: 0 };
    const specks = new THREE.Points(
      buildPointsGeometry(sp, sc, ss, spar),
      pointsMaterial({
        basePx: k,
        dof: speckDof,
        hard: 0.3,
        uniforms: { uSpeckPhase, uSheetRot },
        vertMod: `
          float p = fract(position.x + param.x * uSpeckPhase);
          float v = position.y;
          float j = position.z;
          // a sheet that peels off the upper-right limb, streams outward
          // and swirls round behind the globe
          float a = p * 3.5 + v * 0.15 + uSheetRot;
          float rad = 1.04 + 0.55 * pow(p, 0.8) + 0.25 * (j - 0.5) * p;
          float h = v * (0.08 + 0.8 * p) + 0.3 * sin(p * 4.0 + v * 2.5) * p;
          vec3 e1 = normalize(vec3(0.75, 0.62, 0.2));
          vec3 e2 = normalize(vec3(-0.35, 0.643, -0.681));
          vec3 e3 = normalize(cross(e1, e2));
          pos = (cos(a) * e1 + sin(a) * e2) * rad + e3 * h;
          amod = pow(1.0 - p, 0.5) * smoothstep(0.0, 0.06, p) * (0.6 + 0.4 * (1.0 - abs(v)));
        `,
      }),
    );
    specks.frustumCulled = false;
    const speckGroup = new THREE.Group();
    speckGroup.add(specks);
    scene.add(speckGroup);

    // sparkle dust around the globe (orbits with the spin, loops exactly)
    const ND = 3200;
    const dp = new Float32Array(ND * 3);
    const dcol = new Float32Array(ND * 4);
    const dsz = new Float32Array(ND);
    for (let i = 0; i < ND; i++) {
      const u = rng() * 2 - 1;
      const th = rng() * Math.PI * 2;
      const rr = 1.02 + 0.55 * Math.pow(rng(), 2.0);
      const q = Math.sqrt(1 - u * u);
      dp.set([Math.cos(th) * q * rr, u * rr, Math.sin(th) * q * rr], i * 3);
      const white = rng() < 0.6;
      dcol.set(white ? [0.9, 1, 0.97, 0.9 + rng()] : [land[0], land[1], land[2], 0.6 + 0.8 * rng()], i * 4);
      dsz[i] = 0.9 + (rng() < 0.05 ? 2.5 : 1.0) * rng();
    }
    const dust = new THREE.Points(buildPointsGeometry(dp, dcol, dsz), pointsMaterial({ basePx: k, dof: speckDof, hard: 0.5 }));
    dust.frustumCulled = false;
    spin.add(dust);

    // background (grid, sliding panel, atmosphere glow)
    const pose0 = globePose(0, aspect);
    const cproj = pose0.centre.clone().project(pose0.cam);
    const edge = pose0.centre.clone().add(new THREE.Vector3(0, 1, 0)).project(pose0.cam);
    const cPx = new THREE.Vector2((cproj.x * 0.5 + 0.5) * width, (cproj.y * 0.5 + 0.5) * height);
    const rPx = Math.abs(edge.y - cproj.y) * 0.5 * height * 1.01;
    const bgMat = fsMaterial(BG_FRAG, {
      uBg: { value: vec3Of(pal.background) },
      uRim: { value: vec3Of(pal.rim) },
      uRes: { value: new THREE.Vector2(width, height) },
      uC: { value: cPx },
      uR: { value: rPx },
      uPanelX: { value: 0.3 },
    });
    const bgScene = new THREE.Scene();
    bgScene.add(fullscreenMesh(bgMat));
    const ocam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const post = new PostFX(width, height, { bloom: { strength: 0.4, threshold: 0.5, knee: 0.35, radius: 1 }, vignette: 0.35, grain: 0.015 });
    return {
      render(r, f) {
        const pose = globePose(f, aspect);
        tilt.position.copy(pose.tilt.position);
        tilt.rotation.copy(pose.tilt.rotation);
        spin.rotation.copy(pose.spin.rotation);
        scene.updateMatrixWorld(true);
        uSpeckPhase.value = f / LOOP;
        speckGroup.position.copy(pose.centre);
        uSheetRot.value = 0.35 * Math.sin(phase(f, 1));
        speckGroup.updateMatrixWorld(true);
        // panel slides in and out once per loop
        bgMat.uniforms.uPanelX.value = 0.22 + 0.2 * (0.5 - 0.5 * Math.cos(phase(f, 1)));
        post.render(r, f, (rr) => {
          rr.render(bgScene, ocam);
          rr.render(scene, pose.cam);
        });
      },
      dispose() {
        post.dispose();
      },
    };
  };

// Target markers pinned to globe coordinates (lat, lon), shape, label seed.
const MARKERS: { lat: number; lon: number; shape: "pentagon" | "ring"; window: [number, number] }[] = [
  { lat: 38, lon: -40, shape: "pentagon", window: [0, 1] },
  { lat: 22, lon: 70, shape: "ring", window: [0, 1] },
  { lat: -18, lon: 135, shape: "pentagon", window: [0, 1] },
];

const Overlay: React.FC<{ p: GlobePalette }> = ({ p }) => {
  const f = loopFrame(useCurrentFrame());
  const theme: HudTheme = { text: p.text, dim: p.dim, accent: p.bars, line: p.text };
  const pose = globePose(f, 3840 / 2160);
  const markers = MARKERS.map((m, i) => {
    const local = latLonToVec(m.lat, m.lon, 1.01);
    const world = local.clone().applyMatrix4(pose.matrix);
    const normal = world.clone().sub(pose.centre).normalize();
    const toCam = pose.cam.position.clone().sub(world).normalize();
    const facing = normal.dot(toCam);
    const s = world.clone().project(pose.cam);
    const x = (s.x * 0.5 + 0.5) * 3840;
    const y = (-s.y * 0.5 + 0.5) * 2160;
    const a = smoothstep(0.25, 0.5, facing);
    return { ...m, x, y, a, i };
  });
  const big = counterValue(f, 501, 20, 10, 99);
  return (
    <AbsoluteFill>
      <Svg>
        {markers.map((m) => {
          if (m.a <= 0.001) return null;
          const s = 34 * (0.85 + 0.15 * m.a);
          const pent = Array.from({ length: 5 }, (_, j) => {
            const an = -Math.PI / 2 + (j * TAU) / 5;
            return `${m.x + Math.cos(an) * s},${m.y + Math.sin(an) * s}`;
          }).join(" ");
          const lx = m.i === 1 ? 2900 : 2700;
          const ly = m.y + (m.i === 0 ? -60 : 50);
          return (
            <g key={m.i} opacity={m.a}>
              {m.shape === "pentagon" ? (
                <polygon points={pent} fill="none" stroke={p.text} strokeWidth={4} />
              ) : (
                <circle cx={m.x} cy={m.y} r={s} fill="none" stroke={p.text} strokeWidth={4} />
              )}
              <polyline points={`${m.x + s},${m.y} ${m.x + s + 60},${ly} ${lx},${ly}`} fill="none" stroke={p.text} strokeWidth={2.5} />
              <circle cx={m.x} cy={m.y} r={5} fill={p.text} />
            </g>
          );
        })}
        {/* right column frame lines */}
        <line x1={3120} y1={60} x2={3120} y2={820} stroke={p.dim} strokeWidth={2} opacity={0.5} />
      </Svg>
      {markers.map((m) =>
        m.a > 0.001 ? (
          <div key={m.i} style={{ opacity: m.a }}>
            <Txt x={(m.i === 1 ? 2900 : 2700) + 16} y={m.y + (m.i === 0 ? -60 : 50) - 14} size={22} color={p.text}>{`${pad(counterValue(f, 510 + m.i, 15, 0, 99999999), 8)}${pad(counterValue(f, 520 + m.i, 15, 0, 9999), 4)}`}</Txt>
            <Txt x={(m.i === 1 ? 2900 : 2700) + 16} y={m.y + (m.i === 0 ? -60 : 50) + 18} size={18} color={p.dim}>{`TARGET ${m.i + 1}  //  ${m.shape === "ring" ? "SCAN" : "SECTOR"}`}</Txt>
          </div>
        ) : null,
      )}

      {/* left data columns */}
      <CodeLines f={f} x={40} y={40} rows={7} seed={530} size={19} theme={theme} cols={[2, 4, 10]} colGap={1.6} />
      <CodeLines f={f} x={600} y={40} rows={5} seed={531} size={19} theme={theme} cols={[6, 6]} />
      {[0, 1, 2].map((i) => (
        <React.Fragment key={i}>
          <Txt x={40} y={820 + i * 270} size={22} color={p.text} weight={500}>POWER OUTPUT</Txt>
          <Rect x={40} y={856 + i * 270} w={900} h={2} fill={p.dim} />
          <CodeLines f={f} x={40} y={880 + i * 270} rows={3} seed={540 + i} size={17} theme={theme} cols={[2, 6, 6, 6]} colGap={2} />
        </React.Fragment>
      ))}
      {/* bottom bar strip */}
      <Rect x={40} y={1660} w={1300} h={30} fill={p.dim} opacity={0.35} />
      <Rect x={200} y={1666} w={1300 * 0.35 + 400 * tick(f, 550, 30)} h={18} fill={p.bars} opacity={0.8} />
      {[0, 1, 2].map((i) => (
        <React.Fragment key={i}>
          <Txt x={40} y={1790 + i * 50} size={22} color={p.text}>{["◉", "◎", "◉"][i]}</Txt>
          <SegStrip f={f} x={90} y={1795 + i * 50} w={1250} h={14} seed={560 + i * 10} color={p.text} dim={p.dim} n={70} hold={[6, 10, 15][i]} />
        </React.Fragment>
      ))}
      <Txt x={300} y={1740} size={17} color={p.dim}>{`● ENCODING DATA FEED  ${pad(counterValue(f, 570, 12, 0, 9999), 4)}`}</Txt>
      {/* big counter */}
      <Rect x={1470} y={1860} w={4} h={240} fill={p.text} opacity={0.7} />
      <Txt x={1500} y={1885} size={190} color={p.text} weight={400} spacing={-0.02}>{pad(big, 2)}</Txt>

      {/* extra data blocks */}
      <CodeLines f={f} x={1150} y={40} rows={6} seed={590} size={17} theme={theme} cols={[8, 8, 4]} />
      <CodeLines f={f} x={40} y={360} rows={8} seed={591} size={16} theme={theme} cols={[3, 12, 6]} />
      <Rect x={600} y={330} w={420} h={300} fill="rgba(160,190,185,0.06)" stroke={p.dim} sw={2} />
      <CodeLines f={f} x={620} y={350} rows={9} seed={592} size={16} theme={theme} cols={[18]} />
      <CodeLines f={f} x={3170} y={1300} rows={9} seed={593} size={16} theme={theme} cols={[8, 10]} />
      <Rect x={3150} y={1260} w={650} h={330} fill="rgba(160,190,185,0.05)" stroke={p.dim} sw={2} />
      <CodeLines f={f} x={2100} y={1700} rows={4} seed={594} size={16} theme={theme} cols={[14, 6]} />
      {/* text near the globe */}
      <CodeLines f={f} x={2060} y={300} rows={6} seed={580} size={17} theme={theme} cols={[22]} />
      <CodeLines f={f} x={2560} y={1150} rows={6} seed={581} size={17} theme={theme} cols={[24]} />

      {/* right column of green bars */}
      {[0, 1].map((c) =>
        Array.from({ length: 12 }, (_, i) => {
          const v = 0.35 + 0.65 * tick(f, 600 + c * 50 + i, [15, 20, 30][(i + c) % 3]);
          return (
            <React.Fragment key={`${c}-${i}`}>
              <Rect x={3164 + c * 330} y={34 + i * 60} w={302} h={50} stroke={p.dim} sw={2} opacity={0.6} />
              <Rect x={3170 + c * 330} y={40 + i * 60} w={290 * v} h={38} fill={p.bars} opacity={0.9} r={8} />
            </React.Fragment>
          );
        }),
      )}
      <CodeLines f={f} x={3170} y={800} rows={4} seed={620} size={17} theme={theme} cols={[10, 10]} />
      <BarChart f={f} x={3600} y={1000} w={200} h={140} n={10} seed={630} color={p.dim} hold={12} />
      <CodeLines f={f} x={2660} y={1820} rows={3} seed={640} size={17} theme={theme} cols={[16]} />
      <SegStrip f={f} x={2660} y={1960} w={700} h={44} seed={650} color={p.text} dim={p.dim} n={64} hold={10} />
      <SegStrip f={f} x={2100} y={1960} w={480} h={28} seed={660} color={p.text} dim={p.dim} n={40} hold={20} />
      <BarChart f={f} x={3450} y={1880} w={260} h={70} n={14} seed={670} color={p.text} hold={10} />
    </AbsoluteFill>
  );
};

export const HUDGlobe: React.FC<HUDGlobeProps> = (props) => {
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
