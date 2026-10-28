import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { staticFile } from "remotion";
import { Stage, StageFactory } from "../three/ThreeStage";
import { createRandom, loadFont, smoothstep } from "../three/random";
import { Palette } from "./palettes";
import { FONT_FAMILY, makeCodePanel, makeSpriteTextures } from "./textures";

// Depth of the recycled data field, in world units. Objects travel toward
// the camera and wrap from the near end back to the far end.
const FIELD_DEPTH = 54;
// Camera speed profile (world units / second): a brisk push that eases into
// a slow drift, following the reference's motion.
const SPEED_START = 8.0;
const SPEED_END = 0.6;
const EASE_FROM = 4.6; // seconds
const EASE_TO = 8.6;
const PANEL_TILT = -0.3; // sheets lean back slightly; the view is near-frontal
const PANEL_SLOTS = 14;
const SPRITE_COUNT = 280;
const RISE = 0.1;
const FOV = 50;
// Panels are spread across the view frustum (in units of the half-extent at
// their depth) so every depth layer fills the frame, as in the reference.
const HALF_H = Math.tan((FOV / 2) * (Math.PI / 180));

const backgroundMaterial = (p: Palette) =>
  new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      deep: { value: new THREE.Color(p.bgDeep) },
      mid: { value: new THREE.Color(p.bgMid) },
      glow: { value: new THREE.Color(p.bgGlow) },
      aspect: { value: 16 / 9 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 deep; uniform vec3 mid; uniform vec3 glow; uniform float aspect;
      varying vec2 vUv;
      void main() {
        // vertical falloff toward the bright horizon at the top
        float v = smoothstep(0.0, 1.0, vUv.y);
        vec3 col = mix(deep, mid, 0.8 + 0.1 * v);
        // elliptical glow hugging the top-centre
        vec2 d = vec2((vUv.x - 0.5) * aspect * 0.55, (vUv.y - 1.04) * 1.6);
        float g = exp(-dot(d, d) * 4.5);
        col = mix(col, glow, clamp(g, 0.0, 1.0) * 0.12);
        // darker side edges
        float edge = smoothstep(0.0, 0.5, abs(vUv.x - 0.5));
        col *= 1.0 - edge * 0.45;
        // ordered dither to prevent banding in the smooth gradient
        float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        col += (n - 0.5) / 255.0;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

type Panel = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  d0: number;
  baseOpacity: number;
  x: number;
  y: number;
};

type SpriteSet = {
  mesh: THREE.InstancedMesh;
  items: {
    d0: number;
    x: number;
    y: number;
    size: number;
    color: THREE.Color;
    phase: number;
    rate: number;
    spin: number;
  }[];
};

export const createCodeStreamStage =
  (palette: Palette): StageFactory =>
  async (renderer, { width, height, fps }) => {
    await Promise.all([
      loadFont(FONT_FAMILY, staticFile("fonts/roboto-latin-300-normal.woff2"), "300"),
      loadFont(FONT_FAMILY, staticFile("fonts/roboto-latin-400-normal.woff2"), "400"),
    ]);
    const rng = createRandom(20251027);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 200);
    const aspect = width / height;

    // Background quad
    const bgMat = backgroundMaterial(palette);
    bgMat.uniforms.aspect.value = width / height;
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
    bg.frustumCulled = false;
    bg.renderOrder = -1;
    scene.add(bg);

    // Code panels
    const panelTextures = Array.from({ length: 10 }, () => makeCodePanel(rng));
    const panelGeo = new THREE.PlaneGeometry(26, 13);
    const panels: Panel[] = [];
    for (let s = 0; s < PANEL_SLOTS; s++) {
      const perSlot = 2;
      for (let k = 0; k < perSlot; k++) {
        const mat = new THREE.MeshBasicMaterial({
          map: rng.pick(panelTextures),
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(panelGeo, mat);
        mesh.rotation.order = "YXZ";
        // A slight yaw per panel so the layers don't read as perfectly flat.
        mesh.rotation.y = rng.range(-0.14, 0.14);
        mesh.rotation.x = PANEL_TILT + rng.range(-0.08, 0.08);
        mesh.rotation.z = rng.range(-0.025, 0.025);
        const scale = rng.range(0.75, 1.3);
        mesh.scale.set(scale, scale, 1);
        scene.add(mesh);
        panels.push({
          mesh,
          d0: (s + rng.range(0, 1)) * (FIELD_DEPTH / PANEL_SLOTS),
          baseOpacity: rng.range(0.4, 0.8),
          x: rng.range(-1.25, 1.25),
          y: rng.range(-1.2, 1.2),
        });
      }
    }

    // Floating squares, outlines and crosses (instanced)
    const spriteTex = makeSpriteTextures();
    const spriteGeo = new THREE.PlaneGeometry(1, 1);
    const colorChoices = [
      new THREE.Color(palette.squareA),
      new THREE.Color(palette.squareB),
      new THREE.Color(palette.squareA),
      new THREE.Color(palette.squareB),
      new THREE.Color(palette.accent),
    ];
    const makeSet = (tex: THREE.Texture, count: number, sizeMin: number, sizeMax: number): SpriteSet => {
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.InstancedMesh(spriteGeo, mat, count);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      const items = Array.from({ length: count }, () => ({
        d0: rng.range(0, FIELD_DEPTH),
        x: rng.range(-1.2, 1.2),
        y: rng.range(-1.15, 1.15),
        size: rng.range(sizeMin, sizeMax) * (rng.chance(0.07) ? 2.4 : 1),
        color: rng.pick(colorChoices).clone(),
        phase: rng.range(0, Math.PI * 2),
        rate: rng.range(0.4, 1.4),
        spin: rng.range(-0.05, 0.05),
      }));
      mesh.setColorAt(0, items[0].color);
      return { mesh, items };
    };
    const spriteSets = [
      makeSet(spriteTex.fill, Math.round(SPRITE_COUNT * 0.6), 0.22, 0.55),
      makeSet(spriteTex.outline, Math.round(SPRITE_COUNT * 0.25), 0.3, 0.6),
      makeSet(spriteTex.cross, Math.round(SPRITE_COUNT * 0.15), 0.12, 0.22),
    ];

    // Hero panels: large translucent squares that sweep past the lens
    // around the 4-second mark, like the light-panel fly-by in the reference.
    scene.add(camera);
    const heroColor = new THREE.Color(palette.accent).lerp(new THREE.Color("#ffffff"), 0.2);
    const heroes = [
      // travels straight up through the right-centre of frame, bottom edge to top edge
      { t0: 3.6, t1: 4.34, from: [1.15, -3.0, -4.2], to: [1.15, 4.0, -4.2], w: 3.3, h: 2.7, peak: palette.heroPeak },
    ].map((cfg) => {
      const mat = new THREE.MeshBasicMaterial({
        map: spriteTex.soft,
        color: heroColor,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(spriteGeo, mat);
      mesh.scale.set(cfg.w, cfg.h, 1);
      mesh.rotation.set(-0.25, 0.08, 0.02);
      mesh.renderOrder = 10;
      camera.add(mesh);
      return { ...cfg, mesh, mat };
    });

    // Cumulative travel distance per frame (numeric integral of the speed
    // curve) so the field position stays a pure function of the frame.
    const speedAt = (t: number) =>
      SPEED_END + (SPEED_START - SPEED_END) * (1 - smoothstep(EASE_FROM, EASE_TO, t));
    const travel: number[] = [0];
    const SUB = 8;
    for (let f = 1; f <= Math.ceil(fps * 60); f++) {
      let acc = travel[f - 1];
      for (let k = 0; k < SUB; k++) {
        acc += speedAt((f - 1 + (k + 0.5) / SUB) / fps) / fps / SUB;
      }
      travel.push(acc);
    }

    // Post-processing
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(1);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      palette.bloomStrength,
      0.5,
      0.6,
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const nearCol = new THREE.Color(palette.textNear);
    const farCol = new THREE.Color(palette.textFar);
    const tmpCol = new THREE.Color();
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();

    const depthFade = (d: number) =>
      smoothstep(10, 16, d) * (1 - smoothstep(FIELD_DEPTH * 0.45, FIELD_DEPTH * 0.8, d));
    let dist = 0;
    const wrap = (d0: number) =>
      (((d0 - dist) % FIELD_DEPTH) + FIELD_DEPTH) % FIELD_DEPTH;

    const render = (frame: number) => {
      const t = frame / fps;
      dist = travel[Math.min(frame, travel.length - 1)];

      for (const h of heroes) {
        const u = (t - h.t0) / (h.t1 - h.t0);
        const on = u > 0 && u < 1;
        h.mesh.visible = on;
        if (!on) continue;
        const e2 = u;
        h.mesh.position.set(
          THREE.MathUtils.lerp(h.from[0], h.to[0], e2),
          THREE.MathUtils.lerp(h.from[1], h.to[1], e2),
          THREE.MathUtils.lerp(h.from[2], h.to[2], e2),
        );
        // smooth ramp in and out, like the reference flash (no pop)
        h.mat.opacity = Math.pow(Math.sin(Math.PI * u), 0.5) * h.peak;
      }

      // Slow, floating drift: a gentle sway and rise while flying forward.
      camera.position.set(
        Math.sin(t * 0.33) * 0.9,
        Math.sin(t * 0.21 + 1.0) * 0.3,
        0,
      );
      camera.rotation.set(
        0.06 + Math.sin(t * 0.27) * 0.02,
        Math.sin(t * 0.18 + 0.4) * 0.035,
        Math.sin(t * 0.23) * 0.012,
      );
      camera.updateMatrixWorld();

      for (const p of panels) {
        const d = wrap(p.d0);
        // The field rises with distance so text fills the frame up to the top.
        p.mesh.position.set(p.x * d * HALF_H * aspect, (p.y * HALF_H + RISE) * d, -d);
        const f = depthFade(d);
        const k = Math.min(1, d / (FIELD_DEPTH * 0.7));
        tmpCol.copy(nearCol).lerp(farCol, k);
        p.mesh.material.color.copy(tmpCol);
        // per-layer shimmer, like the flickering code in the reference
        const shimmer = 0.9 + 0.1 * Math.sin(t * (3 + p.baseOpacity * 4) + p.d0 * 1.7);
        p.mesh.material.opacity = p.baseOpacity * f * shimmer;
        p.mesh.visible = f > 0.001;
      }

      for (const set of spriteSets) {
        set.items.forEach((it, i) => {
          const d = wrap(it.d0);
          const twinkle = 0.7 + 0.3 * Math.sin(t * it.rate * 1.6 + it.phase);
          const f = depthFade(d) * twinkle;
          pos.set(it.x * d * HALF_H * aspect, (it.y * HALF_H + RISE) * d, -d);
          e.set(0, 0, 0); // axis-aligned, like the reference
          q.setFromEuler(e);
          // sprite size is a fraction of the frame height at its depth
          const sz = it.size * d * HALF_H * 0.15;
          scl.set(sz, sz, 1);
          m4.compose(pos, q, scl);
          set.mesh.setMatrixAt(i, m4);
          tmpCol.copy(it.color).multiplyScalar(f * 0.85);
          set.mesh.setColorAt(i, tmpCol);
        });
        set.mesh.instanceMatrix.needsUpdate = true;
        if (set.mesh.instanceColor) set.mesh.instanceColor.needsUpdate = true;
      }

      composer.render();
    };

    const stage: Stage = {
      render,
      dispose: () => {
        panelTextures.forEach((tx) => tx.dispose());
        [spriteTex.fill, spriteTex.outline, spriteTex.cross, spriteTex.soft].forEach((tx) => tx.dispose());
        composer.dispose();
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          m.geometry?.dispose();
          const mat = m.material as THREE.Material | undefined;
          mat?.dispose?.();
        });
      },
    };
    return stage;
  };
