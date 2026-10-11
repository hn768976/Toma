import { useCallback } from "react";
import { staticFile } from "remotion";
import * as THREE from "three";
import { HudPanel } from "../hud/layer";
import { circleSegments, FatLines, Segment } from "../lib/fatlines";
import { GLStage, loadFonts, SceneFactory } from "../lib/GLStage";
import { PostChain } from "../lib/post";
import { hash01, TAU } from "../lib/random";
import { HeadAsset, loadHead, makeHeadMaterial, makeStudioEnv } from "./head";
import { LOOP, PANELS } from "./hudLayout";
import { Waves } from "./waves";

// Look 1 — Android Trader HUD. 1A: android in the left third, HUD on the
// right. 1B: the scene re-laid out (android right, head turned left,
// HUD panels moved to the left, text still reading normally).

export type AndroidProps = { side: "left" | "right" };

const FOV = 28;
const CAM_DIST = 2.85;
const CAM_Y = -0.43;
const HEAD_X = 0.78; // distance of the head from the frame centre

const lin = (hex: string) => new THREE.Color(hex); // three converts to linear

const BG_FRAG = /* glsl */ `
uniform vec3 cDark, cLight, cHaze;
uniform float flip;
varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  if (flip > 0.5) uv.x = 1.0 - uv.x;
  // Steel-blue gradient: darker low and right, lighter behind the head,
  // with a pale haze high in the HUD area.
  float g = clamp(0.62 * uv.y + 0.38 * (1.0 - uv.x) * 0.8 + 0.1, 0.0, 1.0);
  vec3 col = mix(cDark, cLight, g);
  float h = exp(-pow(length((uv - vec2(0.56, 0.86)) * vec2(1.3, 2.2)), 2.0) * 2.5);
  col += cHaze * h * 0.9;
  float h2 = exp(-pow(length((uv - vec2(0.16, 0.55)) * vec2(1.6, 1.4)), 2.0) * 3.0);
  col += cLight * h2 * 0.5;
  gl_FragColor = vec4(col, 1.0);
}
`;
const BG_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// Emissive iris: bright core, dark pupil ring, electric-blue iris.
const EYE_FRAG = /* glsl */ `
uniform float pulse;
varying vec3 vN;
void main() {
  float r = length(vN.xy) * step(0.0, vN.z) + step(vN.z, 0.0);
  vec3 core = vec3(0.74, 0.89, 1.0);
  vec3 iris = vec3(0.04, 0.25, 1.0);
  float ang = atan(vN.y, vN.x);
  float streak = 0.75 + 0.25 * sin(ang * 23.0) * sin(ang * 7.0 + 1.3);
  vec3 c = iris * 5.0 * streak * (1.0 - smoothstep(0.55, 0.85, r));
  c += iris * 0.6 * (1.0 - smoothstep(0.85, 1.0, r));
  float ring = smoothstep(0.13, 0.17, r) * (1.0 - smoothstep(0.2, 0.26, r));
  c *= 1.0 - 0.85 * ring;
  c += core * 26.0 * pulse * (1.0 - smoothstep(0.0, 0.16, r));
  gl_FragColor = vec4(c, 1.0);
}
`;
const EYE_VERT = /* glsl */ `
varying vec3 vN;
void main() { vN = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const SPRITE_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const HALO_FRAG = /* glsl */ `
uniform vec3 color;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float a = exp(-r * r * 9.0) * 0.9 + exp(-r * r * 2.5) * 0.18;
  gl_FragColor = vec4(color * a * (1.0 - smoothstep(0.8, 1.0, r)), 1.0);
}
`;
// Lens flare in screen space: a hot core, an anamorphic streak and four
// thin rays.
const FLARE_FRAG = /* glsl */ `
uniform vec3 color;
uniform float aspect; // quad width / height
varying vec2 vUv;
void main() {
  vec2 p = vUv * vec2(aspect, 1.0);
  float r = length(p);
  float core = exp(-r * r * 60.0) * 3.0 + exp(-r * r * 6.0) * 0.25;
  float streak = exp(-abs(vUv.y) * 22.0) * exp(-abs(vUv.x) * 2.2) * 0.9;
  float rays = exp(-abs(p.x) * 90.0) * exp(-abs(p.y) * 6.0) * 0.5;
  rays += exp(-abs(p.x + p.y) * 70.0) * exp(-r * 7.0) * 0.18 + exp(-abs(p.x - p.y) * 70.0) * exp(-r * 7.0) * 0.18;
  vec3 c = color * (streak + rays) + vec3(0.8, 0.9, 1.0) * core;
  gl_FragColor = vec4(c, 1.0);
}
`;

const makeFactory =
  (side: "left" | "right"): SceneFactory<HeadAsset> =>
  ({ renderer, width, height, assets }) => {
    const flip = side === "right";
    const sgn = flip ? -1 : 1;
    const px = height / 2160;
    const res = new THREE.Vector2(width, height);
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const scene = new THREE.Scene();
    const env = makeStudioEnv(
      renderer,
      [
        { pos: [-4, 2.5, 5], size: [5, 4], color: 0xdfeaff, intensity: 2.0 },
        { pos: [5, 0.5, -1.5], size: [2, 6], color: 0x8ab8ff, intensity: 2.6 },
        { pos: [0, 7, 1], size: [8, 6], color: 0xb8d0ff, intensity: 0.7 },
        { pos: [0, -6, 3], size: [8, 3], color: 0x2a4a6a, intensity: 0.8 },
      ],
      0x0a1626,
    );

    // Background.
    const bgMat = new THREE.ShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
      uniforms: {
        cDark: { value: lin("#0A1A30") },
        cLight: { value: lin("#2A4A6A") },
        cHaze: { value: lin("#5A8AB8") },
        flip: { value: flip ? 1 : 0 },
      },
      depthWrite: true,
    });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), bgMat);
    bg.position.set(0, CAM_Y, -4.5);
    scene.add(bg);

    // Head.
    const head = new THREE.Group();
    head.position.set(-HEAD_X * sgn, 0, 0);
    // Turned slightly toward the HUD (rotate the mesh; never mirror it).
    head.rotation.y = 0.2 * sgn;
    head.rotation.x = 0.03;
    scene.add(head);
    const headMesh = new THREE.Mesh(assets.geometry, makeHeadMaterial(env));
    head.add(headMesh);

    // Eyes, sockets' glow.
    const eyeUniforms = { pulse: { value: 1 } };
    for (const e of assets.header.eyes) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.052, 48, 32),
        new THREE.ShaderMaterial({ vertexShader: EYE_VERT, fragmentShader: EYE_FRAG, uniforms: eyeUniforms }),
      );
      eye.position.set(e.x, e.y, e.z);
      head.add(eye);
      const halo = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.3),
        new THREE.ShaderMaterial({
          vertexShader: SPRITE_VERT,
          fragmentShader: HALO_FRAG,
          uniforms: { color: { value: new THREE.Vector3(0.1, 0.35, 1.0).multiplyScalar(1.4) } },
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      halo.position.set(e.x, e.y, e.z + 0.09);
      head.add(halo);
    }

    // Face wireframe: drawn on in order of distance from the eye, then
    // pulsing; whole cycles per loop.
    const wf = assets.header.wireframe;
    const eyeR = assets.header.eyes[1];
    const order = (p: number[]) => Math.hypot(p[0] - eyeR.x, p[1] - eyeR.y);
    let maxOrder = 0;
    for (const e of wf.edges) maxOrder = Math.max(maxOrder, order(e.pts[0]), order(e.pts[e.pts.length - 1]));
    const segs: Segment[] = [];
    wf.edges.forEach((e, ei) => {
      const o0 = order(e.pts[0]) / maxOrder;
      const o1 = order(e.pts[e.pts.length - 1]) / maxOrder;
      const n = e.pts.length - 1;
      const forward = o0 <= o1;
      for (let i = 0; i < n; i++) {
        // `along` runs from the end nearest the eye.
        const along = forward ? (i + 1) / n : (n - i) / n;
        segs.push({
          a: e.pts[i] as [number, number, number],
          b: e.pts[i + 1] as [number, number, number],
          data: [Math.min(o0, o1), along, hash01(77, ei)],
        });
      }
    });
    const wire = new FatLines(segs, {
      widthPx: 2.2 * px,
      color: "#F4FAFF",
      intensity: 0.7,
      resolution: res,
      glsl: /* glsl */ `
        // Two draw-on cycles per loop.
        float p = fract(uTime * 2.0);
        float startT = vData.x * 0.28;
        float prog = clamp((p - startT) / 0.06, 0.0, 1.0);
        if (vData.y > prog + 0.001) return 0.0;
        float fade = 1.0 - smoothstep(0.86, 0.97, p);
        float pulse = 0.65 + 0.35 * sin(6.2831853 * (uTime * 6.0 - vData.x * 2.0));
        float flick = 0.85 + 0.15 * sin(6.2831853 * (uTime * 10.0 + vData.z * 7.0));
        return fade * pulse * flick;
      `,
    });
    head.add(wire.mesh);

    // Wireframe nodes: small dots; 3 of them flash.
    const nodeGeo = new THREE.BufferGeometry();
    const nodePos = new Float32Array(wf.points.length * 3);
    const nodeData = new Float32Array(wf.points.length * 2);
    const flashers = [17, 42, 88];
    wf.points.forEach((p, i) => {
      nodePos.set(p, i * 3);
      nodeData[i * 2] = order(p) / maxOrder;
      nodeData[i * 2 + 1] = flashers.indexOf(i);
    });
    nodeGeo.setAttribute("position", new THREE.BufferAttribute(nodePos, 3));
    nodeGeo.setAttribute("aData", new THREE.BufferAttribute(nodeData, 2));
    const nodeMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec2 aData;
        uniform float uTime, sizePx;
        varying float vK;
        void main() {
          float p = fract(uTime * 2.0);
          float on = step(aData.x * 0.28 + 0.01, p) * (1.0 - smoothstep(0.86, 0.97, p));
          float flash = 0.0;
          if (aData.y >= 0.0) {
            float ph = fract(uTime * 3.0 + aData.y * 0.31);
            flash = exp(-ph * 18.0) * 6.0;
          }
          vK = on * (1.0 + flash);
          gl_PointSize = sizePx * (1.0 + min(flash, 1.0) * 1.2);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vK;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float a = clamp((1.0 - r) * 3.0, 0.0, 1.0);
          if (a * vK < 0.002) discard;
          gl_FragColor = vec4(vec3(0.9, 0.95, 1.0) * a * vK, 1.0);
        }`,
      uniforms: { uTime: { value: 0 }, sizePx: { value: 7 * px } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const nodes = new THREE.Points(nodeGeo, nodeMat);
    nodes.frustumCulled = false;
    head.add(nodes);

    // Targeting rings near the (screen) left eye, dashed, rotating whole
    // turns per loop.
    const eyeL = assets.header.eyes[0];
    const rings = new THREE.Group();
    rings.position.set(eyeL.x - 0.02, eyeL.y - 0.035, eyeL.z + 0.07);
    head.add(rings);
    // Dashes come from the segment index stored per ring below.
    const dashed = (r: number, n: number, dashes: number, turns: number, seed: number) => {
      const s = circleSegments(r, n).map((sg, i) => ({ ...sg, data: [i / n, dashes, turns + seed * 0] as [number, number, number] }));
      return new FatLines(s, {
        widthPx: 2.4 * px,
        color: "#F4FAFF",
        intensity: 0.85,
        resolution: res,
        glsl: /* glsl */ `
          float t = fract(vData.x - uTime * vData.z);
          float d = fract(t * vData.y);
          return step(d, 0.62) * (0.6 + 0.4 * step(t, 0.25));
        `,
      });
    };
    const r1 = dashed(0.115, 144, 3, 1, 0);
    const r2 = dashed(0.145, 160, 9, -2, 1);
    rings.add(r1.mesh, r2.mesh);

    // HUD panels.
    const panels: HudPanel[] = [];
    const texScale = Math.max(0.34, (height / 2160) * 1.25);
    const tanH = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    for (const spec of PANELS) {
      const d = CAM_DIST - spec.z;
      const fh = 2 * d * tanH;
      const fw = fh * (16 / 9);
      let [u0, u1] = spec.u;
      if (flip) [u0, u1] = [1 - u1, 1 - u0];
      const [v0, v1] = spec.v;
      const w4k = (spec.u[1] - spec.u[0]) * 3840;
      const h4k = (v1 - v0) * 2160;
      const panel = new HudPanel({
        w4k,
        h4k,
        worldW: (u1 - u0) * fw,
        texScale,
        anisotropy: aniso,
        drawStatic: spec.drawStatic ? (ctx) => spec.drawStatic!(ctx, w4k, h4k) : undefined,
        widgets: spec.widgets ? spec.widgets(w4k, h4k) : undefined,
        intensity: spec.intensity,
        tint: "#CFE4FF",
      });
      panel.group.position.set(((u0 + u1) / 2 - 0.5) * fw, CAM_Y - ((v0 + v1) / 2 - 0.5) * fh, spec.z);
      scene.add(panel.group);
      panels.push(panel);
    }

    // Lights.
    const key = new THREE.DirectionalLight(0xe8f0ff, 2.3);
    key.position.set(-3 * sgn, 2, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8ab8ff, 2.2);
    rim.position.set(4 * sgn, 1, -2.5);
    scene.add(rim);
    const fill = new THREE.HemisphereLight(0x6a8ab8, 0x0a1a30, 0.5);
    scene.add(fill);

    const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 30);

    // Overlay: waves + lens flares, sharp, after DoF.
    const faceX = flip ? 0.82 : 0.18;
    const waves = new Waves(width, height, faceX, px);
    const flareMat = new THREE.ShaderMaterial({
      vertexShader: SPRITE_VERT,
      fragmentShader: FLARE_FRAG,
      uniforms: { color: { value: new THREE.Vector3(0.25, 0.55, 1.0).multiplyScalar(1.5) }, aspect: { value: 6 } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    const flares = assets.header.eyes.map(() => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flareMat);
      m.scale.set(height * 0.6, height * 0.1, 1);
      waves.scene.add(m);
      return m;
    });

    const post = new PostChain(renderer, width, height, {
      dof: { aperture: 34, maxCoc: 22, nearScale: 1.3 },
      bloom: { threshold: 0.9, knee: 0.6, intensity: 0.55 },
      grade: { exposure: 1.0, tint: [0.94, 0.99, 1.06], lift: [0.0, 0.01, 0.025], saturation: 1.05, contrast: 1.04 },
      vignette: { strength: 0.42, radius: 0.45, softness: 0.65 },
      grain: 0.015,
      loop: LOOP,
      clearColor: 0x0a1a30,
    });

    const tmp = new THREE.Vector3();

    return {
      render(frame) {
        const t = (frame % LOOP) / LOOP;
        // Camera: one closed lap of +-2 deg yaw around the head and a 1.5 %
        // push in and out.
        const yaw = THREE.MathUtils.degToRad(2) * Math.sin(TAU * t);
        const push = 1 - 0.015 * (0.5 - 0.5 * Math.cos(TAU * t));
        const pivot = new THREE.Vector3(head.position.x, CAM_Y, 0);
        const off = new THREE.Vector3(HEAD_X * sgn, 0, CAM_DIST).multiplyScalar(push);
        off.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        camera.position.copy(pivot).add(off);
        camera.rotation.set(0.004 * Math.sin(TAU * t * 2), yaw, 0);
        camera.updateMatrixWorld();

        eyeUniforms.pulse.value = 0.9 + 0.1 * Math.sin(TAU * t * 5);
        wire.material.uniforms.uTime.value = t;
        nodeMat.uniforms.uTime.value = t;
        r1.material.uniforms.uTime.value = t;
        r2.material.uniforms.uTime.value = t;
        rings.lookAt(camera.position);
        for (const p of panels) p.update(frame);

        // Flare positions follow the eyes on screen.
        head.updateMatrixWorld();
        assets.header.eyes.forEach((e, i) => {
          tmp.set(e.x, e.y, e.z + 0.05).applyMatrix4(head.matrixWorld).project(camera);
          flares[i].position.set((tmp.x * 0.5 + 0.5) * width, (tmp.y * 0.5 + 0.5) * height, 0);
          const k = 0.92 + 0.08 * Math.sin(TAU * (t * 4 + i * 0.5));
          flares[i].scale.set(height * 0.55 * k, height * 0.09 * k, 1);
        });

        const focus = CAM_DIST * push - 0.4;
        post.render(scene, camera, frame, focus, () => {
          waves.render(renderer, frame, LOOP);
        });
      },
      dispose() {
        post.dispose();
      },
    };
  };

const factories = { left: makeFactory("left"), right: makeFactory("right") };

export const AndroidTrader = ({ side }: AndroidProps) => {
  const load = useCallback(async () => {
    const [head] = await Promise.all([loadHead(), loadFonts(staticFile)]);
    return head;
  }, []);
  return <GLStage load={load} factory={factories[side]} />;
};
