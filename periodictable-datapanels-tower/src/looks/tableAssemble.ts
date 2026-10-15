import * as THREE from "three";
import { buildAtlas } from "../lib/atlas";
import { ELEMENTS, tableXY } from "../lib/elements";
import { DEFAULT_POST } from "../lib/pipeline";
import { mulberry32 } from "../lib/random";
import type { LookFactory } from "../lib/Stage";
import { makeSlabMesh, makeTileMaterial } from "../lib/tiles";

export type AssembleParams = {
  background: string; // backdrop centre colour
  backgroundEdge: string; // backdrop corner colour
  face: string; // tile face
  faceTop?: string; // optional gradient (glass sheen) at the top of the face
  text: string;
  sub: string;
  border: string;
  innerRule: string; // faint second frame line
  side: string; // slab edge colour
  gradX: number; // left-to-right light ramp across the table
  shadow: string;
  shadowStrength: number;
  sweep: string; // light sweep colour
  sweepStrength: number;
  glow: number; // bloom strength
  glowThreshold: number;
};

const FPS = 30;
const ASPECT = 1.0;
const PITCH = 1.0; // cell pitch (tile width 0.92 + gap)
const TILE_W = 0.985;
const DEPTH = 0.045;
const F_GAP = 0.0;
const PLANE_Z = -0.2; // backdrop
const FOV = 30;

// Final cell centre (table centred on the origin).
const COLS = 18;
const TABLE_H = (7 + F_GAP + 2) * ASPECT * PITCH;
const cell = (z: number) => {
  const e = ELEMENTS[z - 1];
  const { x, y } = tableXY(e, F_GAP);
  return new THREE.Vector3((x - (COLS - 1) / 2) * PITCH, -(y * ASPECT * PITCH) + (TABLE_H - ASPECT) / 2, 0);
};

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// Camera distances: during assembly, and framing the whole table.
const D_FULL = (COLS * PITCH) / 0.843 / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (16 / 9));
const D_BUILD = D_FULL * 0.86;

type Flight = {
  t0: number; // seconds
  dur: number;
  start: THREE.Vector3;
  ctrl: THREE.Vector3; // quadratic Bézier control point
  end: THREE.Vector3;
  q0: THREE.Quaternion; // start orientation
  // close passes: drift to `near` (pausing there), then on into the cell
  near?: THREE.Vector3;
  ctrl2?: THREE.Vector3;
  qNear?: THREE.Quaternion;
};
const NEAR_SPLIT = 0.5; // share of the flight spent drifting to the near point

// Close passes: these tiles fly through a point near the camera.
const CLOSE: Record<string, { t0: number; dur: number; near: [number, number, number] }> = {
  Cu: { t0: -2.6, dur: 7.2, near: [-2.4, 0.5, 13.6] },
  Tc: { t0: -0.4, dur: 6.2, near: [2.9, -0.8, 12.8] },
  Au: { t0: 0.5, dur: 5.6, near: [0.4, 0.7, 14.6] },
  Zn: { t0: 3.0, dur: 4.4, near: [-1.9, -0.7, 14.2] },
  Cd: { t0: 4.2, dur: 4.2, near: [2.1, 0.6, 13.4] },
  Ag: { t0: 5.4, dur: 3.9, near: [-0.5, 0.2, 14.8] },
};
// A few ordinary tiles also start before the main wave.
const EARLY: Record<string, number> = { H: 0.5, Ni: 0.9, Se: 1.3, Ce: 1.7 };

// Generated once (module level, seeded) – positions per frame are formulas.
const FLIGHTS: Flight[] = (() => {
  const rnd = mulberry32(19937);
  return ELEMENTS.map((e) => {
    const end = cell(e.z);
    const ang = rnd() * Math.PI * 2;
    const R = 19 + rnd() * 7;
    const start = new THREE.Vector3(Math.cos(ang) * R * 1.3, Math.sin(ang) * R * 0.8, -3 + rnd() * 9);
    const q0 = new THREE.Quaternion().setFromEuler(
      new THREE.Euler((rnd() - 0.5) * 2.4, (rnd() - 0.5) * 2.4, (rnd() - 0.5) * 1.6),
    );
    const close = CLOSE[e.symbol];
    if (close) {
      const near = new THREE.Vector3(...close.near);
      // tangents through `near` are collinear, so the two curve halves join smoothly
      const through = end.clone().sub(start).normalize().multiplyScalar(2.2);
      const ctrl = near.clone().sub(through);
      const ctrl2 = near.clone().add(through);
      const qNear = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, -0.32 * Math.sign(near.x), 0.06));
      return { t0: close.t0, dur: close.dur, start, ctrl, end, q0, near, ctrl2, qNear };
    }
    // staggered by group (column), with jitter
    const early = EARLY[e.symbol];
    const t0 = early ?? 2.0 + ((e.col - 1) / 17) * 4.6 + rnd() * 1.0;
    const dur = early !== undefined ? 3.2 + rnd() * 0.8 : 1.5 + rnd() * 0.7;
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const ctrl = mid.add(new THREE.Vector3((rnd() - 0.5) * 8, (rnd() - 0.5) * 6, 2 + rnd() * 6));
    return { t0, dur, start, ctrl, end, q0 };
  });
})();

export const LAST_LANDING = Math.max(...FLIGHTS.map((f) => f.t0 + f.dur));

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const quad = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, u: number, out: THREE.Vector3) => {
  const a = (1 - u) * (1 - u);
  const b = 2 * (1 - u) * u;
  const c = u * u;
  return out.copy(p0).multiplyScalar(a).add(tmpA.copy(p1).multiplyScalar(b)).add(tmpB.copy(p2).multiplyScalar(c));
};

// Soft contact shadows on the backdrop: one quad per tile, offset away from
// the light and widened/faded with the tile's height above the backdrop.
const SHADOW_VERT = /* glsl */ `
attribute vec4 aShadow; // x, y, height, visible
varying vec2 vLocal;
varying float vH;
varying float vVis;
uniform vec2 offsetPerUnit;
uniform vec2 tileSize;
void main() {
  float h = aShadow.z;
  float grow = 1.0 + 0.10 * h;
  vec2 size = tileSize * grow + vec2(0.35 + 0.22 * h);
  vec2 c = aShadow.xy + offsetPerUnit * h;
  vLocal = position.xy * size;
  vH = h;
  vVis = aShadow.w;
  vec4 w = modelMatrix * vec4(c + vLocal, 0.0, 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const SHADOW_FRAG = /* glsl */ `
uniform vec3 shadowColor;
uniform float strength;
uniform vec2 tileSize;
varying vec2 vLocal;
varying float vH;
varying float vVis;
void main() {
  float blur = 0.06 + 0.11 * vH;
  vec2 half_ = tileSize * (1.0 + 0.10 * vH) * 0.5;
  vec2 q = abs(vLocal) - half_ + blur;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  float a = 1.0 - smoothstep(-blur, blur, d);
  a *= strength * vVis / (1.0 + 0.55 * vH * vH);
  gl_FragColor = vec4(shadowColor, a);
}
`;

export const tableAssemble =
  (p: AssembleParams, frames: number): LookFactory =>
  ({ gl, aspect }) => {
    const atlas = buildAtlas(
      {
        id: "assemble",
        px: 384,
        aspect: ASPECT,
        layout: "classic",
        bg: p.face,
        border: p.border,
        borderWidth: 0.018,
        radius: 0.02,
        inset: 0.035,
        innerRule: p.innerRule,
        symbol: p.text,
        text: p.text,
        sub: p.sub,
        showName: true,
        showMass: true,
        showCategory: true,
        categorySize: 0.052,
        symbolWeight: 500,
        symbolSize: 0.42,
        numberSize: 0.085,
        nameSize: 0.085,
        massSize: 0.072,
        decorate: p.faceTop
          ? (ctx, w, h) => {
              const g = ctx.createLinearGradient(0, 0, 0, h);
              g.addColorStop(0, p.faceTop!);
              g.addColorStop(0.55, "rgba(0,0,0,0)");
              ctx.globalCompositeOperation = "screen";
              ctx.fillStyle = g;
              ctx.fillRect(0, 0, w, h);
              ctx.globalCompositeOperation = "source-over";
            }
          : undefined,
      },
      gl,
    );

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, aspect, 0.5, 200);

    // Backdrop with a soft centre light.
    const backMat = new THREE.ShaderMaterial({
      uniforms: {
        c0: { value: new THREE.Color(p.background) },
        c1: { value: new THREE.Color(p.backgroundEdge) },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 c0, c1; varying vec2 vUv;
        void main(){ vec2 q = (vUv - vec2(0.5, 0.66)) * vec2(1.25, 1.0); float r = dot(q, q);
          gl_FragColor = vec4(mix(c0, c1, smoothstep(0.02, 0.9, r)), 1.0); }`,
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(90, 52), backMat);
    back.position.z = PLANE_Z;
    scene.add(back);

    // Shadows
    const shadowGeo = new THREE.InstancedBufferGeometry();
    shadowGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3),
    );
    shadowGeo.setIndex([0, 1, 2, 0, 2, 3]);
    const shadowData = new Float32Array(ELEMENTS.length * 4);
    const shadowAttr = new THREE.InstancedBufferAttribute(shadowData, 4);
    shadowGeo.setAttribute("aShadow", shadowAttr);
    shadowGeo.instanceCount = ELEMENTS.length;
    const shadowMat = new THREE.ShaderMaterial({
      vertexShader: SHADOW_VERT,
      fragmentShader: SHADOW_FRAG,
      uniforms: {
        shadowColor: { value: new THREE.Color(p.shadow) },
        strength: { value: p.shadowStrength },
        offsetPerUnit: { value: new THREE.Vector2(0.16, -0.22) },
        tileSize: { value: new THREE.Vector2(TILE_W, TILE_W * ASPECT) },
      },
      transparent: true,
      depthWrite: false,
    });
    const shadows = new THREE.Mesh(shadowGeo, shadowMat);
    shadows.position.z = PLANE_Z + 0.002;
    shadows.frustumCulled = false;
    shadows.renderOrder = 1;
    scene.add(shadows);

    const faceMat = makeTileMaterial(atlas, { shadeAmt: 0.12, lightDir: [-0.45, 0.6, 1], gradX: p.gradX });
    const sideMat = makeTileMaterial(atlas, { shadeAmt: 0.4, lightDir: [-0.45, 0.6, 1], flatColor: p.side });
    const slabs = makeSlabMesh(atlas, ELEMENTS.length, faceMat, sideMat, TILE_W, DEPTH);
    ELEMENTS.forEach((e, i) => slabs.setRect(i, atlas.rect(e.z)));
    slabs.mesh.renderOrder = 2;
    scene.add(slabs.mesh);

    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const ident = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const m = new THREE.Matrix4();
    const sweepColor = new THREE.Color(p.sweep).multiplyScalar(p.sweepStrength);

    return {
      scene,
      camera,
      update: (frame) => {
        const f = Math.min(Math.max(frame, 0), frames - 1);
        const t = f / FPS;
        ELEMENTS.forEach((_, i) => {
          const fl = FLIGHTS[i];
          const lt = (t - fl.t0) / fl.dur;
          let vis = 1;
          if (lt <= 0) {
            pos.copy(fl.start);
            quat.copy(fl.q0);
            vis = 0;
          } else if (lt < 1 && fl.near && fl.ctrl2 && fl.qNear) {
            if (lt < NEAR_SPLIT) {
              // drift in and slow to a near-stop close to the camera
              const u = 1 - Math.pow(1 - lt / NEAR_SPLIT, 2.2);
              quad(fl.start, fl.ctrl, fl.near, u, pos);
              quat.slerpQuaternions(fl.q0, fl.qNear, easeOutCubic(lt / NEAR_SPLIT));
            } else {
              const u = easeInOutCubic((lt - NEAR_SPLIT) / (1 - NEAR_SPLIT));
              quad(fl.near, fl.ctrl2, fl.end, u, pos);
              quat.slerpQuaternions(fl.qNear, ident, u);
            }
          } else if (lt < 1) {
            const u = easeOutCubic(lt);
            quad(fl.start, fl.ctrl, fl.end, u, pos);
            quat.slerpQuaternions(fl.q0, ident, easeInOutCubic(clamp01(lt * 1.15)));
          } else {
            // landed: tiny damped settle into the cell
            const tau = (lt - 1) * fl.dur;
            pos.copy(fl.end);
            pos.z += 0.09 * Math.exp(-7 * tau) * Math.sin(16 * tau);
            quat.copy(ident);
          }
          scl.setScalar(vis ? 1 : 0.0001);
          m.compose(pos, quat, scl);
          slabs.mesh.setMatrixAt(i, m);
          shadowData.set([pos.x, pos.y, Math.max(0, pos.z - PLANE_Z), vis], i * 4);
        });
        slabs.mesh.instanceMatrix.needsUpdate = true;
        shadowAttr.needsUpdate = true;

        // Camera: slow push during assembly, then eases back to frame the table.
        const back = easeInOutCubic(clamp01((t - 8.9) / 1.6));
        const d = THREE.MathUtils.lerp(D_BUILD + 0.06 * D_BUILD * clamp01(t / 9), D_FULL, back);
        const driftX = (1 - back) * 0.6 * Math.sin(t * 0.35);
        camera.position.set(driftX, 0.1 + (1 - back) * 0.3, d);
        camera.lookAt(driftX * 0.6, 0.1, 0);
        camera.updateMatrixWorld();

        // One soft light sweep across the finished table during the hold.
        const sw = clamp01((t - 10.9) / 3.0);
        const u = faceMat.uniforms;
        u.sweepAxis.value.set(0.89, 0.45);
        u.sweepPos.value = THREE.MathUtils.lerp(-14, 14, easeInOutCubic(sw));
        u.sweepWidth.value = 1.6;
        u.sweepColor.value.copy(sweepColor).multiplyScalar(t > 10.6 && t < 14.4 ? 1 : 0);

        return {
          ...DEFAULT_POST,
          focusDist: d,
          aperture: 1.4,
          focusBand: 0.05,
          nearScale: 0.14,
          maxBlur: 0.016,
          bloomThreshold: p.glowThreshold,
          bloomStrength: p.glow,
          bloomWeights: [0.5, 0.5, 0.4, 0.3],
          vignette: 0.05,
        };
      },
      dispose: () => {
        atlas.texture.dispose();
        faceMat.dispose();
        sideMat.dispose();
        slabs.mesh.geometry.dispose();
        backMat.dispose();
        shadowMat.dispose();
        shadowGeo.dispose();
      },
    };
  };
