// Look 2 — Coin Growth (three.js, 12s, not a loop).
// Six stacks of plain metallic coins (lathe geometry, ridged-edge normal map,
// studio HDRI). Coins drop on fixed seeded schedules with a small analytic
// bounce — no physics. Glossy floor with mirrored stacks, finance backdrop,
// double-exposure chart overlay, white arrow drawing on.
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import * as THREE from "three";
import { loadFonts, loadLand, loadStudioHDR } from "../lib/assets";
import { clamp, easeInOutCubic, lerp } from "../lib/math";
import { PostRender } from "../lib/post";
import { mulberry32 } from "../lib/random";
import { useAsset } from "../lib/useAsset";
import type { CoinPalette } from "../versions";
import { makeBackdrop, makeChartOverlay } from "./backdrop";

export const COIN_FRAMES = 360;

const R = 1; // coin radius
const T = 0.17; // coin thickness
const SPACING = 2.55;
const INITIAL = [2, 2, 3, 3, 3, 4];
const FINAL = [5, 9, 13, 18, 25, 33];
const STACK_X = FINAL.map((_, i) => (i - 2.5) * SPACING);
const DROP_H = 1.8; // fall height above landing (world units)
const FALL = 9; // frames of fall
const BOUNCE = 8; // frames of bounce

type Coin = { stack: number; level: number; land: number; jitterX: number; jitterZ: number; yaw: number; tilt: number; gold: boolean };

// Fixed seeded schedule, built at module level.
const COINS: Coin[] = (() => {
  const rnd = mulberry32(0xc014);
  const coins: Coin[] = [];
  FINAL.forEach((n, s) => {
    // Stacks grow together, staggered left → right, so the profile is always a rising staircase.
    const start = 20 + s * 10;
    const end = 150 + s * 18; // last stack lands by frame 240
    const added = n - INITIAL[s];
    for (let level = 0; level < n; level++) {
      const k = level - INITIAL[s];
      // Ease-out schedule: most coins land early, the last few trickle in by `end`.
      const q = (k + 1) / added;
      const land = k < 0 ? -1 : start + (1 - Math.cbrt(1 - q)) * (end - start) - FALL;
      coins.push({
        stack: s,
        level,
        land: Math.round(land + FALL),
        jitterX: (rnd() - 0.5) * 0.07,
        jitterZ: (rnd() - 0.5) * 0.07,
        yaw: rnd() * Math.PI * 2,
        tilt: (rnd() - 0.5) * 0.16,
        gold: rnd() < [0.96, 0.92, 0.8, 0.4, 0.08, 0.04][s], // brass on the left → gunmetal on the right
      });
    }
  });
  return coins;
})();

// Coin pose at a frame: pure function of the frame.
const coinPose = (c: Coin, frame: number) => {
  const rest = c.level * T + T / 2;
  if (c.land < 0) return { y: rest, tilt: 0, visible: true };
  const t0 = c.land - FALL;
  if (frame < t0) return { y: rest + DROP_H, tilt: c.tilt, visible: false };
  if (frame < c.land) {
    const u = (frame - t0) / FALL;
    return { y: rest + DROP_H * (1 - u * u), tilt: c.tilt * (1 - u), visible: true };
  }
  const b = (frame - c.land) / BOUNCE;
  if (b < 1) return { y: rest + 0.09 * Math.abs(Math.sin(b * Math.PI * 2)) * (1 - b) * (1 - b), tilt: 0.02 * Math.sin(b * 9) * (1 - b), visible: true };
  return { y: rest, tilt: 0, visible: true };
};

// Lathe profile of a plain coin with a raised rim and a recessed field.
const coinGeometry = () => {
  const pts = [
    [0.0, T / 2 - 0.014],
    [0.8, T / 2 - 0.014],
    [0.86, T / 2],
    [0.955, T / 2],
    [R, T / 2 - 0.022],
    [R, -T / 2 + 0.022],
    [0.955, -T / 2],
    [0.86, -T / 2],
    [0.8, -T / 2 + 0.014],
    [0.0, -T / 2 + 0.014],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  // Lathe winds the profile counter-clockwise; reverse so normals face out.
  const g = new THREE.LatheGeometry(pts.reverse(), 128);
  g.computeVertexNormals();
  return g;
};

// Ridged (reeded) edge as a tangent-space normal map. Lathe UV: u around,
// v along the profile; rows for the outer edge segment get ridges.
const ridgeNormalMap = () => {
  const W = 2048;
  const H = 72;
  const data = new Uint8Array(W * H * 4);
  const RIDGES = 150;
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    const edge = v > 4 / 9 && v < 5 / 9 ? 1 : 0;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      const s = Math.sin(u * Math.PI * 2 * RIDGES);
      const nx = edge * Math.sign(s) * Math.pow(Math.abs(s), 0.6) * 0.75;
      const nz = Math.sqrt(1 - nx * nx);
      const i = (y * W + x) * 4;
      data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      data[i + 1] = 128;
      data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
};

type Assets = { backdrop: HTMLCanvasElement; overlay: HTMLCanvasElement; hdr: THREE.DataTexture };

const Coins: React.FC<{ palette: CoinPalette; frame: number }> = ({ palette, frame }) => {
  const { mesh, mirror } = useMemo(() => {
    const g = coinGeometry();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 1,
      roughness: 0.28,
      normalMap: ridgeNormalMap(),
      normalScale: new THREE.Vector2(1, 1),
      envMapIntensity: 0.32,
    });
    const make = () => {
      const m = new THREE.InstancedMesh(g, mat, COINS.length);
      m.frustumCulled = false;
      // Gradual brass → gunmetal shift across the stacks (no per-coin striping).
      COINS.forEach((c, i) => m.setColorAt(i, new THREE.Color(palette.gold).lerp(new THREE.Color(palette.silver), Math.min(1, c.stack / 4.2) + c.jitterX * 0.6)));
      return m;
    };
    const mesh = make();
    const mirror = make();
    // Reflection: rougher, dimmer copy so it reads as a soft glossy reflection.
    mirror.material = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.6, envMapIntensity: 0.22 });
    mirror.scale.y = -1; // reflection under the glossy floor
    return { mesh, mirror };
  }, [palette]);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  COINS.forEach((c, i) => {
    const p = coinPose(c, frame);
    e.set(p.tilt, c.yaw, p.tilt * 0.6);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(STACK_X[c.stack] + c.jitterX, p.y, c.jitterZ), q, p.visible ? new THREE.Vector3(1, 1, 1) : new THREE.Vector3(0, 0, 0));
    mesh.setMatrixAt(i, m4);
    mirror.setMatrixAt(i, m4);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mirror.instanceMatrix.needsUpdate = true;
  return (
    <>
      <primitive object={mesh} />
      <primitive object={mirror} />
    </>
  );
};

const Floor: React.FC = () => {
  const { floor, bars } = useMemo(() => {
    // Glossy glass-like floor: partially transparent so the mirrored stacks
    // show through, fading with distance.
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    // Far edge fully transparent so the floor melts into the backdrop (no hard horizon).
    g.addColorStop(0, "rgba(90,120,130,0)");
    g.addColorStop(0.4, "rgba(95,125,135,0.6)");
    g.addColorStop(1, "rgba(120,145,155,0.8)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 28),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.12, metalness: 0.0, envMapIntensity: 0.6, depthWrite: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -2);
    // Faint flat bar shapes in front of each stack.
    const barMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.7, 1.8), transparent: true, opacity: 0.16, depthWrite: false });
    const bars: THREE.Mesh[] = STACK_X.map((x) => {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(SPACING * 0.78, 9), barMat);
      b.rotation.x = -Math.PI / 2;
      b.position.set(x, 0.004, 6.4);
      return b;
    });
    // Row of thin white step strips with arrow tips just in front of the stacks.
    const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.45, 1.5), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    STACK_X.forEach((x) => {
      const shape = new THREE.Shape();
      const w = SPACING * 0.98;
      shape.moveTo(-w / 2, -0.1);
      shape.lineTo(w / 2 - 0.22, -0.1);
      shape.lineTo(w / 2, 0);
      shape.lineTo(w / 2 - 0.22, 0.1);
      shape.lineTo(-w / 2, 0.1);
      shape.lineTo(-w / 2 + 0.12, 0);
      const strip = new THREE.Mesh(new THREE.ShapeGeometry(shape), stripMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(x, 0.012, 2.3);
      bars.push(strip);
    });
    return { floor, bars };
  }, []);
  return (
    <>
      <primitive object={floor} />
      {bars.map((b, i) => (
        <primitive key={i} object={b} />
      ))}
    </>
  );
};

const Backdrop: React.FC<{ assets: Assets }> = ({ assets }) => {
  const mesh = useMemo(() => {
    const tex = new THREE.CanvasTexture(assets.backdrop);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(42, 21), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.95, 0.95, 0.95), depthWrite: false }));
    m.position.set(0, 5.5, -16);
    return m;
  }, [assets]);
  return <primitive object={mesh} />;
};

// Double exposure: chart overlay on a plane in front of the stacks.
const Overlay: React.FC<{ assets: Assets; frame: number }> = ({ assets, frame }) => {
  const mesh = useMemo(() => {
    const tex = new THREE.CanvasTexture(assets.overlay);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(21, 11.8),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }),
    );
    m.position.set(0, 2.45, 3);
    m.renderOrder = 10;
    return m;
  }, [assets]);
  mesh.position.x = -0.4 + frame * 0.002;
  return <primitive object={mesh} />;
};

// Arrow curve: from the first stack up to above the last.
const ARROW_PTS = [
  new THREE.Vector3(STACK_X[0] - 1.2, 1.3, 1.4),
  new THREE.Vector3(STACK_X[1] + 0.2, 2.1, 1.4),
  new THREE.Vector3(STACK_X[3], 3.7, 1.4),
  new THREE.Vector3(STACK_X[5] - 0.2, 7.0, 1.4),
];

const Arrow: React.FC<{ frame: number }> = ({ frame }) => {
  const { camera } = useThree();
  const { ribbon, head, curve } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(ARROW_PTS, false, "centripetal");
    const N = 240;
    const pos = new Float32Array((N + 1) * 2 * 3);
    const sAttr = new Float32Array((N + 1) * 2);
    const idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const p = curve.getPointAt(u);
      const t = curve.getTangentAt(u);
      const n = new THREE.Vector3(-t.y, t.x, 0).normalize().multiplyScalar(0.11);
      pos.set([p.x + n.x, p.y + n.y, p.z, p.x - n.x, p.y - n.y, p.z], i * 6);
      sAttr[i * 2] = u;
      sAttr[i * 2 + 1] = u;
      if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aS", new THREE.BufferAttribute(sAttr, 1));
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uP: { value: 0 } },
      vertexShader: `attribute float aS; varying float vS; void main(){ vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uP; varying float vS; void main(){ if (vS > uP) discard; float a = smoothstep(0.0, 0.06, vS); gl_FragColor = vec4(vec3(1.35) * a * 0.9, a * 0.9); }`,
    });
    const ribbon = new THREE.Mesh(g, mat);
    ribbon.frustumCulled = false;
    const hg = new THREE.BufferGeometry();
    hg.setAttribute("position", new THREE.Float32BufferAttribute([0.95, 0, 0, -0.05, 0.55, 0, -0.05, -0.55, 0], 3));
    const head = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.35, 1.35, 1.35), opacity: 0.9, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    head.frustumCulled = false;
    return { ribbon, head, curve };
  }, []);
  const p = interpolate(frame, [180, 300], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  (ribbon.material as THREE.ShaderMaterial).uniforms.uP.value = p;
  const at = curve.getPointAt(Math.max(0.001, p));
  const tan = curve.getTangentAt(Math.max(0.001, p));
  head.position.copy(at);
  head.rotation.set(0, 0, Math.atan2(tan.y, tan.x));
  head.visible = p > 0.015;
  void camera;
  return (
    <>
      <primitive object={ribbon} />
      <primitive object={head} />
    </>
  );
};

const CameraRig: React.FC<{ frame: number }> = ({ frame }) => {
  const { camera } = useThree();
  const t = easeInOutCubic(frame / (COIN_FRAMES - 1));
  camera.position.set(lerp(-0.25, 0.25, t), 2.6, lerp(21.2, 20.2, t));
  camera.lookAt(lerp(-0.12, 0.12, t), 2.75, 0);
  camera.updateMatrixWorld();
  return null;
};

const Lights: React.FC<{ palette: CoinPalette; hdr: THREE.DataTexture }> = ({ palette, hdr }) => {
  const { scene } = useThree();
  useMemo(() => {
    scene.environment = hdr;
    scene.environmentRotation.set(0, 0.6, 0);
  }, [scene, hdr]);
  return (
    <>
      <directionalLight position={[-8, 6, 6]} intensity={1.4} color={palette.leakWarm} />
      <directionalLight position={[9, 5, 4]} intensity={1.3} color={palette.leakCool} />
      <directionalLight position={[0, 8, 10]} intensity={0.3} color="#ffffff" />
    </>
  );
};

const Scene: React.FC<{ palette: CoinPalette; assets: Assets }> = ({ palette, assets }) => {
  const frame = useCurrentFrame();
  return (
    <>
      <color attach="background" args={["#6d7f95"]} />
      <CameraRig frame={frame} />
      <Lights palette={palette} hdr={assets.hdr} />
      <Backdrop assets={assets} />
      <Floor />
      <Coins palette={palette} frame={frame} />
      <Arrow frame={frame} />
      <Overlay assets={assets} frame={frame} />
      <PostRender bloomStrength={0.35} bloomRadius={0.6} bloomThreshold={0.85} exposure={0.85} vignette={0.2} grain={0.02} lift={[0.03, 0.03, 0.032]} />
    </>
  );
};

export const CoinGrowth: React.FC<{ palette: CoinPalette }> = ({ palette }) => {
  const { width, height } = useVideoConfig();
  const assets = useAsset(async () => {
    const [polys, hdr] = await Promise.all([loadLand(), loadStudioHDR(), loadFonts()]);
    return { backdrop: makeBackdrop(polys, palette), overlay: makeChartOverlay(palette), hdr } as Assets;
  }, "Coin assets (HDRI, Natural Earth, fonts)");
  void clamp;
  return (
    <AbsoluteFill style={{ backgroundColor: "#6d7f95" }}>
      {assets ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={typeof window !== "undefined" ? window.devicePixelRatio : 1}
          gl={{ antialias: false, preserveDrawingBuffer: true }}
          camera={{ fov: 30, near: 0.1, far: 200 }}
        >
          <Scene palette={palette} assets={assets} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
