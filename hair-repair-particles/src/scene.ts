import * as THREE from "three";
import { Palette } from "./palettes";
import {
  backgroundFragment,
  backgroundVertex,
  beadFragment,
  beadVertex,
  hairFragment,
  hairVertex,
} from "./shaders";
import {
  cameraProgress,
  getCamera,
  hairCurve,
  hairRadius,
  HEIGHT,
  ringU,
  T,
  WIDTH,
} from "./timeline";
import { clamp01, makeRng, ramp, taperedTube } from "./util";

export type HairScene = {
  render: (renderer: THREE.WebGLRenderer, t: number) => void;
  dispose: () => void;
};

const col = (hex: string) => new THREE.Color(hex);
const FLARE_SCALE = 1.5;

const radialTexture = (
  size: number,
  draw: (ctx: CanvasRenderingContext2D, s: number) => void,
) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d")!, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

export const buildHairScene = (palette: Palette): HairScene => {
  const scene = new THREE.Scene();
  const disposables: { dispose: () => void }[] = [];
  const track = <X extends { dispose: () => void }>(o: X) => {
    disposables.push(o);
    return o;
  };
  const camera = getCamera(0);
  scene.add(camera);
  const aspect = WIDTH / HEIGHT;

  // ---------- background gradient (full-screen) ----------
  const bgMat = track(
    new THREE.ShaderMaterial({
      vertexShader: backgroundVertex,
      fragmentShader: backgroundFragment,
      uniforms: {
        uCenter: { value: col(palette.bgCenter) },
        uEdge: { value: col(palette.bgEdge) },
        uAspect: { value: aspect },
        uShift: { value: new THREE.Vector2() },
      },
      depthTest: false,
      depthWrite: false,
    }),
  );
  const bg = new THREE.Mesh(track(new THREE.PlaneGeometry(2, 2)), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  // ---------- bokeh, attached to the camera with fake parallax ----------
  const BOKEH_Z = -20;
  const viewH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 20;
  const fieldW = viewH * aspect * 1.5;
  const fieldH = viewH * 1.5;
  const bokehTex = track(
    radialTexture(256, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, "rgba(255,255,255,0.8)");
      g.addColorStop(0.5, "rgba(255,255,255,0.8)");
      g.addColorStop(0.72, "rgba(255,255,255,0.6)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }),
  );
  const rndB = makeRng(909);
  const bokeh = Array.from({ length: 46 }, () => {
    const mat = track(
      new THREE.SpriteMaterial({
        map: bokehTex,
        color: col(palette.bokeh[Math.floor(rndB() * palette.bokeh.length)]),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      }),
    );
    const sprite = new THREE.Sprite(mat);
    const size = viewH * (0.07 + rndB() * 0.1);
    sprite.scale.set(size, size, 1);
    sprite.renderOrder = -9;
    camera.add(sprite);
    return {
      sprite,
      mat,
      x: rndB() * fieldW,
      y: rndB() * fieldH,
      depth: 0.3 + rndB() * 0.7,
      alpha: 0.04 + rndB() * rndB() * 0.22,
      phase: rndB() * 6.28,
      speed: 0.25 + rndB() * 0.5,
    };
  });

  // ---------- hair strand ----------
  const TUBULAR = 1100;
  const RADIAL = 128;
  const hairGeo = track(taperedTube(hairCurve, TUBULAR, RADIAL, hairRadius));
  {
    const radii = new Float32Array((TUBULAR + 1) * (RADIAL + 1));
    for (let i = 0; i <= TUBULAR; i++) {
      radii.fill(
        hairRadius(i / TUBULAR),
        i * (RADIAL + 1),
        (i + 1) * (RADIAL + 1),
      );
    }
    hairGeo.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));
  }
  const hairMat = track(
    new THREE.ShaderMaterial({
      vertexShader: hairVertex,
      fragmentShader: hairFragment,
      uniforms: {
        uFront: { value: 0 },
        uGlow: { value: 1 },
        uDamagedDark: { value: col(palette.damagedDark) },
        uDamagedMid: { value: col(palette.damagedMid) },
        uDamagedLight: { value: col(palette.damagedLight) },
        uHealthy: { value: col(palette.healthy) },
        uHealthyHighlight: { value: col(palette.healthyHighlight) },
        uHealthyShadow: { value: col(palette.healthyShadow) },
        uFrontGlow: { value: col(palette.frontGlow) },
      },
    }),
  );
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.frustumCulled = false;
  scene.add(hair);

  // ---------- ring of repair molecules ----------
  const rnd = makeRng(1234);
  type Bead = {
    a0: number;
    w: number;
    rad: number;
    y: number;
    bobF: number;
    bobP: number;
    size: number;
    out: number;
    partner: number; // index of bonded bead or -1
    bondDir: THREE.Vector3;
    bondLen: number;
  };
  const beads: Bead[] = [];
  const MOLECULES = 44;
  for (let i = 0; i < MOLECULES; i++) {
    const b: Bead = {
      a0: rnd() * Math.PI * 2,
      w: (0.5 + rnd() * 0.7) * (rnd() > 0.2 ? 1 : -0.6),
      rad: 0.82 + rnd() * 0.75,
      y: (rnd() + rnd() - 1) * 0.75 + 0.12,
      bobF: 0.8 + rnd() * 1.6,
      bobP: rnd() * 6.28,
      size: 0.075 + rnd() * 0.055,
      out: rnd(),
      partner: -1,
      bondDir: new THREE.Vector3(),
      bondLen: 0,
    };
    beads.push(b);
    const extra = rnd() < 0.45 ? (rnd() < 0.3 ? 2 : 1) : 0;
    for (let k = 0; k < extra; k++) {
      beads.push({
        ...b,
        size: b.size * (0.65 + rnd() * 0.3),
        partner: beads.length - 1 - k,
        bondDir: new THREE.Vector3(
          rnd() - 0.5,
          rnd() - 0.5,
          rnd() - 0.5,
        ).normalize(),
        bondLen: 0.2 + rnd() * 0.1,
      });
    }
  }
  const beadGeo = track(
    new THREE.InstancedBufferGeometry().copy(
      new THREE.SphereGeometry(1, 28, 20) as unknown as THREE.InstancedBufferGeometry,
    ),
  );
  const offsets = new Float32Array(beads.length * 3);
  const scales = new Float32Array(beads.length);
  const offAttr = new THREE.InstancedBufferAttribute(offsets, 3);
  const scaleAttr = new THREE.InstancedBufferAttribute(scales, 1);
  beadGeo.setAttribute("aOffset", offAttr);
  beadGeo.setAttribute("aScale", scaleAttr);
  beadGeo.instanceCount = beads.length;
  const beadMat = track(
    new THREE.ShaderMaterial({
      vertexShader: beadVertex,
      fragmentShader: beadFragment,
      uniforms: {
        uColor: { value: col(palette.bead) },
        uRim: { value: col(palette.beadRim) },
      },
    }),
  );
  const beadMesh = new THREE.Mesh(beadGeo, beadMat);
  beadMesh.frustumCulled = false;
  scene.add(beadMesh);

  // bonds between paired beads
  const bondCount = beads.filter((b) => b.partner >= 0).length;
  const bondGeo = track(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true));
  const bondMat = track(new THREE.MeshBasicMaterial({ color: col(palette.beadRim) }));
  const bonds = new THREE.InstancedMesh(bondGeo, bondMat, bondCount);
  bonds.frustumCulled = false;
  scene.add(bonds);

  // ---------- lens flare (constant size on screen, additive) ----------
  const glowTex = track(
    radialTexture(256, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.18, "rgba(255,255,255,0.55)");
      g.addColorStop(0.45, "rgba(255,255,255,0.14)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }),
  );
  const flare: { sprite: THREE.Sprite; mat: THREE.SpriteMaterial; base: number; dx: number; flick: number }[] = [];
  const addFlare = (
    color: string,
    w: number,
    h: number,
    base: number,
    dx = 0,
    flick = 0,
  ) => {
    const mat = track(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: col(color),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        sizeAttenuation: false,
      }),
    );
    const sprite = new THREE.Sprite(mat);
    // with sizeAttenuation off, scale 1 == the full frame height at fov
    const k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    sprite.scale.set(w * k * FLARE_SCALE, h * k * FLARE_SCALE, 1);
    sprite.renderOrder = 20;
    scene.add(sprite);
    flare.push({ sprite, mat, base, dx: dx * k * FLARE_SCALE, flick });
  };
  addFlare(palette.flareTint, 0.5, 0.42, 0.34); // soft halo
  addFlare(palette.flareTint, 0.95, 0.05, 0.85); // long anamorphic streak
  addFlare(palette.flareCore, 0.5, 0.022, 1.0); // hot streak core
  addFlare(palette.flareCore, 0.17, 0.1, 1.0); // core
  addFlare(palette.flareTint, 0.16, 0.014, 0.8, 0.24, 1); // glints to the right
  addFlare(palette.flareCore, 0.07, 0.02, 0.7, 0.33, 2);
  addFlare(palette.flareTint, 0.1, 0.012, 0.6, -0.2, 3);

  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const center = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const right = new THREE.Vector3();

  const render = (renderer: THREE.WebGLRenderer, t: number) => {
    const cam = getCamera(t);
    const p = cameraProgress(t);
    const u = ringU(t);
    hairCurve.getPointAt(u, center);
    const rHair = hairRadius(u);

    hairMat.uniforms.uFront.value = u >= 1 ? 1.01 : u;
    const flareLevel = 1 - ramp(t, T.flareOutStart, T.flareOutEnd);
    hairMat.uniforms.uGlow.value = flareLevel;

    // background + bokeh parallax
    bgMat.uniforms.uShift.value.set(-0.05 * p, -0.12 * p + 0.004 * t);
    for (const b of bokeh) {
      const sx = -fieldW * 0.22 * p * b.depth + t * 0.12 * b.speed;
      const sy = -fieldH * 0.55 * p * b.depth - t * 0.05 * b.speed;
      const x = ((((b.x + sx) % fieldW) + fieldW) % fieldW) - fieldW / 2;
      const y = ((((b.y + sy) % fieldH) + fieldH) % fieldH) - fieldH / 2;
      b.sprite.position.set(x, y, BOKEH_Z);
      // fade near the wrap borders so nothing pops
      const ex = 1 - Math.abs(x) / (fieldW / 2);
      const ey = 1 - Math.abs(y) / (fieldH / 2);
      const edge = clamp01(Math.min(ex, ey) * 6);
      b.mat.opacity =
        b.alpha * edge * (0.75 + 0.25 * Math.sin(t * b.speed * 1.3 + b.phase));
    }

    // molecules orbit the strand at the repair front
    const ringR = 0.95 + rHair * 0.45;
    let bi = 0;
    beads.forEach((b, i) => {
      const gone = ramp(
        t,
        T.beadsOutStart + b.out * 0.55,
        T.beadsOutStart + b.out * 0.55 + (T.beadsOutEnd - T.beadsOutStart - 0.55),
      );
      const s = b.size * (1 - gone) * (1 - gone);
      const a = b.a0 + b.w * t;
      const r = ringR * b.rad * (1 - 0.6 * gone);
      const y = b.y * (1 - 0.5 * gone) + 0.13 * Math.sin(t * b.bobF + b.bobP);
      pos.set(center.x + Math.cos(a) * r, center.y + y, center.z + Math.sin(a) * r);
      if (b.partner >= 0) {
        dir.copy(b.bondDir).applyAxisAngle(up, a * 0.8);
        const parent = b.partner;
        const px = offsets[parent * 3];
        const py = offsets[parent * 3 + 1];
        const pz = offsets[parent * 3 + 2];
        const len = b.bondLen * (1 - gone);
        pos.set(px + dir.x * len, py + dir.y * len, pz + dir.z * len);
        // bond cylinder from parent to this bead
        tmpQ.setFromUnitVectors(up, dir);
        tmpM.compose(
          new THREE.Vector3(px + dir.x * len * 0.5, py + dir.y * len * 0.5, pz + dir.z * len * 0.5),
          tmpQ,
          new THREE.Vector3(s * 0.22, len, s * 0.22),
        );
        bonds.setMatrixAt(bi++, tmpM);
      }
      offsets[i * 3] = pos.x;
      offsets[i * 3 + 1] = pos.y;
      offsets[i * 3 + 2] = pos.z;
      scales[i] = s;
    });
    offAttr.needsUpdate = true;
    scaleAttr.needsUpdate = true;
    bonds.instanceMatrix.needsUpdate = true;

    // flare sits on the camera-facing side of the strand at the front
    dir.copy(cam.position).sub(center).normalize();
    right.crossVectors(cam.up, dir).normalize();
    const flick =
      0.9 + 0.07 * Math.sin(t * 19.0) + 0.05 * Math.sin(t * 31.0 + 1.3);
    const dist = cam.position.distanceTo(center);
    for (const f of flare) {
      const shimmer = f.flick
        ? 0.55 + 0.45 * Math.sin(t * (5 + f.flick * 2.3) + f.flick * 2.1)
        : 1;
      f.sprite.position
        .copy(center)
        .addScaledVector(dir, rHair + 0.05)
        .addScaledVector(right, f.dx * dist);
      f.mat.opacity = f.base * flick * shimmer * flareLevel;
    }

    renderer.render(scene, cam);
  };

  return { render, dispose: () => disposables.forEach((d) => d.dispose()) };
};
