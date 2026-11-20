import * as THREE from "three";
import {
  CAMERA_FOV, CAMERA_V1, CamKey, COUNTS, FPS, GLINTS, PALETTE, SEED, SHAPE, TIMING,
} from "../config";
import { PostChain } from "../lib/post";
import { keyframes, mulberry32, smoothstep } from "../lib/rng";
import type { StageContext, StageScene } from "../lib/ThreeStage";
import { LOOK, POST } from "../look";
import { glassNormal, glassPoint, glassRadius, sandState, sandSurface } from "./profile";
import * as S from "./shaders";

const lin = (hex: string) => new THREE.Color(hex);
const v3 = (c: THREE.Color, k = 1) => new THREE.Vector3(c.r * k, c.g * k, c.b * k);
const rad = THREE.MathUtils.degToRad;

const camAt = (keys: CamKey[], t: number, out: THREE.PerspectiveCamera) => {
  const k = (f: keyof CamKey) => keyframes(keys.map((c) => [c.t, c[f]] as [number, number]), t);
  const az = rad(k("az")), el = rad(k("el")), dist = k("dist");
  const tx = k("tx"), ty = k("ty");
  // the framing offset is applied sideways to the view, so the glass stays right of centre while the camera arcs
  const rx = Math.cos(az), rz = -Math.sin(az);
  const target = new THREE.Vector3(tx * rx, ty, tx * rz);
  out.position.set(
    target.x + dist * Math.sin(az) * Math.cos(el),
    target.y + dist * Math.sin(el),
    target.z + dist * Math.cos(az) * Math.cos(el),
  );
  out.up.set(0, 1, 0);
  out.lookAt(target);
  out.updateMatrixWorld(true);
  return az;
};

export const createHourglassScene =
  (cameraKeys: CamKey[]) =>
  (ctx: StageContext): StageScene => {
    const { renderer, width, height } = ctx;
    const pal = PALETTE;
    const post = new PostChain(renderer, width, height, false);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.5, 40);
    const disposables: { dispose: () => void }[] = [];
    const uCam = { value: new THREE.Vector3() };
    const uTime = { value: 0 };
    const uRimY = { value: 1 };
    const keyDir = new THREE.Vector3(...LOOK.keyDir).normalize();
    const keyCol = v3(lin(LOOK.keyColor));

    // ---- strip lights: placed once (from the locked-off Version 1 camera) so the highlights
    //      fall where the reference has them; they are fixed in the world after that.
    const refCam = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.5, 40);
    camAt(CAMERA_V1, 0, refCam);
    const reflAt = (y: number, phiDeg: number) => {
      const p = new THREE.Vector3(...glassPoint(y, rad(phiDeg)));
      const n = new THREE.Vector3(...glassNormal(y, rad(phiDeg)));
      const v = refCam.position.clone().sub(p).normalize();
      return v.clone().negate().reflect(n).normalize();
    };
    const strip = (a: [number, number], b: [number, number], colour: THREE.Vector3, w: number, i: number) => {
      const r1 = reflAt(a[0], a[1]), r2 = reflAt(b[0], b[1]);
      const n = r1.clone().cross(r2).normalize();
      const c = r1.clone().add(r2).normalize();
      return { n, c, colour, p: new THREE.Vector3(w, r1.dot(c) - 0.3, i) };
    };
    // streaks along the lower glass: the plane through two points on the glass and the reference camera,
    // so each one reads as a straight line of light from the reference viewpoint
    const lay = (a: [number, number], b: [number, number], w: number, i: number) => {
      const p1 = new THREE.Vector3(...glassPoint(a[0], rad(a[1])));
      const p2 = new THREE.Vector3(...glassPoint(b[0], rad(b[1])));
      const n = p2.clone().sub(p1).cross(refCam.position.clone().sub(p1)).normalize();
      return { p: p1, n, w: new THREE.Vector3(w, i, a[0]) };
    };
    const laid = [
      lay([-0.26, 28], [-1.19, 75], LOOK.streakWidth, LOOK.streakIntensity),
      lay([-0.3, -30], [-1.4, -66], LOOK.streakWidth * 0.3, LOOK.sideLineIntensity),
    ];
    const off = new THREE.Vector3(0, 0, 0);
    const strips = [
      { n: new THREE.Vector3(1, 0, 0), c: new THREE.Vector3(0, 1, 0), colour: off, p: new THREE.Vector3(1, 2, 0) },
      { n: new THREE.Vector3(1, 0, 0), c: new THREE.Vector3(0, 1, 0), colour: off, p: new THREE.Vector3(1, 2, 0) },
      strip([0.3, 72], [1.0, 80], v3(lin(pal.rimWarm)), 0.03, LOOK.rimIntensity),
      strip([0.3, -78], [1.0, -82], v3(lin(pal.rimWarm)), 0.03, LOOK.rimIntensity * 0.6),
    ];

    // ---- backdrop
    const bgMat = new THREE.ShaderMaterial({
      vertexShader: S.BG_VERT, fragmentShader: S.BG_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        uGlow: { value: v3(lin(pal.bgGlow)).sub(v3(lin(pal.bgBase))).multiplyScalar(0.75) },
        uWarm: { value: v3(lin(pal.bgWarm)).sub(v3(lin(pal.bgBase))).multiplyScalar(0.45) },
        uCentre: { value: new THREE.Vector2(...LOOK.bgGlowCentre) }, uRadius: { value: LOOK.bgGlowRadius },
        uAspect: { value: width / height }, uShift: { value: 0 },
      },
    });
    const bgGeo = new THREE.PlaneGeometry(2, 2);
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.frustumCulled = false;
    bg.renderOrder = -10;
    scene.add(bg);
    disposables.push(bgMat, bgGeo);

    // ---- glass
    const pts: THREE.Vector2[] = [];
    const NP = 220;
    for (let i = 0; i <= NP; i++) {
      const y = SHAPE.lowerBottom + ((SHAPE.upperTop - SHAPE.lowerBottom) * i) / NP;
      pts.push(new THREE.Vector2(glassRadius(y), y));
    }
    const glassGeo = new THREE.LatheGeometry(pts, COUNTS.latheSegments);
    disposables.push(glassGeo);
    const glassMat = (back: boolean) => {
      const m = new THREE.ShaderMaterial({
        vertexShader: S.GLASS_VERT, fragmentShader: S.GLASS_FRAG,
        side: back ? THREE.BackSide : THREE.FrontSide, transparent: true, depthWrite: false,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
        uniforms: {
          uCam, uLN: { value: strips.map((s) => s.n) }, uLC: { value: strips.map((s) => s.c) },
          uLCol: { value: strips.map((s) => s.colour) }, uLP: { value: strips.map((s) => s.p) },
          uFilm: { value: v3(lin(pal.film)) }, uFilmUp: { value: LOOK.filmUpper }, uFilmLo: { value: LOOK.filmLower },
          uKeyDir: { value: keyDir }, uKeyCol: { value: keyCol }, uFresnel: { value: LOOK.fresnel },
          uRim: { value: v3(lin(pal.rimWarm)) }, uBack: { value: back ? 1 : 0 }, uTime, uRimY,
          uLSide: { value: [-1, -1, 1, 1] },
          uSP: { value: laid.map((l) => l.p) }, uSN: { value: laid.map((l) => l.n) }, uSW: { value: laid.map((l) => l.w) },
          uStreakCol: { value: v3(lin(pal.streak)) }, uEdgeLine: { value: LOOK.edgeLine }, uCaustics: { value: LOOK.caustics },
        },
      });
      disposables.push(m);
      return m;
    };
    // LatheGeometry faces outwards when the profile runs bottom to top
    const glassBack = new THREE.Mesh(glassGeo, glassMat(true));
    glassBack.renderOrder = 1;
    const glassFront = new THREE.Mesh(glassGeo, glassMat(false));
    glassFront.renderOrder = 6;
    scene.add(glassBack, glassFront);

    // ---- sand
    const sandMat = (mode: number) => {
      const m = new THREE.ShaderMaterial({
        vertexShader: S.SAND_VERT, fragmentShader: S.SAND_FRAG, side: THREE.DoubleSide,
        uniforms: {
          uLight: { value: v3(lin(pal.sandLight)) }, uDark: { value: v3(lin(pal.sandDark)) },
          uSpark: { value: v3(lin(pal.sparkle)) }, uKeyDir: { value: keyDir }, uKeyCol: { value: keyCol },
          uKeyI: { value: LOOK.keyIntensity }, uFillCol: { value: v3(lin(LOOK.fillColor)) },
          uFillI: { value: LOOK.fillIntensity }, uSheen: { value: LOOK.sheen },
          uSparkle: { value: LOOK.sparkle * (mode === 1 ? 1 : mode === 2 ? 0.6 : 0.7) },
          uGrain: { value: LOOK.grainContrast * (mode === 0 ? 0.6 : 1) }, uCam, uTime,
          uMode: { value: mode }, uFlow: { value: 0 }, uAlpha: { value: 1 }, uTop: { value: mode === 1 ? LOOK.topLight : 0 },
        },
      });
      disposables.push(m);
      return m;
    };
    const bodyMat = sandMat(0), topMat = sandMat(1), streamMat = sandMat(2);
    const body = new THREE.Mesh(new THREE.BufferGeometry(), bodyMat);
    const top = new THREE.Mesh(new THREE.BufferGeometry(), topMat);
    const stream = new THREE.Mesh(new THREE.BufferGeometry(), streamMat);
    body.renderOrder = top.renderOrder = stream.renderOrder = 3;
    scene.add(body, top, stream);

    // ---- collar pieces either side of the neck (kept side-on to the camera)
    const collarMat = new THREE.ShaderMaterial({
      vertexShader: S.SAND_VERT, fragmentShader: S.COLLAR_FRAG,
      uniforms: {
        uBase: { value: v3(lin(pal.hardware)) }, uAccent: { value: v3(lin(pal.accent)) },
        uKeyDir: { value: keyDir }, uKeyCol: { value: keyCol }, uCam,
      },
    });
    const collarGeo = new THREE.SphereGeometry(1, 40, 24);
    const collars = [-1, 1].map((sgn) => {
      const m = new THREE.Mesh(collarGeo, collarMat);
      m.scale.set(0.17, 0.1, 0.13);
      m.renderOrder = 2;
      scene.add(m);
      return { m, sgn };
    });
    disposables.push(collarMat, collarGeo);

    // ---- grains stuck to the glass
    const rs = mulberry32(SEED + 3);
    const nSp = COUNTS.upperSpecks + COUNTS.lowerSpecks;
    const sp = new Float32Array(nSp * 3);
    const si = new Float32Array(nSp * 4);
    const gauss = () => (rs() + rs() + rs() - 1.5) * 1.2;
    let cy = 0, cphi = 0, left = 0;
    for (let i = 0; i < nSp; i++) {
      const upper = i < COUNTS.upperSpecks;
      let y: number, phi: number;
      if (upper) {
        if (left <= 0) { cy = 0.25 + rs() * 1.35; cphi = rs() * Math.PI * 2; left = 6 + Math.floor(rs() * 34); }
        left--;
        y = cy + gauss() * 0.045; phi = cphi + (gauss() * 0.1) / Math.max(glassRadius(cy), 0.2);
      } else {
        y = -0.12 - Math.pow(rs(), 0.8) * 2.6; phi = rs() * Math.PI * 2;
        if (i % 3 === 0) { y = -1.15 - rs() * 0.5; phi = Math.PI + (rs() - 0.5) * 2.4; } // glitter lying low on the far side
      }
      const p = glassPoint(y, phi);
      sp.set([p[0] * 0.985, p[1], p[2] * 0.985], i * 3);
      si.set([rs(), upper ? 0.016 + rs() * 0.03 : 0.004 + rs() * rs() * 0.012, upper ? 1 : 0, upper ? 0.35 + rs() * 0.65 : 0.1 + rs() * rs() * 0.8], i * 4);
    }
    const speckGeo = new THREE.BufferGeometry();
    speckGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    speckGeo.setAttribute("aInfo", new THREE.BufferAttribute(si, 4));
    const speckMat = new THREE.ShaderMaterial({
      vertexShader: S.SPECK_VERT, fragmentShader: S.SPECK_FRAG, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uResY: { value: height }, uRimY, uTime, uCam, uCol: { value: v3(lin(pal.sparkle)) }, uE: { value: LOOK.speckIntensity } },
    });
    const specks = new THREE.Points(speckGeo, speckMat);
    specks.frustumCulled = false;
    specks.renderOrder = 4;
    scene.add(specks);
    disposables.push(speckGeo, speckMat);

    // ---- star glints
    const glintGeo = new THREE.InstancedBufferGeometry();
    glintGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    glintGeo.setIndex([0, 1, 2, 0, 2, 3]);
    const rg = mulberry32(SEED + 9);
    const allGlints = [...GLINTS];
    for (let i = 0; i < COUNTS.tinyGlints; i++) {
      allGlints.push({ y: -0.2 - rg() * 1.25, phi: -4 - rg() * 34, size: 0.06 + rg() * 0.1, seed: rg() });
    }
    const gp = new Float32Array(allGlints.length * 3);
    const gi = new Float32Array(allGlints.length * 3);
    allGlints.forEach((g, i) => {
      gp.set(g.fixed ?? glassPoint(g.y, rad(g.phi)), i * 3);
      gi.set([g.size, g.seed, g.seed * 2.7], i * 3);
    });
    glintGeo.setAttribute("aPos", new THREE.InstancedBufferAttribute(gp, 3));
    glintGeo.setAttribute("aInfo", new THREE.InstancedBufferAttribute(gi, 3));
    glintGeo.instanceCount = allGlints.length;
    const glintMat = new THREE.ShaderMaterial({
      vertexShader: S.GLINT_VERT, fragmentShader: S.GLINT_FRAG, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uSize: { value: LOOK.glintSize }, uTime, uCam, uCore: { value: v3(lin(pal.glintCore)) },
        uRays: { value: v3(lin(pal.glintRays)) }, uE: { value: LOOK.glintIntensity },
      },
    });
    const glints = new THREE.Mesh(glintGeo, glintMat);
    glints.frustumCulled = false;
    glints.renderOrder = 8;
    scene.add(glints);
    disposables.push(glintGeo, glintMat);

    const rim0 = sandState(0).rimY;
    const swap = (mesh: THREE.Mesh, geo: THREE.BufferGeometry) => {
      mesh.geometry.dispose();
      mesh.geometry = geo;
    };

    const render = (frame: number) => {
      const t = frame / FPS;
      uTime.value = t;
      const az = camAt(cameraKeys, t, camera);
      uCam.value.copy(camera.position);
      bgMat.uniforms.uShift.value = az * 0.12;

      // sand level
      const sand = sandState(t);
      const { apex, rimR, rimY } = sand;
      const has = t < TIMING.sandEmpty && rimR > 0.02;
      uRimY.value = has ? rimY : -0.2;
      body.visible = top.visible = has;
      if (has) {
        const bp: THREE.Vector2[] = [];
        const y0 = 0.0;
        for (let i = 0; i <= 48; i++) {
          const y = y0 + ((rimY - y0) * i) / 48;
          bp.push(new THREE.Vector2(glassRadius(y) * 0.982, y));
        }
        swap(body, new THREE.LatheGeometry(bp, 120));
        const tp: THREE.Vector2[] = [];
        const rr = rimR * 0.982;
        for (let i = 0; i <= 40; i++) {
          const r = Math.max((rr * i) / 40, 1e-4);
          const y = i === 40 ? rimY : Math.min(Math.max(sandSurface(sand, r / 0.982), -0.04), rimY);
          tp.push(new THREE.Vector2(r, y));
        }
        swap(top, new THREE.LatheGeometry(tp, 120));
        bodyMat.uniforms.uFlow.value = rim0 - rimY;
        topMat.uniforms.uFlow.value = t * 0.06;
      }

      // stream
      const after = Math.max(0, t - TIMING.sandEmpty);
      const sTop = Math.min(apex, 0.06) + 0.02 - 0.5 * TIMING.streamFallGravity * after * after;
      const sBot = -4.4;
      stream.visible = sTop > sBot + 0.01;
      if (stream.visible) {
        const thin = 1 - 0.5 * smoothstep(TIMING.streamThinStart, TIMING.sandEmpty, t);
        const r = SHAPE.streamRadius * thin * (1 + 0.03 * Math.sin(t * 9.1) + 0.02 * Math.sin(t * 23.7));
        const g = new THREE.CylinderGeometry(r, r * 1.08, sTop - sBot, 48, 1, true);
        g.translate(0, (sTop + sBot) / 2, 0);
        swap(stream, g);
        streamMat.uniforms.uFlow.value = t * 2.6;
      }

      // collar pieces stay left and right of the neck as seen from the camera
      for (const c of collars) {
        c.m.position.set(Math.cos(az) * 0.25 * c.sgn, 0.0, -Math.sin(az) * 0.25 * c.sgn);
      }

      renderer.setRenderTarget(post.sceneRT);
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      renderer.render(scene, camera);
      post.render(POST, frame, camera, camera.position.length());
    };

    return {
      render,
      dispose: () => {
        [body, top, stream].forEach((m) => m.geometry.dispose());
        disposables.forEach((d) => d.dispose());
        post.dispose();
      },
    };
  };
