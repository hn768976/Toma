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
const SPEED = 0.95; // world units per second
const PANEL_TILT = -0.55; // panels lean back like stacked, slanted floors
const PANEL_SLOTS = 22;
const SPRITE_COUNT = 1400;
const RISE = 0.42;

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
        vec3 col = mix(deep, mid, pow(v, 1.4));
        // elliptical glow hugging the top-centre
        vec2 d = vec2((vUv.x - 0.5) * aspect * 0.55, (vUv.y - 1.04) * 1.6);
        float g = exp(-dot(d, d) * 4.5);
        col = mix(col, glow, clamp(g, 0.0, 1.0) * 0.7);
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
    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 200);

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
      const perSlot = 4;
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
          baseOpacity: rng.range(0.45, 0.95),
          x: rng.range(-34, 34),
          y: rng.range(-11, 7),
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
        x: rng.range(-30, 30),
        y: rng.range(-11, 8),
        size: rng.range(sizeMin, sizeMax) * (rng.chance(0.06) ? 2.6 : 1),
        color: rng.pick(colorChoices).clone(),
        phase: rng.range(0, Math.PI * 2),
        rate: rng.range(0.4, 1.4),
        spin: rng.range(-0.05, 0.05),
      }));
      mesh.setColorAt(0, items[0].color);
      return { mesh, items };
    };
    const spriteSets = [
      makeSet(spriteTex.fill, Math.round(SPRITE_COUNT * 0.6), 0.1, 0.4),
      makeSet(spriteTex.outline, Math.round(SPRITE_COUNT * 0.25), 0.15, 0.5),
      makeSet(spriteTex.cross, Math.round(SPRITE_COUNT * 0.15), 0.12, 0.26),
    ];

    // Post-processing
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(1);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      palette.bloomStrength,
      0.55,
      0.42,
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
      smoothstep(6, 14, d) * (1 - smoothstep(FIELD_DEPTH * 0.62, FIELD_DEPTH, d));
    const wrap = (d0: number, t: number) =>
      (((d0 - SPEED * t) % FIELD_DEPTH) + FIELD_DEPTH) % FIELD_DEPTH;

    const render = (frame: number) => {
      const t = frame / fps;

      // Slow, floating drift: a gentle sway and rise while flying forward.
      camera.position.set(
        Math.sin(t * 0.33) * 0.9,
        0.6 + t * 0.06 + Math.sin(t * 0.21 + 1.0) * 0.3,
        0,
      );
      camera.rotation.set(
        0.06 + Math.sin(t * 0.27) * 0.02,
        Math.sin(t * 0.18 + 0.4) * 0.035,
        Math.sin(t * 0.23) * 0.012,
      );
      camera.updateMatrixWorld();

      for (const p of panels) {
        const d = wrap(p.d0, t);
        // The field rises with distance so text fills the frame up to the top.
        p.mesh.position.set(p.x * (0.6 + d / 60), p.y + d * RISE, -d);
        const f = depthFade(d);
        const k = Math.min(1, d / (FIELD_DEPTH * 0.7));
        tmpCol.copy(nearCol).lerp(farCol, k);
        p.mesh.material.color.copy(tmpCol);
        p.mesh.material.opacity = p.baseOpacity * f;
        p.mesh.visible = f > 0.001;
      }

      for (const set of spriteSets) {
        set.items.forEach((it, i) => {
          const d = wrap(it.d0, t);
          const twinkle = 0.55 + 0.45 * Math.sin(t * it.rate * 2.2 + it.phase);
          const f = depthFade(d) * twinkle;
          pos.set(it.x * (0.6 + d / 60), it.y + d * RISE, -d);
          e.set(PANEL_TILT * 0.55, 0, it.spin * t);
          q.setFromEuler(e);
          scl.set(it.size, it.size, 1);
          m4.compose(pos, q, scl);
          set.mesh.setMatrixAt(i, m4);
          tmpCol.copy(it.color).multiplyScalar(f * 0.55);
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
        [spriteTex.fill, spriteTex.outline, spriteTex.cross].forEach((tx) => tx.dispose());
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
