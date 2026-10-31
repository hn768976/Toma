import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import {
  BALL_RADIUS,
  RED_RUNG,
  RUNG_HALF,
  RUNG_MAX,
  RUNG_MIN,
  RUNG_SPACING,
  STICK_RADIUS,
  TWIST_PER_RUNG,
  Variant,
  cameraAt,
  docked,
  gapSparkle,
  hash,
  helixScroll,
  helixSpin,
  incomingPair,
  mix,
  redGlow,
  redOffset,
  redVisibility,
} from "./timeline";
import {
  Palette,
  backgroundFragment,
  backgroundVertex,
  pointsFragment,
  pointsVertex,
  tiltShiftShader,
} from "./shaders";

export const PALETTE: Palette = {
  bgCenter: [0.095, 0.22, 0.54],
  bgMid: [0.03, 0.085, 0.25],
  bgEdge: [0.006, 0.014, 0.055],
  streakA: [0.85, 0.25, 0.35],
  streakB: [0.3, 0.55, 1.0],
  glowCenter: [0.52, 0.52],
};

const RUNG_COUNT = RUNG_MAX - RUNG_MIN + 1;

/** Palette values are authored as display (sRGB) colours; shaders work in linear light. */
const lin = (c: readonly number[]) => new THREE.Vector3(...c.map((v) => Math.pow(v, 2.2)));

type PointsLayer = {
  points: THREE.Points;
  material: THREE.ShaderMaterial;
};

const makePoints = (
  positions: number[],
  sizes: number[],
  colors: number[],
  phases: number[],
  opts: { disc: number; twinkle: number; opacity: number },
): PointsLayer => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
  geo.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader: pointsVertex,
    fragmentShader: pointsFragment,
    uniforms: {
      uTime: { value: 0 },
      uPixelScale: { value: 1000 },
      uTwinkle: { value: opts.twinkle },
      uOpacity: { value: opts.opacity },
      uDisc: { value: opts.disc },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  return { points, material };
};

/**
 * Imperative Three.js scene. `render(frame)` is a pure function of the frame
 * number: all animation state is derived from ./timeline.
 */
export class DnaScene {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private camera: THREE.PerspectiveCamera;
  private scene = new THREE.Scene();
  private bgScene = new THREE.Scene();
  private bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private bgMaterial: THREE.ShaderMaterial;
  private helix = new THREE.Group();
  private balls: THREE.InstancedMesh;
  private sticks: THREE.InstancedMesh;
  private redPair = new THREE.Group();
  private redBallMat: THREE.MeshPhysicalMaterial;
  private redStickMat: THREE.MeshPhysicalMaterial;
  private newPair = new THREE.Group();
  private newBallMat: THREE.MeshPhysicalMaterial;
  private newStickMat: THREE.MeshPhysicalMaterial;
  private dust: PointsLayer;
  private sparkle: PointsLayer;
  private bokehHelices: { layer: PointsLayer; group: THREE.Group; speed: number }[] = [];
  private bokehField: PointsLayer;
  private tiltH: ShaderPass;
  private tiltV: ShaderPass;
  private bloom: UnrealBloomPass;
  private dummy = new THREE.Object3D();

  private height: number;

  constructor(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    private variant: Variant,
  ) {

    this.height = height;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.autoClear = false;

    this.camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 200);

    // ---------------- background ----------------
    this.bgMaterial = new THREE.ShaderMaterial({
      vertexShader: backgroundVertex,
      fragmentShader: backgroundFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(width, height) },
        uCenter: { value: lin(PALETTE.bgCenter) },
        uMid: { value: lin(PALETTE.bgMid) },
        uEdge: { value: lin(PALETTE.bgEdge) },
        uStreakA: { value: lin(PALETTE.streakA) },
        uStreakB: { value: lin(PALETTE.streakB) },
        uGlow: { value: new THREE.Vector2(...PALETTE.glowCenter) },
        uStreakScale: { value: 1 },
      },
    });
    const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.bgMaterial);
    bgQuad.frustumCulled = false;
    this.bgScene.add(bgQuad);

    // ---------------- environment / lights ----------------
    this.scene.environment = this.buildEnvironment();
    this.scene.add(new THREE.HemisphereLight(0xd8f0ff, 0x061a50, 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(-5, 7, 9);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x4f8dff, 3.2);
    rim.position.set(7, 1.5, -6);
    this.scene.add(rim);
    const under = new THREE.DirectionalLight(0x2a5fd6, 1.2);
    under.position.set(2, -6, 3);
    this.scene.add(under);

    // ---------------- helix ----------------
    const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 40, 28);
    const stickGeo = new THREE.CylinderGeometry(STICK_RADIUS, STICK_RADIUS, RUNG_HALF * 2, 20, 1, true);
    stickGeo.rotateZ(Math.PI / 2); // along X

    const ballMat = new THREE.MeshPhysicalMaterial({
      color: 0xb2d8f0,
      roughness: 0.3,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.18,
      emissive: new THREE.Color(0x0b2d66),
      emissiveIntensity: 0.3,
      envMapIntensity: 1.1,
    });
    const stickMat = new THREE.MeshPhysicalMaterial({
      color: 0xe4eef9,
      roughness: 0.32,
      clearcoat: 0.6,
      emissive: new THREE.Color(0x14336e),
      emissiveIntensity: 0.4,
      envMapIntensity: 1.0,
    });
    this.balls = new THREE.InstancedMesh(ballGeo, ballMat, RUNG_COUNT * 2);
    this.sticks = new THREE.InstancedMesh(stickGeo, stickMat, RUNG_COUNT);
    // subtle base-pair tint variation (A-T vs C-G look)
    const tintA = new THREE.Color(0xffffff);
    const tintB = new THREE.Color(0xeee6ff);
    const tintC = new THREE.Color(0xe6f6ff);
    for (let i = 0; i < RUNG_COUNT; i++) {
      const h = hash(i + 3);
      const t = h < 0.33 ? tintA : h < 0.66 ? tintB : tintC;
      this.sticks.setColorAt(i, t);
      this.balls.setColorAt(i * 2, t);
      this.balls.setColorAt(i * 2 + 1, h < 0.5 ? tintA : tintC);
    }
    this.balls.frustumCulled = false;
    this.sticks.frustumCulled = false;
    this.helix.add(this.balls, this.sticks);

    // red (mutated) pair
    this.redBallMat = new THREE.MeshPhysicalMaterial({
      color: 0xff4d6d,
      roughness: 0.28,
      clearcoat: 1,
      clearcoatRoughness: 0.2,
      emissive: new THREE.Color(0x5a0618),
      emissiveIntensity: 0.6,
      transparent: true,
    });
    this.redStickMat = new THREE.MeshPhysicalMaterial({
      color: 0xff6f8a,
      roughness: 0.3,
      emissive: new THREE.Color(0x4a0614),
      emissiveIntensity: 0.6,
      transparent: true,
    });
    this.buildPair(this.redPair, ballGeo, stickGeo, this.redBallMat, this.redStickMat);
    this.helix.add(this.redPair);

    // incoming healthy pair
    this.newBallMat = ballMat.clone();
    this.newBallMat.transparent = true;
    this.newStickMat = stickMat.clone();
    this.newStickMat.transparent = true;
    this.buildPair(this.newPair, ballGeo, stickGeo, this.newBallMat, this.newStickMat);
    this.helix.add(this.newPair);

    // dust drifting around the helix
    {
      const pos: number[] = [];
      const size: number[] = [];
      const col: number[] = [];
      const ph: number[] = [];
      for (let i = 0; i < 1400; i++) {
        const a = hash(i * 1.3) * Math.PI * 2;
        const r = 0.2 + hash(i * 2.7) * 1.6;
        pos.push(Math.cos(a) * r, (hash(i * 5.1) - 0.5) * 30, Math.sin(a) * r);
        size.push(0.025 + 0.05 * hash(i * 8.3));
        const c = 0.6 + 0.4 * hash(i * 9.9);
        col.push(0.55 * c, 0.75 * c, 1.0 * c);
        ph.push(hash(i * 11.1));
      }
      this.dust = makePoints(pos, size, col, ph, { disc: 0, twinkle: 0.8, opacity: 0.55 });
      this.helix.add(this.dust.points);
    }

    // sparkle swarm used during the repair
    {
      const pos: number[] = [];
      const size: number[] = [];
      const col: number[] = [];
      const ph: number[] = [];
      for (let i = 0; i < 900; i++) {
        const x = (hash(i * 3.3) - 0.5) * 2.6;
        const y = (hash(i * 4.4) - 0.5) * 0.9 * Math.exp(-Math.abs(x) * 0.5);
        const z = (hash(i * 6.6) - 0.5) * 0.9;
        pos.push(x, y, z);
        size.push(0.025 + 0.06 * hash(i * 7.7));
        const warm = hash(i * 12.1) < 0.25;
        col.push(warm ? 1.0 : 0.6, warm ? 0.55 : 0.85, warm ? 0.7 : 1.0);
        ph.push(hash(i * 13.7));
      }
      this.sparkle = makePoints(pos, size, col, ph, { disc: 0, twinkle: 0.9, opacity: 0 });
      this.helix.add(this.sparkle.points);
    }

    // out-of-focus background helices made of bokeh discs
    const bokehHelix = (seed: number, count: number, color: [number, number, number], discSize: number) => {
      const pos: number[] = [];
      const size: number[] = [];
      const col: number[] = [];
      const ph: number[] = [];
      for (let i = 0; i < count; i++) {
        const y = (i - count / 2) * 0.62;
        const th = i * 0.6;
        for (const s of [1, -1]) {
          pos.push(Math.cos(th) * 1.1 * s, y, Math.sin(th) * 1.1 * s);
          size.push(discSize * (0.8 + 0.4 * hash(i + seed)));
          const k = 0.6 + 0.4 * hash(i * 3 + seed);
          col.push(color[0] * k, color[1] * k, color[2] * k);
          ph.push(hash(i * 7 + seed));
        }
        // a couple of stick blobs
        pos.push(Math.cos(th) * 0.4, y, Math.sin(th) * 0.4);
        size.push(discSize * 0.55);
        col.push(color[0] * 0.5, color[1] * 0.5, color[2] * 0.5);
        ph.push(hash(i * 9 + seed));
      }
      return makePoints(pos, size, col, ph, { disc: 1, twinkle: 0.15, opacity: 1 });
    };
    const addBokehHelix = (
      x: number,
      y: number,
      z: number,
      tiltZ: number,
      color: [number, number, number],
      disc: number,
      speed: number,
      seed: number,
    ) => {
      const layer = bokehHelix(seed, 70, color, disc);
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.rotation.z = tiltZ;
      g.add(layer.points);
      this.scene.add(g);
      this.bokehHelices.push({ layer, group: g, speed });
    };
    addBokehHelix(5.2, 0, -12, 0.08, [0.004, 0.012, 0.045], 1.15, 0.006, 11);
    addBokehHelix(12.5, 0, -22, -0.05, [0.004, 0.012, 0.045], 1.6, 0.004, 23);
    addBokehHelix(-6, 0, -18, 0.04, [0.005, 0.016, 0.06], 1.2, 0.005, 37);

    // free-floating bokeh
    {
      const pos: number[] = [];
      const size: number[] = [];
      const col: number[] = [];
      const ph: number[] = [];
      for (let i = 0; i < 160; i++) {
        const z = -6 - hash(i * 1.9) * 22;
        const spread = (-z + 12) * 0.62;
        pos.push((hash(i * 2.3) - 0.35) * spread * 1.6, (hash(i * 3.7) - 0.5) * spread, z);
        size.push(0.6 + 1.6 * hash(i * 4.1));
        const k = 0.25 + 0.5 * hash(i * 5.3);
        const pink = hash(i * 6.7) < 0.07;
        col.push((pink ? 0.4 : 0.08) * k, (pink ? 0.1 : 0.2) * k, (pink ? 0.3 : 0.6) * k);
        ph.push(hash(i * 8.9));
      }
      this.bokehField = makePoints(pos, size, col, ph, { disc: 1, twinkle: 0.35, opacity: 0.16 });
      this.scene.add(this.bokehField.points);
    }

    this.scene.add(this.helix);

    // ---------------- post-processing ----------------
    // When Remotion renders with --scale < 1 (e.g. 4K master → 1080p delivery)
    // the 4K canvas is already supersampled 2×2, so MSAA is skipped to save time.
    const supersampled = typeof window !== "undefined" && window.devicePixelRatio < 1;
    const rt = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: supersampled ? 0 : 4,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setPixelRatio(1);
    this.composer.setSize(width, height);
    const bgPass = new RenderPass(this.bgScene, this.bgCamera);
    this.composer.addPass(bgPass);
    const mainPass = new RenderPass(this.scene, this.camera);
    mainPass.clear = false;
    mainPass.clearDepth = true;
    this.composer.addPass(mainPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.35, 0.6, 0.85);
    this.composer.addPass(this.bloom);
    this.tiltH = new ShaderPass(tiltShiftShader);
    this.tiltV = new ShaderPass(tiltShiftShader);
    for (const [pass, dir] of [
      [this.tiltH, [1, 0]],
      [this.tiltV, [0, 1]],
    ] as const) {
      pass.uniforms.uDir.value = dir;
      pass.uniforms.uRes.value = [width, height];
      this.composer.addPass(pass);
    }
    this.composer.addPass(new OutputPass());
  }

  private buildPair(
    group: THREE.Group,
    ballGeo: THREE.BufferGeometry,
    stickGeo: THREE.BufferGeometry,
    ballMat: THREE.Material,
    stickMat: THREE.Material,
  ) {
    const a = new THREE.Mesh(ballGeo, ballMat);
    a.position.x = RUNG_HALF;
    const b = new THREE.Mesh(ballGeo, ballMat);
    b.position.x = -RUNG_HALF;
    const s = new THREE.Mesh(stickGeo, stickMat);
    group.add(a, b, s);
  }

  private buildEnvironment(): THREE.Texture {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = new THREE.Scene();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(10, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: `varying vec3 vP; void main(){ float h = vP.y*0.5+0.5; vec3 c = mix(vec3(0.02,0.07,0.25), vec3(0.55,0.75,1.0), smoothstep(0.2,1.0,h)); c += vec3(0.1,0.25,0.8)*smoothstep(0.6,1.0,-vP.z)*0.6; gl_FragColor = vec4(c,1.0);} `,
      }),
    );
    env.add(sky);
    const panel = (x: number, y: number, z: number, w: number, h: number, c: number, k: number) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide }),
      );
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel(-4, 6, 5, 5, 3, 0xffffff, 3.0); // soft-box key
    panel(6, 1, -4, 3, 6, 0x5d9bff, 2.0); // blue rim
    panel(0, -6, 2, 8, 2, 0x1f4fc0, 1.0);
    const tex = pmrem.fromScene(env, 0.035).texture;
    pmrem.dispose();
    return tex;
  }

  render(frame: number) {
    const f = frame;
    const cam = cameraAt(f, this.variant);
    this.camera.fov = cam.fov;
    this.camera.position.set(...cam.position);
    this.camera.up.set(...cam.up);
    this.camera.lookAt(...cam.target);
    this.camera.rotateZ(cam.roll);
    this.camera.updateProjectionMatrix();

    this.helix.rotation.set(cam.helixTiltX, 0, cam.helixTiltZ);

    const scroll = helixScroll(f);
    const spin = helixSpin(f);
    const isDocked = docked(f);
    const m = new THREE.Matrix4();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);

    for (let i = 0; i < RUNG_COUNT; i++) {
      const n = RUNG_MIN + i;
      const y = n * RUNG_SPACING + scroll;
      const th = n * TWIST_PER_RUNG + spin;
      const hidden = Math.abs(y) > 13 || (n === RED_RUNG && !isDocked);
      if (hidden) {
        this.balls.setMatrixAt(i * 2, zero);
        this.balls.setMatrixAt(i * 2 + 1, zero);
        this.sticks.setMatrixAt(i, zero);
        continue;
      }
      const c = Math.cos(th) * RUNG_HALF;
      const s = Math.sin(th) * RUNG_HALF;
      m.makeTranslation(c, y, s);
      this.balls.setMatrixAt(i * 2, m);
      m.makeTranslation(-c, y, -s);
      this.balls.setMatrixAt(i * 2 + 1, m);
      this.dummy.position.set(0, y, 0);
      this.dummy.rotation.set(0, -th, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.sticks.setMatrixAt(i, this.dummy.matrix);
    }
    this.balls.instanceMatrix.needsUpdate = true;
    this.sticks.instanceMatrix.needsUpdate = true;

    // --- red pair ---
    const redY = RED_RUNG * RUNG_SPACING + scroll;
    const redTh = RED_RUNG * TWIST_PER_RUNG + spin;
    const vis = redVisibility(f);
    this.redPair.visible = !isDocked && vis > 0.002;
    const rOff = redOffset(f);
    this.redPair.position.set(Math.cos(redTh) * rOff, redY, Math.sin(redTh) * rOff);
    this.redPair.rotation.set(0, -redTh, 0);
    const shrink = mix(0.82, 1, vis);
    this.redPair.scale.set(1, shrink, shrink);
    for (const mat of [this.redBallMat, this.redStickMat]) {
      mat.opacity = vis;
      mat.depthWrite = vis > 0.98;
    }
    const glow = redGlow(f);
    this.redBallMat.emissiveIntensity = 0.6 + 1.6 * glow;
    this.redStickMat.emissiveIntensity = 0.6 + 1.2 * glow;
    // darken as it dissolves (as in the reference)
    this.redBallMat.color.setHex(0xff4d6d).multiplyScalar(mix(0.25, 1, vis));

    // --- incoming pair ---
    const inc = incomingPair(f);
    this.newPair.visible = !isDocked && inc.opacity > 0.002;
    this.newPair.position.set(Math.cos(redTh) * inc.offset, redY, Math.sin(redTh) * inc.offset);
    this.newPair.rotation.set(0, -redTh, 0);
    const ghost = new THREE.Color(0x3d7fe6);
    const solid = new THREE.Color(0xb2d8f0);
    this.newBallMat.color.copy(ghost).lerp(solid, inc.solidity);
    this.newBallMat.emissive.setHex(0x1a4fb8).lerp(new THREE.Color(0x0b2d66), inc.solidity);
    this.newBallMat.emissiveIntensity = mix(1.4, 0.55, inc.solidity);
    this.newStickMat.color.setHex(0x5b93ee).lerp(new THREE.Color(0xe4eef9), inc.solidity);
    const op = inc.opacity * mix(0.55, 1, inc.solidity);
    for (const mat of [this.newBallMat, this.newStickMat]) {
      mat.opacity = op;
      mat.depthWrite = op > 0.98;
    }

    // --- particles ---
    const pixelScale = this.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    const layers = [this.dust, this.sparkle, this.bokehField, ...this.bokehHelices.map((b) => b.layer)];
    for (const l of layers) {
      l.material.uniforms.uTime.value = f;
      l.material.uniforms.uPixelScale.value = pixelScale;
    }
    this.dust.points.position.y = scroll * 0.35 + f * -0.002;
    this.dust.points.rotation.y = spin * 0.5 + f * 0.002;
    const sp = gapSparkle(f);
    this.sparkle.material.uniforms.uOpacity.value = sp * 1.1;
    this.sparkle.points.visible = sp > 0.001;
    this.sparkle.points.position.set(0, redY, 0);
    this.sparkle.points.rotation.set(0, -redTh + f * 0.01, 0);
    this.sparkle.points.scale.setScalar(0.8 + 0.5 * sp + (f - 250) * 0.002);

    for (const b of this.bokehHelices) {
      b.group.rotation.y = f * b.speed;
      b.group.position.y = ((f * b.speed * 2) % 6) * -0.0 + Math.sin(f / 160) * 0.3;
    }
    this.bokehField.points.position.x = f * 0.004;

    // --- background + post ---
    this.bgMaterial.uniforms.uTime.value = f;
    const scale = this.height / 2160;
    this.bloom.strength = 0.28;
    for (const pass of [this.tiltH, this.tiltV]) {
      pass.uniforms.uFocusY.value = cam.focusY;
      pass.uniforms.uFocusWidth.value = cam.focusWidth;
      pass.uniforms.uMaxRadius.value = 20 * scale * cam.blurStrength;
    }

    this.renderer.clear();
    this.composer.render();
  }

  dispose() {
    this.composer.dispose();
    this.renderer.dispose();
  }
}
