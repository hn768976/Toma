import * as THREE from "three";
import {
  CAMERA_FOV, CAMERA_KEYS, COUNTS, FPS, Palette, SEED, SIZES, TIMING,
} from "../config";
import { PostChain } from "../lib/post";
import { keyframes, mulberry32, smoothstep } from "../lib/rng";
import type { StageContext, StageScene } from "../lib/ThreeStage";
import { LOOK, POST } from "../look";
import { buildBoard } from "./board";
import * as S from "./shaders";

const lin = (hex: string) => new THREE.Color(hex); // three converts sRGB hex -> linear working space
const v3 = (c: THREE.Color, k = 1) => new THREE.Vector3(c.r * k, c.g * k, c.b * k);

const camKey = (k: keyof (typeof CAMERA_KEYS)[number], t: number) =>
  keyframes(CAMERA_KEYS.map((c) => [c.t, c[k]] as [number, number]), t);

export const createChipScene =
  (pal: Palette) =>
  (ctx: StageContext): StageScene => {
    const { renderer, width, height } = ctx;
    const post = new PostChain(renderer, width, height, true);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.3, 90);
    const board = buildBoard();
    const disposables: { dispose: () => void }[] = [];
    const additive = {
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    } as const;

    // ---- shared uniforms
    const uCam = { value: new THREE.Vector3() };
    const uTime = { value: 0 };
    const uFogD = { value: LOOK.fogDensity };
    const uResY = { value: height };
    const boardUniforms = () => ({
      uBase: { value: v3(lin(pal.boardBase)) },
      uAmbient: { value: v3(lin(pal.boardAmbient), LOOK.ambient) },
      uKeyCol: { value: v3(lin(pal.keyLight).lerp(new THREE.Color(...pal.keyNeutral), LOOK.keyBoardNeutral)) },
      uKeyI: { value: LOOK.keyLightIntensity },
      uKeyR: { value: LOOK.keyLightRadius },
      uKeyPos: { value: new THREE.Vector3(0, LOOK.keyLightHeight, 0) },
      uBeamCol: { value: v3(lin(pal.beamLight)) },
      uBeamI: { value: 0 },
      uBeamR: { value: LOOK.beamLightRadius },
      uCam,
      uFog: { value: v3(lin(pal.fog)) },
      uFogD,
      uPlane: { value: 0 },
    });

    // ---- ground plane
    const planeMat = new THREE.ShaderMaterial({
      vertexShader: S.BOARD_VERT, fragmentShader: S.BOARD_FRAG, uniforms: boardUniforms(),
    });
    planeMat.uniforms.uPlane.value = 1;
    const planeGeo = new THREE.PlaneGeometry(SIZES.boardHalf * 2, SIZES.boardHalf * 2);
    planeGeo.rotateX(-Math.PI / 2);
    scene.add(new THREE.Mesh(planeGeo, planeMat));
    disposables.push(planeMat, planeGeo);

    // ---- relief blocks
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    disposables.push(boxGeo);
    const boxMat = new THREE.ShaderMaterial({
      vertexShader: S.BOARD_VERT, fragmentShader: S.BOARD_FRAG, uniforms: boardUniforms(),
    });
    const boxes = new THREE.InstancedMesh(boxGeo, boxMat, board.boxes.length);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    board.boxes.forEach((b, i) => {
      m4.makeScale(b.sx, b.h, b.sz).setPosition(b.x, b.h / 2, b.z);
      boxes.setMatrixAt(i, m4);
      boxes.setColorAt(i, col.setRGB(b.shade, b.shade, b.shade * 1.05));
    });
    boxes.frustumCulled = false;
    scene.add(boxes);
    disposables.push(boxMat);

    // ---- traces
    const segs = board.segments;
    const traceGeo = new THREE.InstancedBufferGeometry();
    traceGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3),
    );
    traceGeo.setIndex([0, 2, 1, 0, 3, 2]);
    const aSeg = new Float32Array(segs.length * 4);
    const aDist = new Float32Array(segs.length * 2);
    const aInfo = new Float32Array(segs.length * 3);
    segs.forEach((s, i) => {
      aSeg.set([s.x0, s.z0, s.x1, s.z1], i * 4);
      aDist.set([s.d0, s.d1], i * 2);
      aInfo.set([s.bright, s.seed, s.width], i * 3);
    });
    traceGeo.setAttribute("aSeg", new THREE.InstancedBufferAttribute(aSeg, 4));
    traceGeo.setAttribute("aDist", new THREE.InstancedBufferAttribute(aDist, 2));
    traceGeo.setAttribute("aInfo", new THREE.InstancedBufferAttribute(aInfo, 3));
    traceGeo.instanceCount = segs.length;
    const traceMat = new THREE.ShaderMaterial({
      vertexShader: S.TRACE_VERT, fragmentShader: S.TRACE_FRAG, ...additive, side: THREE.DoubleSide,
      uniforms: {
        uDim: { value: v3(lin(pal.traceDim)) }, uLit: { value: v3(lin(pal.traceLit)) },
        uDimE: { value: LOOK.traceDimEmissive }, uLitE: { value: LOOK.traceLitEmissive },
        uTime, uWaveT: { value: 0 }, uWaveSpeed: { value: TIMING.traceWaveSpeed },
        uCam, uFogD, uResY, uSettle: { value: 1 },
      },
    });
    const traces = new THREE.Mesh(traceGeo, traceMat);
    traces.frustumCulled = false;
    traces.renderOrder = 2;
    scene.add(traces);
    disposables.push(traceGeo, traceMat);

    // ---- small lit parts
    const partMat = new THREE.ShaderMaterial({
      vertexShader: S.PART_VERT, fragmentShader: S.PART_FRAG,
      uniforms: {
        uColA: { value: v3(lin(pal.component)) }, uColB: { value: v3(lin(pal.bars)) },
        uColC: { value: v3(lin(pal.accent)) }, uColD: { value: v3(lin(pal.traceLit)) },
        uE: { value: LOOK.componentEmissive }, uTime, uCam, uFogD, uOn: { value: 1 },
      },
    });
    const partGeo = new THREE.BoxGeometry(1, 1, 1);
    const aPart = new Float32Array(board.parts.length * 2);
    const parts = new THREE.InstancedMesh(partGeo, partMat, board.parts.length);
    board.parts.forEach((p, i) => {
      m4.makeScale(p.sx, p.h, p.sz).setPosition(p.x, p.h / 2, p.z);
      parts.setMatrixAt(i, m4);
      aPart.set([p.kind, p.seed], i * 2);
    });
    partGeo.setAttribute("aPart", new THREE.InstancedBufferAttribute(aPart, 2));
    parts.frustumCulled = false;
    scene.add(parts);
    disposables.push(partGeo, partMat);

    // ---- chip: neon frame, pins, die
    const frameMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const frameInnerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const fh = SIZES.frameHalf, fw = SIZES.frameWidth;
    const addFrame = (halfSize: number, w: number, mat: THREE.Material, y: number) => {
      const long = new THREE.BoxGeometry(halfSize * 2 + w, 0.012, w);
      const short = new THREE.BoxGeometry(w, 0.012, halfSize * 2 + w);
      disposables.push(long, short);
      [[0, -halfSize, long], [0, halfSize, long], [-halfSize, 0, short], [halfSize, 0, short]].forEach(
        ([x, z, geo]) => {
          const m = new THREE.Mesh(geo as THREE.BufferGeometry, mat);
          m.position.set(x as number, y, z as number);
          scene.add(m);
        },
      );
    };
    addFrame(fh, fw, frameMat, 0.008);
    disposables.push(frameMat, frameInnerMat);

    const pinMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pinGeo = new THREE.BoxGeometry(1, 1, 1);
    const perSide = 24;
    const pins = new THREE.InstancedMesh(pinGeo, pinMat, perSide * 4);
    const rp = mulberry32(SEED + 5);
    let pi = 0;
    for (let side = 0; side < 4; side++)
      for (let k = 0; k < perSide; k++) {
        const u = ((k + 0.5) / perSide - 0.5) * 2 * (SIZES.dieHalf - 0.02);
        const r = SIZES.dieHalf + 0.055;
        const along = 0.03 + rp() * 0.025;
        const x = side === 0 ? r : side === 2 ? -r : u;
        const z = side === 1 ? r : side === 3 ? -r : u;
        const horiz = side % 2 === 0;
        m4.makeScale(horiz ? along : 0.009, 0.01, horiz ? 0.009 : along).setPosition(x, 0.007, z);
        pins.setMatrixAt(pi++, m4);
      }
    scene.add(pins);
    disposables.push(pinMat, pinGeo);

    const dieMat = new THREE.ShaderMaterial({
      vertexShader: S.DIE_VERT, fragmentShader: S.DIE_FRAG,
      uniforms: {
        uGlow: { value: v3(lin(pal.dieGlow)) }, uBeam: { value: v3(lin(pal.beamTop)) },
        uKey: { value: v3(lin(pal.keyLight)) }, uReveal: { value: 0 }, uBeamOn: { value: 0 },
        uE: { value: LOOK.dieEmissive }, uTime, uHeight: { value: 0 }, uTopGlow: { value: 0 },
      },
    });
    const dieGeo = new THREE.BoxGeometry(1, 1, 1);
    const die = new THREE.Mesh(dieGeo, dieMat);
    scene.add(die);
    disposables.push(dieMat, dieGeo);

    // ---- haze
    const hazeMat = new THREE.ShaderMaterial({
      vertexShader: S.HAZE_VERT, fragmentShader: S.HAZE_FRAG, ...additive, depthTest: false,
      uniforms: { uCol: { value: v3(lin(pal.haze)) }, uI: { value: 0 }, uSize: { value: LOOK.hazeSize } },
    });
    const hazeGeo = new THREE.PlaneGeometry(2, 2);
    const haze = new THREE.Mesh(hazeGeo, hazeMat);
    haze.frustumCulled = false;
    haze.renderOrder = 3;
    scene.add(haze);
    disposables.push(hazeMat, hazeGeo);

    // ---- beam
    const makeBeam = (count: number, body: boolean, seed: number) => {
      const r = mulberry32(seed);
      const geo = new THREE.InstancedBufferGeometry();
      const SEG = 24; // rows along the streak so the perspective stays right
      const pos: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i <= SEG; i++) pos.push(-1, i / SEG, 0, 1, i / SEG, 0);
      for (let i = 0; i < SEG; i++) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
      geo.setIndex(idx);
      const aBase = new Float32Array(count * 2);
      const aInf = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) {
        const bh = SIZES.beamHalf * (body ? 0.8 : 1);
        aBase.set([(r() * 2 - 1) * bh, (r() * 2 - 1) * bh], i * 2);
        const w = body ? 0.05 + r() * 0.11 : 0.003 + Math.pow(r(), 3) * 0.012;
        const bright = body ? 0.25 + r() * 0.3 : 0.25 + Math.pow(r(), 1.6) * 0.75;
        aInf.set([w, r(), bright, TIMING.beamStart + r() * TIMING.beamSpread * (body ? 1.3 : 1) + (body ? 0.35 : 0)], i * 4);
      }
      geo.setAttribute("aBase", new THREE.InstancedBufferAttribute(aBase, 2));
      geo.setAttribute("aInfo", new THREE.InstancedBufferAttribute(aInf, 4));
      geo.instanceCount = count;
      const mat = new THREE.ShaderMaterial({
        vertexShader: S.BEAM_VERT, fragmentShader: S.BEAM_FRAG, ...additive, side: THREE.DoubleSide,
        uniforms: {
          uCam, uT: { value: 0 }, uRise: { value: TIMING.beamRiseTime }, uH: { value: SIZES.beamHeight },
          uBaseY: { value: 0 }, uResY, uCore: { value: v3(lin(pal.beamCore)) },
          uTop: { value: v3(lin(pal.beamTop)) }, uHot: { value: v3(lin(pal.beamHot)) },
          uE: { value: LOOK.beamEmissive * (body ? 0.14 : 0.95) }, uTime, uBody: { value: body ? 1 : 0 },
        },
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      scene.add(mesh);
      disposables.push(geo, mat);
      return mat;
    };
    const beamMats = [
      makeBeam(COUNTS.beamBodyStreaks, true, SEED + 11),
      makeBeam(COUNTS.beamStreaks, false, SEED + 12),
    ];

    // ---- dust
    const rd = mulberry32(SEED + 21);
    const dpos = new Float32Array(COUNTS.dust * 3);
    const dinf = new Float32Array(COUNTS.dust * 4);
    for (let i = 0; i < COUNTS.dust; i++) {
      const rad = 0.4 + Math.pow(rd(), 0.8) * 7.5;
      const a = rd() * Math.PI * 2;
      dpos.set([Math.cos(a) * rad, rd() * 4.2, Math.sin(a) * rad], i * 3);
      dinf.set([rd(), 0.004 + rd() * rd() * 0.012, 0.05 + rd() * 0.22, rd()], i * 4);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
    dustGeo.setAttribute("aInfo", new THREE.BufferAttribute(dinf, 4));
    const dustMat = new THREE.ShaderMaterial({
      vertexShader: S.DUST_VERT, fragmentShader: S.DUST_FRAG, ...additive,
      uniforms: {
        uTime, uResY, uFocus: { value: 5 }, uCam, uCol: { value: v3(lin(pal.dust)) }, uE: { value: LOOK.dustEmissive },
      },
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    dust.renderOrder = 5;
    scene.add(dust);
    disposables.push(dustGeo, dustMat);

    const frameCol = lin(pal.frame);
    const pinCol = lin(pal.pins);
    const look = { ...POST, lift: pal.gradeLift, gain: pal.gradeGain };
    const target = new THREE.Vector3();
    const chip = new THREE.Vector3(0, 0.15, 0);

    const render = (frame: number) => {
      const t = frame / FPS;
      uTime.value = t;

      // camera
      const az = THREE.MathUtils.degToRad(camKey("az", t));
      const el = THREE.MathUtils.degToRad(camKey("el", t));
      const dist = camKey("dist", t);
      target.set(camKey("tx", t), camKey("ty", t), camKey("tz", t));
      camera.position.set(
        target.x + dist * Math.sin(az) * Math.cos(el),
        target.y + dist * Math.sin(el),
        target.z + dist * Math.cos(az) * Math.cos(el),
      );
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      camera.rotateZ(THREE.MathUtils.degToRad(camKey("roll", t)));
      camera.updateMatrixWorld(true);
      uCam.value.copy(camera.position);
      const focus = camera.position.distanceTo(chip);
      dustMat.uniforms.uFocus.value = focus;

      // power-up
      const on = 1.0;
      const flash = smoothstep(TIMING.traceWaveStart, TIMING.flashPeak, t) * (1 - smoothstep(TIMING.flashPeak, TIMING.flashPeak + 1.2, t));
      const pulse = 1 + 0.05 * Math.sin(t * 2.3) + 0.03 * Math.sin(t * 5.1 + 1.0);
      const keyI = LOOK.keyLightIntensity * (on + LOOK.flashBoost * flash + 1.1 * smoothstep(5, 12, t)) * pulse;
      const beamOn = smoothstep(TIMING.beamStart + 0.2, TIMING.beamStart + 1.6, t);
      for (const m of [planeMat, boxMat]) {
        m.uniforms.uKeyI.value = keyI;
        m.uniforms.uBeamI.value = LOOK.beamLightIntensity * beamOn;
      }
      frameMat.color.copy(frameCol).multiplyScalar(LOOK.frameEmissive * (on + 0.4 * flash - 0.3 * beamOn) * pulse);
      frameInnerMat.color.copy(frameCol).multiplyScalar(LOOK.frameEmissive * 0.35 * (on + flash));
      const reveal = smoothstep(TIMING.dieRevealStart, TIMING.dieRevealStart + 0.4, t);
      dieMat.uniforms.uTopGlow.value = smoothstep(7, 14, t);
      pinMat.color.copy(pinCol).multiplyScalar(0.7 + 0.5 * reveal * (1 + flash));
      traceMat.uniforms.uWaveT.value = t - TIMING.traceWaveStart;
      traceMat.uniforms.uSettle.value = 1 + 1.4 * flash + 2.5 * smoothstep(4, 10, t);
      hazeMat.uniforms.uI.value = LOOK.hazeIntensity * (on + 1.3 * flash - 0.25 * beamOn + 1.0 * smoothstep(5, 12, t)) * pulse;

      // die
      const rise = smoothstep(TIMING.dieRiseStart, TIMING.dieRiseEnd, t);
      const h = SIZES.dieHeightStart + (SIZES.dieHeightEnd - SIZES.dieHeightStart) * rise;
      die.scale.set(SIZES.dieHalf * 2, h, SIZES.dieHalf * 2);
      die.position.set(0, h / 2, 0);
      dieMat.uniforms.uReveal.value = reveal * (1 + 1.5 * flash);
      dieMat.uniforms.uBeamOn.value = beamOn;
      for (const m of beamMats) {
        m.uniforms.uT.value = t;
        m.uniforms.uBaseY.value = h;
      }

      renderer.setRenderTarget(post.sceneRT);
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      renderer.render(scene, camera);
      post.render(look, frame, camera, focus);
    };

    return {
      render,
      dispose: () => {
        disposables.forEach((d) => d.dispose());
        post.dispose();
      },
    };
  };
