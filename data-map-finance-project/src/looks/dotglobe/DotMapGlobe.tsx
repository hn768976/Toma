import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useThree } from "@react-three/fiber";
import { ThreeStage } from "../../lib/ThreeStage";
import { THREE, col } from "../../lib/three-setup";
import { makeDotGeometry, makeDotMaterial, pxPerUnit } from "../../lib/dots";
import { useLand, isLand, LandData } from "../../lib/geo";
import { useFonts } from "../../lib/fonts";
import { makeRand } from "../../lib/random";
import { TAU, wave } from "../../lib/loop";
import type { DotGlobePalette } from "../../versions";
import { CodeText } from "./CodeText";

const LOOP = 600;
const FOV = 40;
const CAM_Z = 30;

// Layout (world units; the camera sees ~38.8 x 21.8 at z = 0)
const MAP_W = 25.5;
const MAP_CX = -6.6;
const MAP_CY = 0.6;
const MAP_COLS = 160;
const LAT_TOP = 84;
const LAT_BOTTOM = -58;
const GLOBE_R = 5.4;
const GLOBE_POS: [number, number, number] = [11.5, 0.3, 0.5];
const GLOBE_TILT = 0.38; // rad, axial tilt toward the camera

// ---------- data (pure functions of the land mask) ----------

const buildMapDots = (land: LandData) => {
  const step = 360 / MAP_COLS;
  const rows = Math.round((LAT_TOP - LAT_BOTTOM) / step);
  const unit = MAP_W / MAP_COLS;
  const rand = makeRand(101);
  const off: number[] = [];
  const size: number[] = [];
  const br: number[] = [];
  for (let r = 0; r < rows; r++) {
    const lat = LAT_TOP - (r + 0.5) * step;
    for (let c = 0; c < MAP_COLS; c++) {
      const lon = -180 + (c + 0.5) * step;
      const v = rand.next();
      if (!isLand(land.mask, lon, lat)) continue;
      off.push(MAP_CX + (c - MAP_COLS / 2 + 0.5) * unit, MAP_CY + (rows / 2 - r - 0.5) * unit, 0);
      size.push(unit * 0.3);
      br.push(0.75 + 0.25 * v);
    }
  }
  return makeDotGeometry({
    offsets: new Float32Array(off),
    sizes: new Float32Array(size),
    bright: new Float32Array(br),
  });
};

const buildGlobeDots = (land: LandData) => {
  const stepDeg = 1.65;
  const rand = makeRand(202);
  const off: number[] = [];
  const size: number[] = [];
  const br: number[] = [];
  for (let lat = -90 + stepDeg / 2; lat < 90; lat += stepDeg) {
    if (lat < -60) continue; // Antarctica left out
    const ringLen = Math.cos((lat * Math.PI) / 180) * 360;
    const n = Math.max(1, Math.round(ringLen / stepDeg));
    for (let i = 0; i < n; i++) {
      const lon = -180 + ((i + 0.5) * 360) / n;
      const v = rand.next();
      if (!isLand(land.mask, lon, lat)) continue;
      const phi = (lat * Math.PI) / 180;
      const lam = (lon * Math.PI) / 180;
      // lon 0 faces +z when the globe is unrotated
      off.push(
        GLOBE_R * Math.cos(phi) * Math.sin(lam),
        GLOBE_R * Math.sin(phi),
        GLOBE_R * Math.cos(phi) * Math.cos(lam),
      );
      size.push(0.055);
      br.push(0.7 + 0.3 * v);
    }
  }
  return makeDotGeometry({
    offsets: new Float32Array(off),
    sizes: new Float32Array(size),
    bright: new Float32Array(br),
  });
};

// Particles drift on closed Lissajous paths with whole-number cycles per loop.
const PARTICLE_COUNT = 150;
const particleSeeds = (() => {
  const r = makeRand(303);
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: r.range(-25, 25),
    y: r.range(-14, 14),
    z: r.range(-12, 21),
    ax: r.range(0.4, 1.6),
    ay: r.range(0.6, 2.0),
    az: r.range(0.2, 1.0),
    cx: r.int(1, 3),
    cy: r.int(1, 3),
    cz: r.int(1, 2),
    px: r.next(),
    py: r.next(),
    pz: r.next(),
    size: 0.025 + 0.11 * Math.pow(r.next(), 2.2),
    bright: r.range(0.25, 0.85),
  }));
})();

const particlePositions = (frame: number, out: Float32Array) => {
  particleSeeds.forEach((p, i) => {
    out[i * 3] = p.x + p.ax * wave(frame, LOOP, p.cx, p.px);
    out[i * 3 + 1] = p.y + p.ay * wave(frame, LOOP, p.cy, p.py);
    out[i * 3 + 2] = p.z + p.az * wave(frame, LOOP, p.cz, p.pz);
  });
};

// ---------- shaders ----------

const BG_VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;
const BG_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform float uAspect;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 c = mix(uBottom, uTop, smoothstep(0.05, 1.0, vUv.y));
  // soft light from the top
  vec2 p = vec2((vUv.x - 0.5) * uAspect, vUv.y - 1.05);
  float l = exp(-dot(p, p) * 2.2);
  c += uTop * 1.1 * l;
  // gentle vignette
  vec2 q = vUv - 0.5;
  c *= 1.0 - 0.45 * dot(q, q) * 2.0;
  outColor = vec4(c, 1.0);
}
`;

const GRID_VERT = /* glsl */ `
out vec2 vPos;
out vec2 vUv;
void main() {
  vPos = position.xy;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const GRID_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uCell;
uniform float uOpacity;
in vec2 vPos;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 g = abs(fract(vPos / uCell - 0.5) - 0.5) * uCell;
  vec2 w = fwidth(vPos);
  vec2 line = 1.0 - smoothstep(vec2(0.0), w * 1.2, g);
  float l = max(line.x, line.y);
  float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
  outColor = vec4(uColor * l * uOpacity * (0.35 + 0.65 * edge * (0.4 + 0.6 * vUv.y)), 1.0);
}
`;

const RIM_VERT = /* glsl */ `
out vec2 vP;
uniform float uR;
void main() {
  vec4 vp = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vP = position.xy * 1.6;
  vp.xy += position.xy * uR * 1.6;
  gl_Position = projectionMatrix * vp;
}
`;
const RIM_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
in vec2 vP;
out vec4 outColor;
void main() {
  float r = length(vP);
  float rim = exp(-pow((r - 1.0) / 0.03, 2.0)) * 0.22;
  float halo = exp(-max(r - 1.0, 0.0) * 10.0) * step(1.0, r) * 0.1;
  float fill = (1.0 - smoothstep(0.75, 1.0, r)) * 0.035 + smoothstep(0.55, 1.0, r) * step(r, 1.0) * 0.08;
  outColor = vec4(uColor * (rim + halo + fill), 1.0);
}
`;

const additive = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
} as const;

// ---------- scene ----------

const Scene: React.FC<{ land: LandData; palette: DotGlobePalette }> = ({ land, palette }) => {
  const frame = useCurrentFrame();
  const { camera, gl } = useThree();
  const cam = camera as THREE.PerspectiveCamera;

  const objs = useMemo(() => {
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: BG_VERT,
        fragmentShader: BG_FRAG,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uTop: { value: col(palette.bgTop) },
          uBottom: { value: col(palette.bgBottom) },
          uAspect: { value: 16 / 9 },
        },
      }),
    );
    bg.frustumCulled = false;
    bg.renderOrder = -10;

    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 42),
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: GRID_VERT,
        fragmentShader: GRID_FRAG,
        ...additive,
        uniforms: {
          uColor: { value: col(palette.grid) },
          uCell: { value: 2.05 },
          uOpacity: { value: 0.24 },
        },
      }),
    );
    grid.position.set(0, 0, -4);
    grid.renderOrder = -5;

    const dotMat = () =>
      makeDotMaterial({ colorA: palette.dots, focus: CAM_Z, aperture: 0.016, maxBlur: 0.8 });

    const map = new THREE.Mesh(buildMapDots(land), dotMat());
    map.frustumCulled = false;

    const globeMat = makeDotMaterial({
      colorA: palette.dots,
      focus: CAM_Z,
      aperture: 0.016,
      maxBlur: 0.8,
      sphereDim: 0.2,
    });
    const globeDots = new THREE.Mesh(buildGlobeDots(land), globeMat);
    globeDots.frustumCulled = false;
    const spin = new THREE.Group();
    spin.add(globeDots);
    const tilt = new THREE.Group();
    tilt.rotation.set(GLOBE_TILT * 0.35, 0, -GLOBE_TILT * 0.5);
    tilt.add(spin);
    tilt.position.set(...GLOBE_POS);

    const rim = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: RIM_VERT,
        fragmentShader: RIM_FRAG,
        ...additive,
        uniforms: { uColor: { value: col(palette.rim) }, uR: { value: GLOBE_R } },
      }),
    );
    rim.position.set(...GLOBE_POS);
    rim.frustumCulled = false;
    rim.renderOrder = -1;

    const pOff = new Float32Array(PARTICLE_COUNT * 3);
    particlePositions(0, pOff);
    const pGeo = makeDotGeometry({
      offsets: pOff,
      sizes: new Float32Array(particleSeeds.map((p) => p.size)),
      bright: new Float32Array(particleSeeds.map((p) => p.bright)),
    });
    const particles = new THREE.Mesh(
      pGeo,
      makeDotMaterial({
        colorA: palette.particles,
        focus: CAM_Z,
        aperture: 0.03,
        maxBlur: 0.9,
        nearFade: 3,
      }),
    );
    particles.frustumCulled = false;
    particles.renderOrder = 5;

    return { bg, grid, map, spin, tilt, rim, particles, pOff, pGeo, mats: [map.material, globeMat, particles.material] };
  }, [land, palette]);

  // --- per-frame state: everything below is a function of `frame` only ---
  const t = frame / LOOP;
  cam.fov = FOV;
  cam.position.set(0.9 * Math.sin(TAU * t), 0.45 * Math.sin(TAU * t + 1.1), CAM_Z + 0.6 * Math.sin(TAU * 2 * t));
  cam.lookAt(0.35 * Math.sin(TAU * t + 0.6), 0.2 * Math.cos(TAU * t), 0);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();

  objs.spin.rotation.y = TAU * t; // exactly one turn per loop

  particlePositions(frame, objs.pOff);
  (objs.pGeo.getAttribute("aOffset") as THREE.InstancedBufferAttribute).needsUpdate = true;

  const buf = gl.getDrawingBufferSize(new THREE.Vector2());
  const ppu = pxPerUnit(FOV, buf.y);
  for (const m of objs.mats) {
    const sm = m as THREE.ShaderMaterial;
    sm.uniforms.uPxPerUnit.value = ppu;
    sm.uniforms.uFrame.value = frame;
  }

  return (
    <>
      <primitive object={objs.bg} />
      <primitive object={objs.grid} />
      <primitive object={objs.rim} />
      <primitive object={objs.map} />
      <primitive object={objs.tilt} />
      <primitive object={objs.particles} />
    </>
  );
};

export const DotMapGlobe: React.FC<{ palette: DotGlobePalette }> = ({ palette }) => {
  const land = useLand();
  const fonts = useFonts();
  return (
    <AbsoluteFill style={{ backgroundColor: palette.bgBottom }}>
      {land && fonts ? (
        <>
          <ThreeStage post={{ grain: 0.02, blackSafe: false, loop: LOOP }}>
            <Scene land={land} palette={palette} />
          </ThreeStage>
          <AbsoluteFill style={{ filter: "blur(0.6px)" }}>
            <CodeText color={palette.text} />
          </AbsoluteFill>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
