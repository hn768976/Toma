import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { StageFactory } from "../lib/ThreeStage";
import { createRandom, type Random } from "../lib/random";
import type { SpherePalette } from "./palette";
import { createGradeShader, StreakPass } from "./post";
import { createStripeTexture } from "./textures";
import {
  track,
  track3,
  WAVE1_ENERGY,
  WAVE1_PATH,
  WAVE2_ENERGY,
  WAVE2_PATH,
  type Key,
  type Vec3Key,
} from "./timeline";

export type SphereSceneOptions = { palette: SpherePalette; seed: number };

type Wave = {
  path: Vec3Key[];
  energy: Key[];
  spread: THREE.Vector3; // ellipsoid radii of the swarm
  count: number;
  shards: number;
  light: THREE.PointLight;
  haze: THREE.Sprite;
};

type Body = {
  wave: number; // index into waves, -1 = straggler
  mesh: THREE.Mesh;
  offset: THREE.Vector3;
  radius: number;
  striped: boolean;
  material: THREE.MeshStandardMaterial | null;
  baseQuat: THREE.Quaternion;
  spinAxis: THREE.Vector3;
  spin: number;
  orbit: number;
  phase: number;
  drift: THREE.Vector3;
};

const randomInEllipsoid = (rand: Random, r: THREE.Vector3) => {
  for (;;) {
    const v = new THREE.Vector3(rand.range(-1, 1), rand.range(-1, 1), rand.range(-1, 1));
    if (v.lengthSq() <= 1) return v.multiply(r);
  }
};
const randomUnit = (rand: Random) => {
  const u = rand.range(-1, 1);
  const a = rand.range(0, Math.PI * 2);
  const s = Math.sqrt(1 - u * u);
  return new THREE.Vector3(s * Math.cos(a), s * Math.sin(a), u);
};

const hazeTexture = () => {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.25, "rgba(255,255,255,0.45)");
  grd.addColorStop(0.6, "rgba(255,255,255,0.08)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

export const createSphereStage =
  (opts: SphereSceneOptions): StageFactory =>
  (renderer, { width, height, fps }) => {
    const { palette } = opts;
    const rand = createRandom(opts.seed);
    renderer.toneMapping = THREE.NoToneMapping; // hard clip keeps neon purples saturated
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(palette.background, 1);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.background);
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);

    // ---------- background contour lines ----------
    const bgMat = new THREE.ShaderMaterial({
      depthWrite: false,
      uniforms: {
        time: { value: 0 },
        base: { value: new THREE.Color(palette.background) },
        line: { value: new THREE.Color(palette.contourLine) },
        aspect: { value: width / height },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float time; uniform vec3 base; uniform vec3 line; uniform float aspect; varying vec2 vUv;
        vec2 h2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return -1.0 + 2.0*fract(sin(p)*43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(dot(h2(i),f), dot(h2(i+vec2(1,0)),f-vec2(1,0)),u.x), mix(dot(h2(i+vec2(0,1)),f-vec2(0,1)), dot(h2(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y); }
        void main(){
          vec2 p = vec2(vUv.x*aspect, vUv.y) * 2.6;
          float n = noise(p + vec2(0.0, time*0.03)) + 0.5*noise(p*2.1 - time*0.02) + 0.25*noise(p*4.3);
          float f = fract(n * 3.2);
          float w = fwidth(n * 3.2) * 1.5 + 0.05;
          float l = smoothstep(w, 0.0, abs(f - 0.5) - 0.06);
          gl_FragColor = vec4(mix(base, line, l), 1.0);
        }`,
    });
    bgMat.extensions = { ...(bgMat.extensions ?? {}), derivatives: true } as never;
    const bgDist = 60;
    const bgH = 2 * bgDist * Math.tan(THREE.MathUtils.degToRad(22.5)) * 1.15;
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(bgH * (width / height), bgH), bgMat);
    bg.position.z = -bgDist;
    bg.renderOrder = -1;
    camera.add(bg);
    scene.add(camera);

    // ---------- lights ----------
    const ambient = new THREE.AmbientLight(palette.fill, 0.7);
    scene.add(ambient);
    const fill = new THREE.DirectionalLight(palette.fill, 1.1);
    fill.position.set(-3, 4, 2);
    scene.add(fill);

    const hazeTex = hazeTexture();
    const mkWave = (path: Vec3Key[], energy: Key[], spread: THREE.Vector3, count: number, shards: number): Wave => {
      const light = new THREE.PointLight(palette.coreLight, 0, 0, 2);
      scene.add(light);
      const haze = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: hazeTex,
          color: palette.coreLight,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
          opacity: 0,
        }),
      );
      haze.scale.setScalar(5);
      scene.add(haze);
      return { path, energy, spread, count, shards, light, haze };
    };
    const waves: Wave[] = [
      mkWave(WAVE1_PATH, WAVE1_ENERGY, new THREE.Vector3(3.0, 1.9, 1.5), 120, 70),
      mkWave(WAVE2_PATH, WAVE2_ENERGY, new THREE.Vector3(2.8, 1.8, 1.5), 105, 60),
    ];

    // ---------- materials & geometry ----------
    const sphereGeo = new THREE.SphereGeometry(1, 72, 48);
    const stripeTextures = palette.stripes.flatMap((set) => [
      createStripeTexture(set, rand),
      createStripeTexture(set, rand),
    ]);
    const darkMat = new THREE.MeshStandardMaterial({
      color: palette.darkSphere,
      roughness: 0.32,
      metalness: 0.0,
      emissive: new THREE.Color(palette.darkSphere).multiplyScalar(0.12),
    });
    // thin irregular flake (a shard of a broken shell)
    const shardGeo = new THREE.BufferGeometry();
    shardGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-1, -0.6, 0, 1, -0.35, 0.05, -0.15, 0.9, -0.05], 3),
    );
    shardGeo.computeVertexNormals();
    const shardMat = new THREE.MeshStandardMaterial({
      color: palette.shard,
      roughness: 0.35,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });

    const bodies: Body[] = [];
    const tmpA = new THREE.Vector3();
    const addBody = (wave: number, offset: THREE.Vector3, radius: number, striped: boolean, shard = false) => {
      let material: THREE.MeshStandardMaterial | null = null;
      let mesh: THREE.Mesh;
      if (shard) {
        mesh = new THREE.Mesh(shardGeo, shardMat);
        mesh.scale.set(radius, radius * rand.range(0.5, 1.0), radius);
      } else if (striped) {
        const tex = rand.pick(stripeTextures);
        material = new THREE.MeshStandardMaterial({
          map: tex,
          emissiveMap: tex,
          emissive: new THREE.Color("#ffffff"),
          emissiveIntensity: 0,
          roughness: 0.42,
          metalness: 0.0,
        });
        mesh = new THREE.Mesh(sphereGeo, material);
        mesh.scale.setScalar(radius);
      } else {
        mesh = new THREE.Mesh(sphereGeo, darkMat);
        mesh.scale.setScalar(radius);
      }
      scene.add(mesh);
      const baseQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), randomUnit(rand));
      bodies.push({
        wave,
        mesh,
        offset,
        radius,
        striped,
        material,
        baseQuat,
        spinAxis: randomUnit(rand),
        spin: rand.range(0.25, 1.1) * (rand.next() < 0.5 ? -1 : 1) * (shard ? 2.5 : 1),
        orbit: rand.range(0.05, 0.16),
        phase: rand.range(0, Math.PI * 2),
        drift: new THREE.Vector3(rand.range(-0.12, 0.12), rand.range(-0.1, 0.1), rand.range(-0.1, 0.1)),
      });
    };

    waves.forEach((w, wi) => {
      for (let i = 0; i < w.count; i++) {
        const off = randomInEllipsoid(rand, w.spread);
        const rr = Math.sqrt(
          (off.x / w.spread.x) ** 2 + (off.y / w.spread.y) ** 2 + (off.z / w.spread.z) ** 2,
        );
        // Glowing spheres sit in the back/centre of the swarm, dark glossy
        // spheres drift in front of them as silhouettes (as in the reference).
        const zN = off.z / w.spread.z;
        const xyN = Math.hypot(off.x / w.spread.x, off.y / w.spread.y);
        let pStripe = zN < -0.15 ? 0.88 : zN < 0.35 ? 0.6 : 0.18;
        if (zN >= 0.35 && xyN < 0.45) pStripe = 0.55;
        pStripe *= 1 - 0.35 * Math.max(0, rr - 0.6);
        const size = rand.next();
        const radius =
          size < 0.1 ? rand.range(0.58, 0.78) : size < 0.62 ? rand.range(0.33, 0.54) : rand.range(0.14, 0.3);
        addBody(wi, off, radius, rand.next() < pStripe);
      }
      for (let i = 0; i < w.shards; i++) {
        // flakes live on the outer shell of the swarm
        const off = randomUnit(rand).multiply(w.spread).multiplyScalar(rand.range(1.0, 1.35));
        addBody(wi, off, rand.range(0.05, 0.15), false, true);
      }
    });
    // Relax overlaps inside each swarm so spheres pack instead of intersecting.
    for (let it = 0; it < 24; it++) {
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        if (a.wave < 0 || !(a.mesh.geometry === sphereGeo)) continue;
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j];
          if (b.wave !== a.wave || !(b.mesh.geometry === sphereGeo)) continue;
          const d = tmpA.subVectors(b.offset, a.offset);
          const len = d.length();
          const min = (a.radius + b.radius) * 0.9;
          if (len < min && len > 1e-5) {
            d.multiplyScalar(((min - len) / len) * 0.5);
            b.offset.add(d);
            a.offset.sub(d);
          }
        }
      }
    }
    // stragglers that catch a little light between the waves
    for (let i = 0; i < 14; i++) {
      const off = new THREE.Vector3(rand.range(-6, 6), rand.range(-3.6, 3.6), rand.range(-12, -5));
      addBody(-1, off, rand.range(0.18, 0.45), rand.next() < 0.3);
    }

    // ---------- post-processing ----------
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const pr = renderer.getPixelRatio();
    const streak = new StreakPass(width * pr, height * pr, new THREE.Color(palette.streakTint), 0.8, 0.75);
    composer.addPass(streak);
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.62, 0.32, 0.85);
    // tint the glow halo with the light colour instead of neutral white
    const tint = new THREE.Color(palette.coreLight);
    bloom.bloomTintColors = bloom.bloomTintColors.map((_, i) =>
      new THREE.Vector3(tint.r, tint.g, tint.b).lerp(new THREE.Vector3(1, 1, 1), i === 0 ? 0.5 : 0.1),
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const grade = new ShaderPass(createGradeShader());
    composer.addPass(grade);

    const tmp = new THREE.Vector3();
    const spinQ = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const cores = waves.map(() => new THREE.Vector3());
    const energies = waves.map(() => 0);

    return {
      render: (frame: number) => {
        const t = frame / fps;
        camera.position.set(0.12 * Math.sin(t * 0.5), 0.06 * Math.sin(t * 0.37), -0.08 * t);
        camera.lookAt(camera.position.x * 0.5, camera.position.y * 0.5, -10);
        bgMat.uniforms.time.value = t;

        waves.forEach((w, wi) => {
          const [x, y, z] = track3(w.path, frame);
          cores[wi].set(x, y, z - 0.4);
          energies[wi] = Math.max(0, track(w.energy, frame));
          w.light.position.copy(cores[wi]);
          w.light.intensity = energies[wi] * 9;
          w.haze.position.copy(cores[wi]).add(new THREE.Vector3(0, 0, -1.2));
          (w.haze.material as THREE.SpriteMaterial).opacity = energies[wi] * 0.045;
        });

        for (const b of bodies) {
          if (b.wave >= 0) {
            const w = waves[b.wave];
            const [cx, cy, cz] = track3(w.path, frame);
            tmp.copy(b.offset).applyAxisAngle(yAxis, b.orbit * t + b.phase * 0.02);
            tmp.addScaledVector(b.drift, t);
            tmp.y += Math.sin(t * 0.9 + b.phase) * 0.06;
            b.mesh.position.set(cx + tmp.x, cy + tmp.y, cz + tmp.z);
          } else {
            b.mesh.position.copy(b.offset).addScaledVector(b.drift, t * 3);
          }
          spinQ.setFromAxisAngle(b.spinAxis, b.spin * t + b.phase);
          b.mesh.quaternion.copy(spinQ).multiply(b.baseQuat);

          if (b.material) {
            let glow = 0;
            waves.forEach((_, wi) => {
              const d2 = b.mesh.position.distanceToSquared(cores[wi]);
              glow += energies[wi] * (0.3 + 1.25 * Math.exp(-d2 / (3.3 * 3.3)));
            });
            b.material.emissiveIntensity = glow;
          }
        }
        // dim fill follows the overall light level so the clip ends in darkness
        const lvl = Math.max(...energies);
        const fade = Math.min(1, frame / 6, (fps * 8.3 - frame) / 10);
        ambient.intensity = (0.25 + 0.45 * lvl) * Math.max(0, fade);
        fill.intensity = (0.35 + 0.75 * lvl) * Math.max(0, fade);
        grade.uniforms.seed.value = (frame * 7.31) % 100;
        composer.render();
      },
      dispose: () => {
        composer.dispose();
        streak.dispose();
        sphereGeo.dispose();
        shardGeo.dispose();
        stripeTextures.forEach((tx) => tx.dispose());
        hazeTex.dispose();
        darkMat.dispose();
        shardMat.dispose();
        bodies.forEach((b) => b.material?.dispose());
        bgMat.dispose();
      },
    };
  };
