import * as THREE from "three";
import type { SceneFactory } from "../engine/Stage";
import { PostFX, keys, rng, smooth, clamp01 } from "../engine/post";
import { BG_FRAG, BG_VERT, BUBBLE_FRAG, BUBBLE_VERT, CELL_FRAG, CELL_VERT, DROP_FRAG, DROP_VERT, GLOW_FRAG, GLOW_VERT, MEMBRANE_FRAG, MEMBRANE_VERT } from "./shaders";

export type Variant = "reference" | "camera";

/** Layer spacing and where the water drop hits the top layer (world units, 1 = one cell). */
const H = 6.5;
const IMPACT = new THREE.Vector3(0.5, H + 0.34, -4.0);
const LAYER_Y = [H, 0, -H];
const ROWS = 18;
/** The bottom layer sticks out a little so it peeks out under the middle one. */
const LAYER_Z = [0, 0, 3];
const X_MIN = -48;
const X_MAX = 26;

type CamState = { pos: number[]; target: number[]; roll: number; fov: number; focus: number };

/**
 * V1: matches the reference: strongly rolled camera that starts just above the
 * top cell layer, sinks through its edge and then bobs between the two layers.
 */
function cameraReference(f: number): CamState {
  // [frame, camX, camY/H, camZ, targetY/H]
  const k = keys(f, [
    [0, 2.0, 1.22, 6.9, 1.03],
    [18, 2.0, 1.17, 7.0, 0.99],
    [32, 1.9, 0.98, 7.8, 0.86],
    [46, 1.8, 0.50, 8.4, 0.47],
    [62, 1.7, 0.38, 8.5, 0.39],
    [76, 1.6, 0.48, 8.4, 0.43],
    [92, 1.5, 0.66, 8.0, 0.53],
    [108, 1.5, 0.48, 8.3, 0.45],
    [126, 1.6, 0.38, 8.5, 0.39],
    [142, 1.5, 0.54, 8.2, 0.45],
    [158, 1.4, 0.68, 7.9, 0.53],
    [174, 1.4, 0.50, 8.1, 0.45],
    [196, 1.3, 0.34, 8.0, 0.37],
    [226, 1.2, 0.26, 7.8, 0.34],
  ]);
  return {
    pos: [k[0], k[1] * H, k[2]],
    target: [0.2, k[3] * H, -7],
    roll: -0.56,
    fov: 32,
    focus: 9.6,
  };
}

/**
 * V2: alternative camera. Level horizon, frontal view: a slow crane-down from
 * above the top layer into the gap between the layers followed by a steady
 * dolly-in with a gentle lateral arc. Same scene, timing and palette.
 */
function cameraAlternative(f: number): CamState {
  // [frame, camX, camY/H, camZ, targetX, targetY/H, targetZ]
  const k = keys(f, [
    [0, -3.2, 1.62, 10.5, 0.4, 1.12, -4.6],
    [20, -2.9, 1.5, 10.0, 0.4, 1.06, -4.6],
    [42, -2.2, 1.02, 9.2, 0.4, 0.8, -4.8],
    [62, -1.4, 0.62, 8.4, 0.4, 0.52, -5],
    [100, 0.0, 0.52, 6.6, 0.5, 0.48, -6],
    [150, 1.8, 0.5, 4.6, 0.6, 0.46, -8],
    [200, 3.0, 0.5, 3.9, 0.4, 0.46, -10],
    [226, 3.4, 0.5, 3.4, 0.3, 0.46, -11],
  ]);
  const camPos = [k[0], k[1] * H, k[2]];
  const dist = Math.hypot(camPos[0] - IMPACT.x, camPos[2] - IMPACT.z);
  return {
    pos: camPos,
    target: [k[3], k[4] * H, k[5]],
    roll: 0.06 * Math.sin(f / 60),
    fov: 40,
    focus: Math.max(4.5, dist),
  };
}

type Bubble = { birth: number; life: number; x: number; z: number; r: number; ph: number; speed: number; inDrop: number };

export const createHydrationScene =
  (variant: Variant): SceneFactory =>
  ({ renderer, pixelWidth, pixelHeight }) => {
    const post = new PostFX(renderer, pixelWidth, pixelHeight);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, pixelWidth / pixelHeight, 0.5, 140);
    const rand = rng(variant === "reference" ? 7 : 7);

    // ---------- background (soft radial studio glow) ----------
    const bgMat = new THREE.ShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
      uniforms: {
        uAspect: { value: pixelWidth / pixelHeight },
        uCenter: { value: new THREE.Vector2(0.62, 0.55) },
        uWarm: { value: 0 },
        uTime: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
    bg.frustumCulled = false;
    bg.renderOrder = -10;
    scene.add(bg);

    // ---------- cells: 3 instanced layers ----------
    const offsets: number[] = [];
    const rnds: number[] = [];
    const layers: number[] = [];
    // every layer is a long strip of cells: 15 rows deep, running along x
    for (let L = 0; L < 3; L++) {
      for (let iz = 0; iz < ROWS; iz++) {
        for (let x = X_MIN; x <= X_MAX; x++) {
          offsets.push(x, LAYER_Y[L], LAYER_Z[L] - iz);
          rnds.push(rand(), rand(), rand(), rand());
          layers.push(L);
        }
      }
    }
    const count = layers.length;
    const sphere = new THREE.SphereGeometry(1, 40, 26);
    const cellGeo = new THREE.InstancedBufferGeometry();
    cellGeo.index = sphere.index;
    cellGeo.setAttribute("position", sphere.getAttribute("position"));
    cellGeo.setAttribute("normal", sphere.getAttribute("normal"));
    cellGeo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(new Float32Array(offsets), 3));
    cellGeo.setAttribute("aRnd", new THREE.InstancedBufferAttribute(new Float32Array(rnds), 4));
    cellGeo.setAttribute("aLayer", new THREE.InstancedBufferAttribute(new Float32Array(layers), 1));
    cellGeo.instanceCount = count;
    const cellMat = new THREE.ShaderMaterial({
      vertexShader: CELL_VERT,
      fragmentShader: CELL_FRAG,
      uniforms: {
        uImpact: { value: IMPACT.clone() },
        uShape: { value: new THREE.Vector3() },
        uTone: { value: new THREE.Vector3() },
        uFrame: { value: 0 },
        uLightDir: { value: new THREE.Vector3(0.45, 0.75, -0.5).normalize() },
        uFog: { value: new THREE.Color() },
      },
    });
    const cells = new THREE.Mesh(cellGeo, cellMat);
    cells.frustumCulled = false;
    scene.add(cells);

    // ---------- membrane sheet on top of the upper layer ----------
    const memMat = new THREE.ShaderMaterial({
      vertexShader: MEMBRANE_VERT,
      fragmentShader: MEMBRANE_FRAG,
      uniforms: {
        uImpact: { value: IMPACT.clone() },
        uFade: { value: 0 },
        uPulse: { value: 0 },
        uRipple: { value: 0 },
      },
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    const memGeo = new THREE.BoxGeometry(X_MAX - X_MIN + 1.3, 0.1, ROWS + 0.25, 1, 1, 1);
    const membrane = new THREE.Mesh(memGeo, memMat);
    membrane.position.set((X_MAX + X_MIN) / 2, H + 0.29, -(ROWS - 1) / 2);
    membrane.renderOrder = 1;
    scene.add(membrane);

    // ---------- water drop ----------
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 48; i++) {
      const th = (i / 48) * Math.PI;
      const r = Math.sin(th) * Math.pow(Math.sin(th / 2), 1.0) * 1.0;
      // tall pointed tip
      const y = Math.cos(th) * (th < Math.PI / 2 ? 1.55 : 1.0);
      pts.push(new THREE.Vector2(Math.max(r, 0.0001), y));
    }
    pts.reverse();
    const dropGeo = new THREE.LatheGeometry(pts, 64);
    dropGeo.computeVertexNormals();
    const dropMat = new THREE.ShaderMaterial({
      vertexShader: DROP_VERT,
      fragmentShader: DROP_FRAG,
      uniforms: { uAlpha: { value: 1 }, uLightDir: { value: new THREE.Vector3(0.5, 0.7, 0.5).normalize() } },
      transparent: true,
      // writes depth so the depth-of-field pass keeps the drop in focus
      depthWrite: true,
    });
    const drop = new THREE.Mesh(dropGeo, dropMat);
    drop.renderOrder = 3;
    scene.add(drop);

    // ---------- bubbles ----------
    const bubbles: Bubble[] = [];
    const brand = rng(21);
    // bubbles carried inside the drop
    for (let i = 0; i < 14; i++) {
      bubbles.push({ birth: -1, life: 1, x: brand() * 2 - 1, z: brand() * 2 - 1, r: 0.035 + brand() * 0.07, ph: brand(), speed: 0, inDrop: 1 });
    }
    // bursts released under the membrane, trickling until ~f195
    const bursts = [
      [30, 34],
      [58, 14],
      [84, 16],
      [112, 16],
      [138, 18],
      [162, 12],
    ];
    for (const [start, n] of bursts) {
      for (let i = 0; i < n; i++) {
        const a = brand() * Math.PI * 2;
        const rr = Math.sqrt(brand()) * 1.05;
        bubbles.push({
          birth: start + brand() * 16,
          life: 46 + brand() * 30,
          x: Math.cos(a) * rr,
          z: Math.sin(a) * rr * 0.8,
          r: 0.07 + Math.pow(brand(), 2.0) * 0.2,
          ph: brand(),
          speed: 0.8 + brand() * 0.5,
          inDrop: 0,
        });
      }
    }
    const bubGeo = new THREE.SphereGeometry(1, 24, 16);
    const bubMat = new THREE.ShaderMaterial({
      vertexShader: BUBBLE_VERT,
      fragmentShader: BUBBLE_FRAG,
      uniforms: { uLightDir: { value: new THREE.Vector3(0.5, 0.7, 0.5).normalize() } },
      transparent: true,
      depthWrite: true,
    });
    const bubMesh = new THREE.InstancedMesh(bubGeo, bubMat, bubbles.length);
    bubMesh.frustumCulled = false;
    bubMesh.renderOrder = 2;
    const bubAlpha = new Float32Array(bubbles.length);
    bubGeo.setAttribute("aAlpha", new THREE.InstancedBufferAttribute(bubAlpha, 1));
    scene.add(bubMesh);

    // ---------- impact glow (additive billboards) ----------
    const glowMat = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      uniforms: { uIntensity: { value: 0 }, uColor: { value: new THREE.Color(1, 1, 1) } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
    glow.renderOrder = 5;
    scene.add(glow);
    const glow2Mat = glowMat.clone();
    const glow2 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glow2Mat);
    glow2.renderOrder = 5;
    scene.add(glow2);

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v3 = new THREE.Vector3();
    const s3 = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    const up = new THREE.Vector3();

    const render = (frame: number) => {
      const f = frame;
      // ----- camera -----
      const c = variant === "reference" ? cameraReference(f) : cameraAlternative(f);
      camera.fov = c.fov;
      camera.position.set(c.pos[0], c.pos[1], c.pos[2]);
      v3.set(c.target[0], c.target[1], c.target[2]);
      fwd.copy(v3).sub(camera.position).normalize();
      up.set(0, 1, 0).applyAxisAngle(fwd, c.roll);
      camera.up.copy(up);
      camera.lookAt(v3);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      // ----- hydration waves: [frame, top, middle, bottom] radius in cells -----
      const shape = keys(f, [
        [50, -6, -6, -6],
        [68, -1, -3.5, -6],
        [80, 6.5, -1, -6],
        [100, 15, 3.2, -6],
        [125, 34, 6.0, -6],
        [150, 70, 8.6, -4],
        [172, 90, 12.5, 4],
        [190, 90, 20, 16],
        [206, 90, 44, 40],
        [220, 90, 90, 90],
      ]);
      const tone = keys(f, [
        [44, -8, -8, -8],
        [58, 2, 0, -8],
        [74, 18, 7, 0],
        [96, 50, 15, 8],
        [126, 110, 28, 20],
        [160, 140, 60, 50],
        [190, 140, 130, 120],
      ]);
      cellMat.uniforms.uShape.value.set(shape[0], shape[1], shape[2]);
      cellMat.uniforms.uTone.value.set(tone[0], tone[1], tone[2]);
      cellMat.uniforms.uFrame.value = f;
      const hyd = smooth(60, 200, f);
      (cellMat.uniforms.uFog.value as THREE.Color).setRGB(0.83 + 0.02 * hyd, 0.9 + 0.03 * hyd, 0.96 + 0.01 * hyd);

      // ----- background -----
      bgMat.uniforms.uWarm.value = smooth(190, 226, f) * (variant === "reference" ? 1 : 0.5);
      bgMat.uniforms.uTime.value = f / 226;
      (bgMat.uniforms.uCenter.value as THREE.Vector2).set(0.63 - 0.03 * Math.sin(f / 48), 0.55 + 0.03 * Math.cos(f / 61));

      // ----- membrane -----
      memMat.uniforms.uFade.value = smooth(58, 92, f);
      memMat.uniforms.uPulse.value = keys(f, [[12, 0], [22, 1], [36, 0.55], [60, 0.2], [90, 0]])[0];
      memMat.uniforms.uRipple.value = clamp01((f - 17) / 50);
      membrane.visible = f < 93;

      // ----- drop -----
      const dk = keys(f, [
        // [frame, height above impact, squash-y, widen, alpha]
        [0, 2.35, 1.04, 0.98, 1],
        [10, 1.6, 1.06, 0.97, 1],
        [18, 1.0, 1.0, 1.0, 1],
        [24, 0.52, 0.86, 1.08, 1],
        [32, 0.05, 0.7, 1.06, 0.9],
        [40, -0.5, 0.5, 0.9, 0.0],
      ]);
      const dropR = 0.98;
      drop.visible = f < 41;
      drop.position.set(IMPACT.x, IMPACT.y + dk[0], IMPACT.z);
      drop.scale.set(dropR * dk[2], dropR * dk[1], dropR * dk[2]);
      // slight lean, like the reference drop
      drop.rotation.set(0, 0, -0.22 + 0.03 * Math.sin(f / 7));
      dropMat.uniforms.uAlpha.value = clamp01(dk[3]);

      // ----- bubbles -----
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        let alpha = 0;
        if (b.inDrop) {
          const wob = Math.sin(f * 0.21 + b.ph * 20) * 0.04;
          v3.set(b.x * 0.42 + wob, -0.25 + b.z * 0.4 + ((f * 0.012 + b.ph) % 0.5) * 0.5, b.ph * 0.5 - 0.1);
          v3.multiply(drop.scale).add(drop.position);
          alpha = drop.visible ? clamp01(dk[3]) * 0.9 : 0;
          s3.setScalar(b.r * (drop.visible ? 1 : 0.0001));
        } else {
          const age = f - b.birth;
          if (age >= 0 && age <= b.life) {
            const u = age / b.life;
            // ease-out sink from under the membrane to the layer below
            const fall = (1 - Math.pow(1 - u, 1.7)) * (H - 0.95) * Math.min(1, b.speed);
            const spreadK = 0.55 + u * 0.9;
            v3.set(
              IMPACT.x + b.x * spreadK + Math.sin(age * 0.11 + b.ph * 30) * 0.14,
              H - 0.55 - fall,
              IMPACT.z + b.z * spreadK + Math.cos(age * 0.09 + b.ph * 17) * 0.14,
            );
            const grow = smooth(0, 0.12, u);
            const fade = 1 - smooth(0.8, 1, u);
            alpha = grow * fade;
            s3.setScalar(b.r * (0.4 + 0.6 * grow) * (0.85 + 0.15 * fade));
          } else {
            v3.set(0, -100, 0);
            s3.setScalar(0.0001);
          }
        }
        bubAlpha[i] = alpha;
        m4.compose(v3, q, s3);
        bubMesh.setMatrixAt(i, m4);
      }
      bubMesh.instanceMatrix.needsUpdate = true;
      (bubGeo.getAttribute("aAlpha") as THREE.InstancedBufferAttribute).needsUpdate = true;

      // ----- glows -----
      const gI = keys(f, [[12, 0], [22, 1], [34, 0.6], [48, 0.28], [80, 0.1], [110, 0]])[0];
      glow.position.copy(IMPACT).add(v3.set(0, 0.15, 0));
      glow.quaternion.copy(camera.quaternion);
      glow.scale.setScalar(4.2 + 2.5 * smooth(14, 40, f));
      glowMat.uniforms.uIntensity.value = gI * 0.95;
      (glowMat.uniforms.uColor.value as THREE.Color).setRGB(0.9, 0.98, 1.0);
      // soft aqua bloom where the bubbles are absorbed by the middle layer
      const g2 = keys(f, [[50, 0], [64, 0.5], [120, 0.55], [170, 0.5], [200, 0.2], [215, 0]])[0];
      glow2.position.set(IMPACT.x, 0.7, IMPACT.z);
      glow2.quaternion.copy(camera.quaternion);
      glow2.scale.setScalar(5.5);
      glow2Mat.uniforms.uIntensity.value = g2 * 0.28;
      (glow2Mat.uniforms.uColor.value as THREE.Color).setRGB(0.7, 0.97, 1.0);

      post.render(scene, camera, {
        focus: c.focus,
        aperture: 0.012,
        maxCoc: 0.015,
        bloomStrength: 0.22,
        bloomThreshold: 0.93,
        vignette: 0.16,
        grain: 0.008,
        seed: f,
        toneMap: false,
        exposure: 1,
        contrast: 1.0,
        saturation: 1.0,
      });
    };

    return {
      render,
      dispose: () => {
        post.dispose();
        sphere.dispose();
        cellGeo.dispose();
        cellMat.dispose();
        memGeo.dispose();
        memMat.dispose();
        dropGeo.dispose();
        dropMat.dispose();
        bubGeo.dispose();
        bubMat.dispose();
        glowMat.dispose();
        glow2Mat.dispose();
        bgMat.dispose();
      },
    };
  };
