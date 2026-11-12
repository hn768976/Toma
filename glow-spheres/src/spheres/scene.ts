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
import { flicker, LIGHTS, track, track2 } from "./timeline";

export type SphereSceneOptions = { palette: SpherePalette; seed: number };

type Body = {
  mesh: THREE.Mesh;
  base: THREE.Vector3; // position at frame 0
  radius: number;
  isSphere: boolean;
  material: THREE.MeshStandardMaterial | null;
  baseQuat: THREE.Quaternion;
  spinAxis: THREE.Vector3;
  spin: number;
  phase: number;
};

const randomUnit = (rand: Random) => {
  const u = rand.range(-1, 1);
  const a = rand.range(0, Math.PI * 2);
  const s = Math.sqrt(1 - u * u);
  return new THREE.Vector3(s * Math.cos(a), s * Math.sin(a), u);
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
          float l = smoothstep(w + 0.06, 0.0, abs(f - 0.5) - 0.05) * 0.8;
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
    const ambient = new THREE.AmbientLight(palette.fill, 0.3);
    scene.add(ambient);
    const fill = new THREE.DirectionalLight(palette.fill, 0.5);
    fill.position.set(-3, 4, 2);
    scene.add(fill);

    const tanV = Math.tan(THREE.MathUtils.degToRad(22.5));
    const aspect = width / height;
    const pockets = LIGHTS.map((def) => {
      const light = new THREE.PointLight(palette.coreLight, 0, 3.5, 2); // local light
      scene.add(light);
      return { def, light, pos: new THREE.Vector3(), energy: 0 };
    });

    // ---------- the sphere field (dense, almost static, like the reference) ----------
    const sphereHi = new THREE.SphereGeometry(1, 56, 40);
    const sphereLo = new THREE.SphereGeometry(1, 28, 20);
    const stripeTextures = palette.stripes.flatMap((set) => [
      createStripeTexture(set, rand),
      createStripeTexture(set, rand),
    ]);
    const darkMat = new THREE.MeshStandardMaterial({
      color: palette.darkSphere,
      roughness: 0.3,
      metalness: 0.0,
      emissive: new THREE.Color(palette.darkSphere).multiplyScalar(0.05), // scaled per frame (FLOOR)
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

    const FIELD = { x: [-10, 7.5], y: [-4.8, 4.8], z: [-9.8, -3.8] } as const;
    const bodies: Body[] = [];
    const SPHERES = 560;
    for (let i = 0; i < SPHERES; i++) {
      const size = rand.next();
      const radius =
        size < 0.15 ? rand.range(0.6, 0.85) : size < 0.65 ? rand.range(0.36, 0.58) : rand.range(0.16, 0.34);
      const striped = rand.next() < 0.52;
      const base = new THREE.Vector3(
        rand.range(FIELD.x[0], FIELD.x[1]),
        rand.range(FIELD.y[0], FIELD.y[1]),
        rand.range(FIELD.z[0], FIELD.z[1]),
      );
      let material: THREE.MeshStandardMaterial | null = null;
      if (striped) {
        const tex = rand.pick(stripeTextures);
        material = new THREE.MeshStandardMaterial({
          map: tex,
          emissiveMap: tex,
          emissive: new THREE.Color("#ffffff"),
          emissiveIntensity: 0,
          roughness: 0.42,
          metalness: 0.0,
        });
      }
      const mesh = new THREE.Mesh(radius > 0.4 ? sphereHi : sphereLo, material ?? darkMat);
      mesh.scale.setScalar(radius);
      scene.add(mesh);
      bodies.push({
        mesh,
        base,
        radius,
        isSphere: true,
        material,
        baseQuat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), randomUnit(rand)),
        spinAxis: randomUnit(rand),
        spin: rand.range(0.2, 0.8) * (rand.next() < 0.5 ? -1 : 1),
        phase: rand.range(0, Math.PI * 2),
      });
    }
    // Relax overlaps so spheres pack instead of intersecting (no dark notches).
    const tmpA = new THREE.Vector3();
    for (let it = 0; it < 30; it++) {
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j];
          const min = (a.radius + b.radius) * 1.02;
          const dx = b.base.x - a.base.x;
          if (dx > min || dx < -min) continue;
          const d = tmpA.subVectors(b.base, a.base);
          const len = d.length();
          if (len < min && len > 1e-5) {
            d.multiplyScalar(((min - len) / len) * 0.5);
            b.base.add(d);
            a.base.sub(d);
          }
        }
      }
    }
    for (let i = 0; i < 160; i++) {
      const mesh = new THREE.Mesh(shardGeo, shardMat);
      const r = rand.range(0.05, 0.15);
      mesh.scale.set(r, r * rand.range(0.5, 1.0), r);
      scene.add(mesh);
      bodies.push({
        mesh,
        base: new THREE.Vector3(
          rand.range(FIELD.x[0], FIELD.x[1]),
          rand.range(FIELD.y[0], FIELD.y[1]),
          rand.range(FIELD.z[0], FIELD.z[1]),
        ),
        radius: r,
        isSphere: false,
        material: null,
        baseQuat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), randomUnit(rand)),
        spinAxis: randomUnit(rand),
        spin: rand.range(0.8, 2.4),
        phase: rand.range(0, Math.PI * 2),
      });
    }
    // the whole field drifts slowly and uniformly (≈0.9 px/frame at 480 px in the reference)
    const FLOW = new THREE.Vector3(0.3, 0.07, 0.12);

    // ---------- post-processing ----------
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const pr = renderer.getPixelRatio();
    const streak = new StreakPass(width * pr, height * pr, new THREE.Color(palette.streakTint), 1.7, 0.55);
    composer.addPass(streak);
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.75, 0.42, 0.8);
    // tint the glow halo with the light colour instead of neutral white
    const tint = new THREE.Color(palette.coreLight);
    bloom.bloomTintColors = bloom.bloomTintColors.map((_, i) =>
      new THREE.Vector3(tint.r, tint.g, tint.b).lerp(new THREE.Vector3(1, 1, 1), i === 0 ? 0.5 : 0.1),
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const grade = new ShaderPass(createGradeShader());
    composer.addPass(grade);

    const spinQ = new THREE.Quaternion();
    const dimTint = new THREE.Color(palette.dimTint);
    const WHITE = new THREE.Color("#ffffff");
    const SIGMA2 = 2.3 * 2.3;
    // faint residual light so unlit spheres read as dim shapes, not black holes
    const FLOOR = 0.009;
    const darkEmissive = new THREE.Color(palette.darkSphere);

    return {
      render: (frame: number) => {
        const t = frame / fps;
        // near-static camera with a tiny handheld-like drift
        camera.position.set(0.04 * Math.sin(t * 0.6), 0.03 * Math.sin(t * 0.43), 0);
        camera.lookAt(camera.position.x, camera.position.y, -10);
        bgMat.uniforms.time.value = t;

        const fl = flicker(frame);
        let lvl = 0;
        for (const p of pockets) {
          const [sx, sy] = track2(p.def.path, frame);
          const d = -p.def.depth;
          p.pos.set(sx * d * tanV * aspect, sy * d * tanV, p.def.depth);
          p.energy = Math.max(0, track(p.def.energy, frame)) * (p.def.gain ?? 1) * fl;
          p.light.position.copy(p.pos);
          p.light.intensity = p.energy * 10;
          lvl = Math.max(lvl, p.energy);
        }
        // dim fill follows the light level so the clip starts/ends in darkness
        const fade = Math.max(0, Math.min(1, frame / 6, (fps * 8.3 - frame) / 10));
        ambient.intensity = 0.006 * fade;
        fill.intensity = 0.03 * lvl * fade;
        darkMat.emissive.copy(darkEmissive).multiplyScalar(0.05 + 3.5 * FLOOR * fade);

        for (const b of bodies) {
          b.mesh.position.copy(b.base).addScaledVector(FLOW, t);
          b.mesh.position.y += Math.sin(t * 0.8 + b.phase) * 0.04;
          spinQ.setFromAxisAngle(b.spinAxis, b.spin * t + b.phase);
          b.mesh.quaternion.copy(spinQ).multiply(b.baseQuat);
          if (b.material) {
            let glow = FLOOR * fade;
            for (const p of pockets) {
              if (p.energy <= 0) continue;
              const d2 = b.mesh.position.distanceToSquared(p.pos);
              // gaussian with its tail cut off: pockets end abruptly in darkness
              glow += p.energy * Math.max(0, (Math.exp(-d2 / SIGMA2) - 0.12) / 0.88);
            }
            // weak glow is saturated (coloured light), strong glow burns to white
            b.material.emissive.copy(dimTint).lerp(WHITE, Math.min(1, Math.max(0, (glow - 0.08) / 0.55)));
            b.material.emissiveIntensity = glow * 2.7;
          }
        }
        grade.uniforms.seed.value = (frame * 7.31) % 100;
        composer.render();
      },
      dispose: () => {
        composer.dispose();
        streak.dispose();
        sphereHi.dispose();
        sphereLo.dispose();
        shardGeo.dispose();
        stripeTextures.forEach((tx) => tx.dispose());
        darkMat.dispose();
        shardMat.dispose();
        bodies.forEach((b) => b.material?.dispose());
        bgMat.dispose();
      },
    };
  };
