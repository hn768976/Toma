import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { LOOP, TAU } from "../common/constants";
import { makeStripEnv } from "../common/env";
import { FRAG_OUT, GLSL_HASH } from "../common/glsl";
import { mulberry32 } from "../common/random";
import type { World } from "../common/world";

/**
 * Look 3 - Diamond Frames. A lattice of diamond tiles; each tile is 5 nested
 * bevelled square rings stepping deeper toward a dot-textured centre panel.
 * Black satin metal; a warm strip environment lights the bevels, a moving
 * rect-area light sweeps diagonally once per loop, and ~3000 glitter points
 * twinkle along the upper edges.
 */
export type DiamondsParams = {
  edge: string;
  glitter: string;
  background: string;
};

// World layout (camera distance 10, fov 30 -> visible height ~5.36)
const P = 2.85; // centre panel half-diagonal
const W = 0.8; // band width
const RINGS = 5;
const HALF = P + RINGS * W; // tile half-diagonal (4.5)
const STEP = 0.03 * 2 * HALF; // each band ~3% deeper
const BEVEL = 0.15;
const LAT = 3; // lattice copies each way

const diamondPath = (r: number, hole = false) => {
  const pts = [
    new THREE.Vector2(r, 0),
    new THREE.Vector2(0, r),
    new THREE.Vector2(-r, 0),
    new THREE.Vector2(0, -r),
  ];
  if (hole) pts.reverse();
  return pts;
};

const ringGeometry = (rIn: number, rOut: number, depth: number) => {
  // bevel grows the outline by BEVEL; shrink the shape to keep final sizes.
  const s2 = Math.SQRT2;
  const shape = new THREE.Shape(diamondPath(rOut - BEVEL * s2));
  shape.holes.push(new THREE.Path(diamondPath(rIn + BEVEL * s2, true)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 6,
    curveSegments: 1,
  });
  g.translate(0, 0, -depth - BEVEL); // top face at z = 0
  return g;
};

const panelGeometry = (r: number) => {
  const s2 = Math.SQRT2;
  const shape = new THREE.Shape(diamondPath(r - BEVEL * s2));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.2,
    bevelEnabled: true,
    bevelThickness: BEVEL * 0.6,
    bevelSize: BEVEL * 0.6,
    bevelSegments: 3,
    curveSegments: 1,
  });
  g.translate(0, 0, -0.2 - BEVEL * 0.6);
  // planar UVs for the dot grid (diamond-aligned)
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv.setXY(i, (x + y) / (2 * r) + 0.5, (y - x) / (2 * r) + 0.5);
  }
  return g;
};

/** Normal map of a fine grid of hemispherical dimples/bumps. */
const dotNormalMap = () => {
  const N = 256;
  const DOTS = 8;
  const data = new Uint8Array(N * N * 4);
  const cell = N / DOTS;
  const rad = cell * 0.3;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const cx = (x % cell) - cell / 2 + 0.5;
      const cy = (y % cell) - cell / 2 + 0.5;
      const r = Math.hypot(cx, cy) / rad;
      let nx = 0;
      let ny = 0;
      if (r < 1) {
        const k = 0.9 * Math.sin(r * Math.PI * 0.5);
        nx = (cx / (Math.hypot(cx, cy) + 1e-6)) * k;
        ny = (cy / (Math.hypot(cx, cy) + 1e-6)) * k;
      }
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const i = (y * N + x) * 4;
      data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
};

const latticeOffsets = () => {
  const out: THREE.Vector2[] = [];
  for (let j = -LAT; j <= LAT; j++) {
    for (let i = -LAT; i <= LAT; i++) {
      out.push(new THREE.Vector2((i + j) * HALF, (i - j) * HALF));
    }
  }
  return out;
};

// ---------- glitter ----------
const GLITTER = 3000;
const glitterVert = /* glsl */ `
${GLSL_HASH}
in float gid;
uniform float pxScale, bucketF;
out float vBright;
out float vSize;
void main() {
  // twinkle from hash(ID, frame bucket), smoothly blended between buckets
  // (60 buckets per loop -> period divides 600)
  float b0 = floor(bucketF);
  float fr = bucketF - b0;
  uint id = uint(gid);
  float h0 = hash3u(uvec3(id, uint(mod(b0, 60.0)), 17u)).x;
  float h1 = hash3u(uvec3(id, uint(mod(b0 + 1.0, 60.0)), 17u)).x;
  float hs = hash3u(uvec3(id, 3u, 99u)).x;
  float s = fr * fr * (3.0 - 2.0 * fr);
  float h = mix(pow(h0, 3.0), pow(h1, 3.0), s);
  vBright = h * 2.0 + 0.55;
  vSize = (1.6 + 4.0 * h + 1.0 * hs) * pxScale;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vSize;
}
`;
const glitterFrag = /* glsl */ `
${FRAG_OUT}
uniform vec3 color;
in float vBright;
in float vSize;
void main() {
  vec2 p = (gl_PointCoord - 0.5) * 2.0;
  float r = length(p);
  float core = exp(-r * r * 9.0);
  float cross = (exp(-abs(p.x) * 14.0) * exp(-p.y * p.y * 2.0) + exp(-abs(p.y) * 14.0) * exp(-p.x * p.x * 2.0)) * smoothstep(5.0, 9.0, vSize);
  float a = (core + cross * 0.6) * vBright;
  gl_FragColor = vec4(color * a, 1.0);
}
`;

export const makeDiamonds =
  (params: DiamondsParams) =>
  (gl: THREE.WebGLRenderer): World => {
    RectAreaLightUniformsLib.init();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(params.background);
    scene.environment = makeStripEnv(
      gl,
      [
        // broad neutral softbox overhead: satin grey sheen on the bands
        { dir: [0.0, 0.75, 0.66], roll: 0, length: 80, width: 30, color: "#FFFFFF", intensity: 6 },
        // faint warm strips: thin edge lines everywhere, strongest lower-left
        { dir: [-0.9, -0.5, 0.45], roll: 0.8, length: 70, width: 3, color: params.edge, intensity: 22 },
        { dir: [0.9, -0.3, 0.5], roll: -0.7, length: 70, width: 2, color: params.edge, intensity: 10 },
      ],
      { top: "#202020", bottom: "#060606", intensity: 2.0 },
      0.02,
    );
    scene.environmentIntensity = 1;

    // Shared sweep uniforms: the moving light's position along the diagonal
    // drives both the rect-area light and a crisp glint on the bevels that
    // face it (thin travelling gold lines, as in the reference).
    const sweepU = {
      sweepS: { value: -100 },
      sweepAmt: { value: 0 },
      sweepDirView: { value: new THREE.Vector3(1, 1, 0) },
      staticDirView: { value: new THREE.Vector3(-1, -0.4, 0) },
      glintCol: { value: new THREE.Color(params.edge) },
    };
    const addGlint = (m: THREE.MeshStandardMaterial) => {
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, sweepU);
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vSweepW;")
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
vec4 swp = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
swp = instanceMatrix * swp;
#endif
vSweepW = (modelMatrix * swp).xyz;`,
          );
        sh.fragmentShader = sh.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>
varying vec3 vSweepW;
uniform float sweepS, sweepAmt;
uniform vec3 sweepDirView, staticDirView, glintCol;`,
          )
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
{
  float tilt = 1.0 - normal.z;                     // 0 on flat tops, >0 on bevels
  float bev = smoothstep(0.03, 0.12, tilt) * (1.0 - smoothstep(0.6, 0.95, tilt));
  vec3 Ls = normalize(vec3(-sweepDirView.xy, 0.55));
  float g1 = pow(max(dot(normal, Ls), 0.0), 60.0);
  float along = dot(vSweepW.xy, vec2(0.70710678, 0.70710678));
  float win = exp(-pow((along - sweepS) / 1.1, 2.0));
  vec3 Lt = normalize(vec3(staticDirView.xy, 0.5));
  float g2 = pow(max(dot(normal, Lt), 0.0), 90.0);
  // which band of its tile is this? (diamond radius in the tile lattice)
  vec2 ab = vec2(vSweepW.x + vSweepW.y, vSweepW.x - vSweepW.y);
  ab -= ${(2 * HALF).toFixed(4)} * floor(ab / ${(2 * HALF).toFixed(4)} + 0.5);
  float rl = max(abs(ab.x), abs(ab.y));
  float inner = 1.0 - smoothstep(${(P + W * 1.05).toFixed(4)}, ${(P + W * 1.3).toFixed(4)}, rl);
  totalEmissiveRadiance += glintCol * bev * (g1 * win * sweepAmt * (6.0 + 14.0 * inner) + g2 * (0.25 + 5.0 * inner));
}`,
          );
      };
    };
    const black = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0A0A0C"),
      metalness: 0.6,
      roughness: 0.35,
    });
    addGlint(black);
    const dots = dotNormalMap();
    dots.repeat.set(12, 12);
    const panelMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0A0A0C"),
      metalness: 0.6,
      roughness: 0.38,
      normalMap: dots,
      normalScale: new THREE.Vector2(0.45, 0.45),
    });
    addGlint(panelMat);

    const offsets = latticeOffsets();
    const m4 = new THREE.Matrix4();
    const addInstanced = (geo: THREE.BufferGeometry, mat: THREE.Material, z: number) => {
      const mesh = new THREE.InstancedMesh(geo, mat, offsets.length);
      offsets.forEach((o, i) => mesh.setMatrixAt(i, m4.makeTranslation(o.x, o.y, z)));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
    };
    for (let k = 0; k < RINGS; k++) {
      const rOut = HALF - k * W;
      const rIn = rOut - W;
      addInstanced(ringGeometry(rIn, rOut, 1.6), black, -k * STEP);
    }
    addInstanced(panelGeometry(P), panelMat, -RINGS * STEP);

    // sweeping area light (one full pass per loop)
    const sweep = new THREE.RectAreaLight(params.edge, 0, 40, 0.6);
    scene.add(sweep);
    // glitter on the upper edges of the frames + upper panel
    const rng = mulberry32(0xd1a307);
    const gpos = new Float32Array(GLITTER * 3);
    const gid = new Float32Array(GLITTER);
    // glitter: a fine dot grid over the upper bands and upper panel of the
    // visible tiles (like the reference's sparkling dot texture)
    // candidates on a fine world-space dot grid over the upper part of the
    // frame; each sits on the surface of whichever band/panel is under it
    const cands: [number, number, number][] = [];
    const G = 0.07;
    for (let y = 0.5; y <= 3.2; y += G) {
      for (let x = -5.6; x <= 5.6; x += G) {
        let a = x + y;
        let b = x - y;
        a -= 2 * HALF * Math.round(a / (2 * HALF));
        b -= 2 * HALF * Math.round(b / (2 * HALF));
        const rl = Math.max(Math.abs(a), Math.abs(b)) / 1; // diamond radius in tile
        const k = rl < P ? RINGS : Math.min(RINGS - 1, Math.floor((HALF - rl) / W));
        // fewer dots further down
        if (mulberry32(Math.round(x * 1000) * 7 + Math.round(y * 1000))() > (y - 0.5) / 2.0) continue;
        cands.push([x, y, (k === RINGS ? -RINGS * STEP : -k * STEP) + 0.012]);
      }
    }
    for (let i = 0; i < GLITTER; i++) {
      const best = cands[Math.floor(rng() * cands.length)];
      gpos[i * 3] = best[0];
      gpos[i * 3 + 1] = best[1];
      gpos[i * 3 + 2] = best[2];
      gid[i] = i;
    }
    const ggeo = new THREE.BufferGeometry();
    ggeo.setAttribute("position", new THREE.BufferAttribute(gpos, 3));
    ggeo.setAttribute("gid", new THREE.BufferAttribute(gid, 1));
    const gUniforms = {
      pxScale: { value: 1 },
      bucketF: { value: 0 },
      color: { value: new THREE.Color(params.glitter).multiplyScalar(2.0) },
    };
    const glitter = new THREE.Points(
      ggeo,
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: glitterVert,
        fragmentShader: glitterFrag,
        uniforms: gUniforms,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    glitter.frustumCulled = false;
    scene.add(glitter);

    const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 100);

    return {
      scene,
      overlay: null,
      camera,
      post: {
        dof: null,
        bloom: { strength: 0.6, threshold: 0.55, knee: 0.4, weights: [1, 0.9, 0.7, 0.45, 0.25, 0.12] },
        exposure: 1.0,
        aces: true,
        grain: 0.015,
        grainLumaFade: 0,
        msaa: 4,
      },
      update(t, pxScale) {
        const f = t / LOOP;
        // closed drift (+-2 deg) and gentle push, all whole cycles
        const ax = ((2 * Math.PI) / 180) * Math.sin(TAU * f);
        const ay = ((1.5 * Math.PI) / 180) * Math.sin(TAU * 2 * f + 1.1);
        const dist = 10 - 0.6 * (0.5 - 0.5 * Math.cos(TAU * f));
        camera.position.set(Math.sin(ay) * dist, -Math.sin(ax) * dist, Math.cos(ay) * Math.cos(ax) * dist);
        camera.lookAt(0, 0, -0.3);
        camera.updateMatrixWorld();

        // sweep: bottom-left -> top-right, off-screen at both ends of the loop
        const s = -1 + 2 * f;
        const span = 9;
        // a long low (grazing) light bar lying along the NW-SE diagonal,
        // shining toward the NE: it catches the SW-facing bevels it passes
        const px = s * span;
        const py = s * span * 0.75;
        sweep.position.set(px, py, 2.2);
        sweep.up.set(-1, 1, 0).normalize();
        sweep.lookAt(px + 1, py + 1, -0.9);
        sweep.intensity = 1.5 * Math.pow(Math.sin(Math.PI * f), 2);
        sweepU.sweepS.value = (px + py) * Math.SQRT1_2;
        sweepU.sweepAmt.value = Math.pow(Math.sin(Math.PI * f), 2);
        // light directions in view space (camera is nearly frontal)
        const toView = (x: number, y: number, out: THREE.Vector3) =>
          out.set(x, y, 0).transformDirection(camera.matrixWorldInverse);
        camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
        toView(1, 1, sweepU.sweepDirView.value);
        toView(-1, -0.35, sweepU.staticDirView.value);

        gUniforms.pxScale.value = pxScale;
        gUniforms.bucketF.value = t / 10; // 10-frame buckets
      },
    };
  };
