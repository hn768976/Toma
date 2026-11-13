import * as THREE from "three";
import { CamKey, evalCamera } from "./camera";
import { BOARD_HALF, Box, buildBackgroundTraces, buildComponents, buildMainTraces, buildTraceGeometry, makeRng, SOCKET_HALF } from "./layout";
import { Palette } from "./palettes";
import { Post } from "./post";
import { clamp, easeInOut, easeOutCubic, lerp, range, smooth } from "./rng";
import * as S from "./shaders";

export type Variant = "cpu" | "lock";

export type EngineOptions = {
  variant: Variant;
  palette: Palette;
  camera: CamKey[];
  /** total length in seconds (used to sample the camera corridor) */
  duration: number;
  /** yaw (degrees) the padlock faces once it has settled */
  lockYaw?: number;
  seed?: number;
};

const NEAR = 0.08;
const FAR = 420;
const FOG_DENSITY = 0.024;
const LID_HALF = 0.86;
const LID_REST = 0.15;

const col = (hex: string, mul = 1) => new THREE.Color(hex).multiplyScalar(mul);

const roundedRect = <T extends THREE.Path = THREE.Shape>(hw: number, hh: number, r: number, into: T = new THREE.Shape() as unknown as T): T => {
  into.moveTo(-hw + r, -hh);
  into.lineTo(hw - r, -hh);
  into.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false);
  into.lineTo(hw, hh - r);
  into.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false);
  into.lineTo(-hw + r, hh);
  into.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false);
  into.lineTo(-hw, -hh + r);
  into.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, false);
  return into;
};

/** Everything the renderer needs; `render(t)` is a pure function of time. */
export class Engine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private overlay = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 16 / 9, NEAR, FAR);
  private post: Post;
  private fogUniforms = { uFog: { value: new THREE.Color() }, uFogDensity: { value: FOG_DENSITY } };
  private u: Record<string, Record<string, THREE.IUniform>> = {};
  private chipLight!: THREE.PointLight;
  private lid!: THREE.Mesh;
  private lock?: THREE.Group;
  private disposables: { dispose: () => void }[] = [];
  private tLand: number;
  private lidFrom: number;

  constructor(canvas: HTMLCanvasElement, private opts: EngineOptions) {
    this.tLand = opts.variant === "cpu" ? 2.85 : 1.85;
    this.lidFrom = opts.variant === "cpu" ? 1.25 : 0.45;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0x000000, 1);
    this.post = new Post(this.renderer);
    this.build();
  }

  private track<T extends { dispose: () => void }>(x: T) {
    this.disposables.push(x);
    return x;
  }

  private shader(name: string, vert: string, frag: string, uniforms: Record<string, unknown>, extra: THREE.ShaderMaterialParameters = {}) {
    const u: Record<string, THREE.IUniform> = { ...this.fogUniforms };
    for (const [k, v] of Object.entries(uniforms)) u[k] = { value: v };
    this.u[name] = u;
    return this.track(new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: u, ...extra }));
  }

  private holo(name: string, p: Palette, o: Partial<Record<string, number>> = {}, extra: THREE.ShaderMaterialParameters = {}) {
    return this.shader(
      name,
      S.HOLO_VERT,
      S.HOLO_FRAG,
      {
        uColor: col(p.holo), uRim: col(p.holoRim), uBody: 0.5, uRimI: 1.6, uAlpha: 0.35, uRimPow: 2.2,
        uFill: 100, uGhost: 1, uSparkle: 0, uTime: 0, uIntensity: 1, ...o,
      },
      { transparent: true, ...extra },
    );
  }

  private build() {
    const p = this.opts.palette;
    const rng = makeRng(this.opts.seed ?? 20241);
    const { scene } = this;
    this.fogUniforms.uFog.value = col(p.fog);
    scene.fog = new THREE.FogExp2(col(p.fog).getHex(), FOG_DENSITY);

    // --- sky -----------------------------------------------------------------
    const sky = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(300, 32, 16)),
      this.shader("sky", S.SKY_VERT, S.SKY_FRAG, { uTop: col(p.skyTop), uHorizon: col(p.skyHorizon) }, { side: THREE.BackSide, depthWrite: false }),
    );
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    scene.add(sky);

    // --- lights (for the lit components) -----------------------------------------
    scene.add(new THREE.HemisphereLight(col(p.ambientSky), col(p.ambientGround), 2.2));
    const key = new THREE.DirectionalLight(col(p.key), 2.4);
    key.position.set(-8, 10, -16);
    scene.add(key);
    const rim = new THREE.DirectionalLight(col(p.key), 0.9);
    rim.position.set(12, 6, 10);
    scene.add(rim);
    this.chipLight = new THREE.PointLight(col(p.chipGlow), 0, 0, 2);
    this.chipLight.position.set(0, 1.1, 0);
    scene.add(this.chipLight);

    // --- board ---------------------------------------------------------------
    const board = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(700, 700)),
      this.shader("board", S.BOARD_VERT, S.BOARD_FRAG, {
        uBase: col(p.boardBase), uDetail: col(p.boardDetail), uSheen: col(p.boardSheen), uChipGlow: col(p.chipGlow), uGlow: 0,
      }),
    );
    board.rotation.x = -Math.PI / 2;
    scene.add(board);

    // --- traces --------------------------------------------------------------
    const mains = buildMainTraces(rng);
    const tg = buildTraceGeometry([...buildBackgroundTraces(rng), ...mains]);
    const traceGeo = this.track(new THREE.BufferGeometry());
    traceGeo.setAttribute("position", new THREE.BufferAttribute(tg.position, 3));
    traceGeo.setAttribute("uv", new THREE.BufferAttribute(tg.uv, 2));
    traceGeo.setAttribute("aInfo", new THREE.BufferAttribute(tg.info, 4));
    traceGeo.setIndex(new THREE.BufferAttribute(tg.index, 1));
    const traces = new THREE.Mesh(
      traceGeo,
      this.shader(
        "trace",
        S.TRACE_VERT,
        S.TRACE_FRAG,
        { uNear: col(p.traceNear), uFar: col(p.traceFar), uIdle: col(p.traceIdle), uFront: -1, uLead: 0, uTime: 0, uGlow: 1 },
        { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide },
      ),
    );
    traces.frustumCulled = false;
    traces.renderOrder = 1;
    scene.add(traces);

    // --- components ------------------------------------------------------------
    const camSamples: [number, number, number][] = [];
    for (let i = 0; i <= 240; i++) camSamples.push(evalCamera(this.opts.camera, (i / 240) * this.opts.duration).pos);
    const boxes = buildComponents(rng, mains, camSamples);
    const unit = this.track(new THREE.BoxGeometry(1, 1, 1));
    const tones = [col(p.compDark), col(p.compMid), col(p.compLight)];
    const addInstanced = (list: Box[], mat: THREE.Material, colorOf: (b: Box, i: number) => THREE.Color) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(unit, mat, list.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      list.forEach((b, i) => {
        q.setFromAxisAngle(up, -b.rot);
        m.compose(new THREE.Vector3(b.x, (b.y ?? 0) + b.sy / 2, b.z), q, new THREE.Vector3(b.sx, b.sy, b.sz));
        im.setMatrixAt(i, m);
        im.setColorAt(i, colorOf(b, i));
      });
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      scene.add(im);
      this.disposables.push(im);
    };
    const crng = makeRng(77);
    addInstanced(
      boxes.filter((b) => b.tone <= 2),
      this.track(new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.15 })),
      (b) => tones[b.tone].clone().multiplyScalar(range(crng, 0.7, 1.35)),
    );
    addInstanced(
      boxes.filter((b) => b.tone === 3),
      this.track(new THREE.MeshBasicMaterial({ fog: true })),
      () => col(crng() < 0.7 ? p.led : p.padRow, range(crng, 2.5, 7)),
    );
    addInstanced(
      boxes.filter((b) => b.tone === 4),
      this.track(new THREE.MeshBasicMaterial({ fog: true })),
      () => col(p.padRow, range(crng, 0.7, 1.9)),
    );
    addInstanced(
      boxes.filter((b) => b.tone === 5),
      this.track(
        new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0, transparent: true, opacity: 0.55, emissive: col(p.holo), emissiveIntensity: 0.3 }),
      ),
      () => col(p.holo, range(crng, 0.5, 1.0)),
    );

    // --- socket + chip ---------------------------------------------------------
    const frameShape = roundedRect<THREE.Shape>(SOCKET_HALF, SOCKET_HALF, 0.24);
    frameShape.holes.push(roundedRect(1.1, 1.1, 0.1, new THREE.Path()));
    const frameGeo = this.track(
      new THREE.ExtrudeGeometry(frameShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 10 }),
    );
    frameGeo.rotateX(-Math.PI / 2);
    const frame = new THREE.Mesh(frameGeo, this.holo("frame", { ...p, holo: p.chipGlow }, { uBody: 0.34, uRimI: 0.8, uAlpha: 0.4, uRimPow: 1.8 }));
    frame.position.y = 0.03;
    frame.renderOrder = 3;
    scene.add(frame);

    const baseMat = this.track(new THREE.MeshStandardMaterial({ color: col(p.compDark, 1.2), roughness: 0.35, metalness: 0.2, emissive: col(p.chipGlow), emissiveIntensity: 0 }));
    const base = new THREE.Mesh(this.track(new THREE.BoxGeometry(2.3, 0.1, 2.3)), baseMat);
    base.position.y = 0.05;
    scene.add(base);
    this.u.base = { emissive: { value: baseMat } };

    // contact dots along the socket frame
    const dots: Box[] = [];
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < 20; i++) {
        const u = (i - 9.5) * 0.118;
        const a = (s * Math.PI) / 2;
        const lx = 1.26;
        dots.push({ x: Math.cos(a) * lx - Math.sin(a) * u, z: Math.sin(a) * lx + Math.cos(a) * u, sx: 0.05, sy: 0.015, sz: 0.03, rot: a, tone: 4, y: 0.178 });
      }
    }
    const dotMat = this.track(new THREE.MeshBasicMaterial({ color: col(p.chipCore) }));
    this.u.dots = { mat: { value: dotMat } };
    addInstanced(dots, dotMat, () => new THREE.Color(1, 1, 1));

    const lidGeo = this.track(
      new THREE.ExtrudeGeometry(roundedRect<THREE.Shape>(LID_HALF - 0.02, LID_HALF - 0.02, 0.1), { depth: 0.14, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 8 }),
    );
    lidGeo.rotateX(-Math.PI / 2);
    this.lid = new THREE.Mesh(
      lidGeo,
      this.shader("lid", S.HOLO_VERT, S.LID_FRAG, { uGlowCol: col(p.chipGlow), uCore: col(p.chipCore), uI: 1, uAlpha: 1, uHalf: LID_HALF }, { transparent: true }),
    );
    this.lid.renderOrder = 4;
    scene.add(this.lid);

    // --- light beam --------------------------------------------------------------
    const H = 60;
    const beamGeo = this.track(new THREE.PlaneGeometry(LID_HALF * 2, H, 1, 1));
    beamGeo.translate(0, H / 2, 0);
    const beamMat = this.shader(
      "beam",
      S.BEAM_VERT,
      S.BEAM_FRAG,
      { uColor: col(p.holoRim), uBeam: 1, uEdge: 1, uTime: 0, uBottom: 0.3 },
      { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide },
    );
    for (let s = 0; s < 4; s++) {
      const m = new THREE.Mesh(beamGeo, beamMat);
      const a = (s * Math.PI) / 2;
      m.position.set(Math.sin(a) * LID_HALF, 0, Math.cos(a) * LID_HALF);
      m.rotation.y = a;
      m.renderOrder = 6;
      m.frustumCulled = false;
      scene.add(m);
    }

    // --- data rain -----------------------------------------------------------------
    const RAIN = 190;
    const rainGeo = this.track(new THREE.InstancedBufferGeometry());
    const plane = new THREE.PlaneGeometry(1, 1);
    rainGeo.index = plane.index;
    rainGeo.setAttribute("position", plane.getAttribute("position"));
    const aRain = new Float32Array(RAIN * 4);
    const aSize = new Float32Array(RAIN * 2);
    const rr = makeRng(991);
    for (let i = 0; i < RAIN; i++) {
      const a = rr() * Math.PI * 2;
      const r = range(rr, 15, 75);
      aRain.set([Math.cos(a) * r, Math.sin(a) * r, rr(), range(rr, 2.5, 8)], i * 4);
      aSize.set([range(rr, 0.22, 0.5) * (1 + r / 50), range(rr, 3, 9)], i * 2);
    }
    rainGeo.setAttribute("aRain", new THREE.InstancedBufferAttribute(aRain, 4));
    rainGeo.setAttribute("aSize", new THREE.InstancedBufferAttribute(aSize, 2));
    rainGeo.instanceCount = RAIN;
    const rain = new THREE.Mesh(
      rainGeo,
      this.shader("rain", S.RAIN_VERT, S.RAIN_FRAG, { uColor: col(p.rain), uI: 1.5, uTime: 0 }, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    rain.frustumCulled = false;
    rain.renderOrder = 5;
    scene.add(rain);

    // --- floating bokeh dust (drawn after depth of field) ----------------------------
    const DUST = 700;
    const dustGeo = this.track(new THREE.BufferGeometry());
    const dp = new Float32Array(DUST * 3);
    const ds = new Float32Array(DUST * 4);
    const dr = makeRng(4242);
    for (let i = 0; i < DUST; i++) {
      dp.set([range(dr, -16, 16), range(dr, 0.15, 6) * (dr() < 0.6 ? 0.4 : 1), range(dr, -16, 16)], i * 3);
      ds.set([dr(), dr(), dr(), Math.pow(dr(), 2.5)], i * 4);
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dp, 3));
    dustGeo.setAttribute("aSeed", new THREE.BufferAttribute(ds, 4));
    const dust = new THREE.Points(
      dustGeo,
      this.shader("dust", S.DUST_VERT, S.DUST_FRAG, { uColor: col(p.led), uI: 2.2, uTime: 0, uHeightPx: 1080, uFocus: 5, uAperture: 1, uTanHalfFov: 0.36 }, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }),
    );
    dust.frustumCulled = false;
    this.overlay.add(dust);

    if (this.opts.variant === "lock") this.buildLock(p);
  }

  private buildLock(p: Palette) {
    const g = new THREE.Group();
    const bodyGeo = this.track(
      new THREE.ExtrudeGeometry(roundedRect<THREE.Shape>(0.58, 0.48, 0.1), { depth: 0.3, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 3, curveSegments: 10 }),
    );
    bodyGeo.translate(0, 0, -0.15);
    const mat = this.holo("lock", p, { uBody: 0.62, uRimI: 2.4, uAlpha: 0.62, uRimPow: 1.8, uSparkle: 1, uGhost: 0.16 });
    const body = new THREE.Mesh(bodyGeo, mat);
    g.add(body);
    // shackle
    const R = 0.33;
    const pts: THREE.Vector3[] = [];
    pts.push(new THREE.Vector3(-R, 0.44, 0), new THREE.Vector3(-R, 0.82, 0));
    for (let i = 1; i < 16; i++) {
      const a = Math.PI - (i / 16) * Math.PI;
      pts.push(new THREE.Vector3(Math.cos(a) * R, 0.82 + Math.sin(a) * R, 0));
    }
    pts.push(new THREE.Vector3(R, 0.82, 0), new THREE.Vector3(R, 0.44, 0));
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.1);
    const shackle = new THREE.Mesh(this.track(new THREE.TubeGeometry(curve, 64, 0.085, 14, false)), mat);
    g.add(shackle);
    // keyhole, on both faces
    const ks = new THREE.Shape();
    ks.absarc(0, 0.07, 0.085, -Math.PI * 0.32, Math.PI * 1.32, false);
    ks.lineTo(-0.075, -0.17);
    ks.lineTo(0.075, -0.17);
    ks.closePath();
    const keyGeo = this.track(new THREE.ShapeGeometry(ks, 20));
    const keyMat = this.track(new THREE.MeshBasicMaterial({ color: col(p.holoRim, 1.7), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    this.u.key = { mat: { value: keyMat } };
    for (const z of [0.19, -0.19]) {
      const k = new THREE.Mesh(keyGeo, keyMat);
      k.position.z = z;
      k.renderOrder = 9;
      g.add(k);
      const inner = new THREE.Mesh(this.track(new THREE.CircleGeometry(0.045, 20)), this.track(new THREE.MeshBasicMaterial({ color: col(p.traceFar, 0.5), transparent: true, depthWrite: false })));
      inner.position.set(0, 0.07, z + Math.sign(z) * 0.002);
      if (z < 0) inner.rotation.y = Math.PI;
      inner.renderOrder = 10;
      inner.userData.inner = true;
      g.add(inner);
    }
    body.renderOrder = 8;
    shackle.renderOrder = 8;
    this.lock = g;
    this.scene.add(g);
  }

  /** Render the frame at time t (seconds) into the canvas at the given pixel size. */
  render(t: number, pxW: number, pxH: number) {
    const { opts, tLand } = this;
    const p = opts.palette;
    const isLock = opts.variant === "lock";
    if (this.renderer.domElement.width !== pxW || this.renderer.domElement.height !== pxH) {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(pxW, pxH, false);
    }
    this.post.setSize(pxW, pxH);

    // ---- timeline ----
    const since = t - tLand;
    const landed = since >= 0;
    const flash = landed ? Math.exp(-since * 3.0) : 0;
    const drop = clamp((t - this.lidFrom) / (tLand - this.lidFrom));
    const glow = landed ? 1 + 1.6 * Math.exp(-since * 2.4) + 0.05 * Math.sin(t * 2.6) : 0.05 + 0.12 * drop * drop;
    const front = landed ? 0.4 + since * 9 + since * since * 3 : -3;

    // lid
    const lidY = LID_REST + (isLock ? 7 : 9) * (1 - drop * drop) + (landed ? 0 : 0.0);
    this.lid.position.y = lidY;
    this.u.lid.uI.value = landed ? 1.15 + 1.3 * flash : 0.75 + 0.3 * drop;
    this.u.lid.uAlpha.value = landed ? 1 : 0.5 + 0.3 * drop;
    this.lid.visible = t >= this.lidFrom - 0.01 || true;

    this.u.board.uGlow.value = glow * 0.55;
    this.chipLight.intensity = glow * 26;
    (this.u.base.emissive.value as THREE.MeshStandardMaterial).emissiveIntensity = landed ? 0.5 : 0.05;
    (this.u.dots.mat.value as THREE.MeshBasicMaterial).color.copy(col(p.chipGlow, landed ? 1.1 + 2 * flash : 0.3));
    this.u.frame.uIntensity.value = landed ? 1.15 + 0.7 * flash : 0.6;
    this.u.frame.uAlpha.value = landed ? 0.5 : 0.35;

    this.u.trace.uFront.value = front;
    this.u.trace.uLead.value = landed ? Math.exp(-since * 0.9) : 0;
    this.u.trace.uTime.value = t;
    this.u.trace.uGlow.value = 1 + 1.3 * flash;

    // beam: full shaft before the drop, thin dashed guides afterwards
    const beamAfter = isLock ? lerp(1, 0.0, smooth(0, 4.5, since)) : lerp(1, 0, smooth(0.2, 3.2, since));
    const edgeAfter = isLock ? lerp(1, 0.0, smooth(3.6, 6.2, since)) : lerp(1, 0, smooth(0.6, 2.8, since));
    this.u.beam.uBeam.value = landed ? beamAfter * 0.8 : 1;
    this.u.beam.uEdge.value = landed ? edgeAfter : 1;
    this.u.beam.uTime.value = t;
    this.u.beam.uBottom.value = landed ? 0.3 : Math.min(lidY, 0.3);
    this.u.rain.uTime.value = t;

    // padlock
    let lockPos: THREE.Vector3 | null = null;
    if (this.lock) {
      const t0 = tLand + 0.1;
      const a = clamp((t - t0) / 3.3);
      const e = easeOutCubic(a);
      const rest = 1.62;
      const settle = smooth(0.85, 1, a);
      this.lock.visible = t >= t0;
      this.lock.position.set(0, lerp(6.2, rest, e) + 0.04 * Math.sin((t - t0) * 1.7) * settle, 0);
      const yaw = ((opts.lockYaw ?? 0) * Math.PI) / 180;
      this.lock.rotation.set(0, yaw + (1 - easeInOut(clamp((t - t0) / 3.7))) * Math.PI * 4.5, 0.32 * (1 - easeInOut(clamp((t - t0) / 3.2))));
      this.lock.scale.setScalar(1.4 * lerp(0.5, 1, easeOutCubic(clamp((t - t0) / 2.4))));
      const fill = smooth(0.25, 2.4, t - t0);
      this.u.lock.uFill.value = fill >= 1 ? 100 : lerp(-0.6, 1.35, fill);
      this.u.lock.uTime.value = t;
      this.u.lock.uIntensity.value = 0.95 + 0.05 * Math.sin(t * 2.1);
      const km = this.u.key.mat.value as THREE.MeshBasicMaterial;
      km.opacity = smooth(1.8, 2.6, t - t0);
      this.lock.children.forEach((c) => {
        if (c.userData.inner) ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = km.opacity * 0.9;
      });
      lockPos = this.lock.position;
    }

    // ---- camera ----
    const cs = evalCamera(opts.camera, t);
    const shake = flash * 0.035;
    this.camera.fov = cs.fov;
    this.camera.aspect = pxW / pxH;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(cs.pos[0] + Math.sin(t * 71) * shake, cs.pos[1] + Math.sin(t * 93 + 1) * shake, cs.pos[2] + Math.cos(t * 67) * shake);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(cs.look[0], cs.look[1], cs.look[2]);
    this.camera.rotateZ(cs.roll + Math.sin(t * 57) * shake * 0.25);
    this.camera.updateMatrixWorld();

    // focus pull: the padlock takes over from the chip once it has arrived
    let focus = cs.focus;
    if (lockPos && this.lock?.visible) {
      const toLock = this.camera.position.distanceTo(lockPos);
      focus = lerp(focus, toLock, smooth(tLand + 0.6, tLand + 2.4, t));
    }
    const tanHalf = Math.tan((cs.fov * Math.PI) / 360);
    this.u.dust.uTime.value = t;
    this.u.dust.uHeightPx.value = pxH;
    this.u.dust.uFocus.value = focus;
    this.u.dust.uAperture.value = cs.aperture;
    this.u.dust.uTanHalfFov.value = tanHalf;

    // screen position of the chip = centre of the impact zoom blur
    const c = new THREE.Vector3(0, 0.25, 0).project(this.camera);
    const frame = Math.round(t * 30);

    this.renderer.setRenderTarget(this.post.scene);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.post.render(
      {
        near: NEAR,
        far: FAR,
        focus,
        aperture: cs.aperture,
        bloom: 1 + 0.6 * flash,
        zoom: (isLock ? 0.1 : 0.2) * Math.exp(-Math.max(since, 0) * 4.2) * (landed ? 1 : 0) + (landed ? 0 : 0.06 * smooth(tLand - 0.35, tLand, t)),
        center: [clamp(c.x * 0.5 + 0.5, 0.1, 0.9), clamp(c.y * 0.5 + 0.5, 0.1, 0.9)],
        exposure: 0.9 + 0.2 * flash,
        tint: p.tint,
        saturation: p.saturation,
        seed: (frame * 7.31) % 251,
      },
      this.overlay,
      this.camera,
    );
    this.renderer.getContext().finish();
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.post.dispose();
    this.renderer.dispose();
  }
}

export { BOARD_HALF };
