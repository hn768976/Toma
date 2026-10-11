import * as THREE from "three";
import { getInputProps } from "remotion";
import { mulberry32 } from "../lib/random";
import { Bloom, COMMON, FullscreenPass, makeDofGather, makeRT, makeTent, shader } from "../gl/post";
import type { Stage, StageFactory } from "../gl/GLStage";
import {
  BELT_Y, COL, L, LINE2_Z, LOOP, RACK_Z, SPEED,
  buildConveyor, buildRacks, buildRoom, layoutLine, makeEnvironment, makeMaterials, parcelGroup, spinRollers,
  type ConveyorLine, type Mats, type PlacedParcel,
} from "./scene";
import { heroPanelGeometry, makeParcel, type ParcelKind } from "./parcels";

// Better soft shadows: 16 Vogel taps instead of three's 5 (fixed per-pixel
// rotation from gl_FragCoord, so it is stable frame to frame).
const patchShadowChunk = () => {
  const key = "shadowmap_pars_fragment";
  const chunk = THREE.ShaderChunk[key];
  if (chunk.includes("VOGEL16")) return;
  const start = chunk.indexOf("shadow = (\n\t\t\t\t\ttexture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5");
  if (start < 0) return;
  const end = chunk.indexOf(") * 0.2;", start) + ") * 0.2;".length;
  const repl = `/* VOGEL16 */ shadow = 0.0;
					for ( int vi = 0; vi < 16; vi ++ ) {
						shadow += texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( vi, 16, phi ) * radius, shadowCoord.z ) );
					}
					shadow *= 0.0625;`;
  (THREE.ShaderChunk as Record<string, string>)[key] = chunk.slice(0, start) + repl + chunk.slice(end);
};

export interface CamPose { pos: THREE.Vector3; target: THREE.Vector3; fov: number }

export interface ConveyorVariant {
  name: string;
  cam: (frame: number) => CamPose;
  focus: (frame: number, cam: CamPose) => number; // focus distance (m)
  blur: number; // CoC at infinity, fraction of frame height (radius)
  passBys: boolean;
  rackPass: boolean;
  hero: "none" | "label" | "green";
  window: [number, number]; // parcel wrap window relative to camera x (m)
  beltRange: [number, number];
}

type ParcelInst = { p: PlacedParcel; groups: THREE.Group[] };

// Debug switches for profiling (pass with --props='{"dbg":{"noAO":true}}').
const DBG: Record<string, boolean> = ((getInputProps() as { dbg?: Record<string, boolean> }).dbg) ?? {};

export class ConveyorStage implements Stage {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(20, 16 / 9, 0.05, 80);
  private key: THREE.DirectionalLight;
  private lines: Array<{ line: ConveyorLine; z: number }> = [];
  private parcels: Array<{ inst: ParcelInst[]; z: number; y: number; speed: number; topY?: number }> = [];
  private hero: { group: THREE.Group; panel: THREE.Mesh | null; x0: number } | null = null;
  private fgRack: THREE.Group | null = null;
  private maskScene = new THREE.Scene();
  private mats: Mats;
  // post
  private fs = new FullscreenPass();
  private sceneRT: THREE.WebGLRenderTarget;
  private maskRT: THREE.WebGLRenderTarget | null = null;
  private aoRT: THREE.WebGLRenderTarget;
  private aoBlurRT: THREE.WebGLRenderTarget;
  private cocRT: THREE.WebGLRenderTarget;
  private halfA: THREE.WebGLRenderTarget;
  private halfB: THREE.WebGLRenderTarget;
  private combRT: THREE.WebGLRenderTarget;
  private bloom: Bloom;
  private ssao: THREE.ShaderMaterial;
  private aoBlur: THREE.ShaderMaterial;
  private coc: THREE.ShaderMaterial;
  private gather = makeDofGather();
  private tent = makeTent();
  private combine: THREE.ShaderMaterial;
  private dofScale = 0.5;
  private final: THREE.ShaderMaterial;

  constructor(gl: THREE.WebGLRenderer, private W: number, private H: number, private v: ConveyorVariant) {
    patchShadowChunk();
    gl.shadowMap.enabled = !DBG.noShadow;
    gl.shadowMap.type = THREE.PCFShadowMap;
    gl.shadowMap.autoUpdate = true;
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    const mats = (this.mats = makeMaterials());
    const s = this.scene;
    s.background = COL.haze.clone().multiplyScalar(0.25);
    s.fog = new THREE.Fog(COL.haze.clone().multiplyScalar(0.5), 3.0, 34);
    s.environment = makeEnvironment(gl);
    s.environmentIntensity = 0.5;

    const [bx0, bx1] = v.beltRange;
    const line1 = buildConveyor(mats, 0, bx0, bx1);
    const line2 = buildConveyor(mats, LINE2_Z, bx0 - 3, bx1 + 3);
    this.lines.push({ line: line1, z: 0 }, { line: line2, z: LINE2_Z });
    s.add(line1.group, line2.group);
    if (!DBG.noRack) s.add(buildRacks(mats, RACK_Z, bx0 - 6, bx1 + 6, 4242));
    s.add(buildRoom(bx0 - 8, bx1 + 8));

    // Parcels. Line 1 pattern, line 2 pattern, optional near pass-by line.
    const heroOn = v.hero !== "none";
    const p1 = layoutLine(141, { gapMin: 0.12, gapMax: 0.55, zJitter: 0.16, force: { 8: "mailer" } });
    const p2 = layoutLine(202, { gapMin: 0.05, gapMax: 0.35, zJitter: 0.1, lowpoly: true });
    this.parcels.push({ inst: this.instances(p1, heroOn ? 1 : 0), z: 0, y: BELT_Y, speed: SPEED });
    this.parcels.push({ inst: this.instances(p2, 2), z: LINE2_Z, y: BELT_Y, speed: SPEED });
    if (v.passBys) {
      // a nearer, unseen line: an occasional very blurred box crossing the
      // bottom edge (2 boxes per period, whole cycles)
      const kinds = (r: () => number): ParcelKind => (r() < 0.5 ? "medium" : "tall");
      const p3 = layoutLine(303, { gapMin: 2.2, gapMax: 2.8, kinds, zJitter: 0, lowpoly: true }).slice(0, 2);
      this.parcels.push({ inst: this.instances(p3, 0), z: 0.9, y: 0, topY: 0.835, speed: SPEED });
    }

    if (heroOn) this.buildHero(v.hero === "green");
    if (v.rackPass) this.buildForegroundRack();

    // Lights
    const key = (this.key = new THREE.DirectionalLight(COL.key, 2.4));
    key.castShadow = true;
    key.shadow.mapSize.set(DBG.smallShadow ? 2048 : 4096, DBG.smallShadow ? 2048 : 4096);
    const sc = key.shadow.camera;
    sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -4; sc.near = 0.5; sc.far = 20;
    key.shadow.radius = 4;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.004;
    s.add(key, key.target);
    // overhead fixtures every L/2 above the line: warm pools of light that
    // fall off down the box faces (periodic, so tracking shots loop)
    for (let x = Math.floor((bx0 - 3) / 3) * 3 + 1.5; x <= bx1 + 3; x += 3) {
      const pl = new THREE.PointLight(COL.key, 3.2, 0, 2);
      pl.position.set(x, 1.95, 0.95);
      s.add(pl);
    }
    const fill = new THREE.DirectionalLight(new THREE.Color("#C9D2E0"), 0.25);
    fill.position.set(6, 2.5, 4);
    s.add(fill);

    // Render targets
    const w = W, h = H;
    this.sceneRT = makeRT(w, h, { samples: DBG.noMSAA ? 0 : 4, depth: true });
    this.aoRT = makeRT(w / 2, h / 2, { type: THREE.UnsignedByteType });
    this.aoBlurRT = makeRT(w / 2, h / 2, { type: THREE.UnsignedByteType });
    this.cocRT = makeRT(w, h);
    // DoF works at a fixed size (<= 960 wide) so the blur looks the same
    // at 720p and 4K
    this.dofScale = Math.min(0.5, 960 / w);
    this.halfA = makeRT(w * this.dofScale, h * this.dofScale);
    this.halfB = makeRT(w * this.dofScale, h * this.dofScale);
    this.combRT = makeRT(w, h);
    this.bloom = new Bloom(w, h, 6, 1.2, 0.8);
    if (v.hero === "green") this.maskRT = makeRT(w, h, { type: THREE.UnsignedByteType, samples: 4, depth: true });

    // SSAO kernel: fixed hemisphere samples (seeded), rotated per pixel by IGN.
    const kr = mulberry32(77);
    const kernel: THREE.Vector3[] = [];
    for (let i = 0; i < 14; i++) {
      const v3 = new THREE.Vector3(kr() * 2 - 1, kr() * 2 - 1, kr() * 0.85 + 0.15).normalize();
      const sc2 = (i + 1) / 14;
      v3.multiplyScalar(0.15 + 0.85 * sc2 * sc2);
      kernel.push(v3);
    }
    this.ssao = shader(`
      ${COMMON}
      uniform sampler2D tDepth; uniform mat4 proj; uniform mat4 invProj; uniform vec3 kernel[14]; uniform float radius; uniform vec2 texel;
      varying vec2 vUv;
      vec3 viewPos(vec2 uv) {
        float d = texture2D(tDepth, uv).x;
        vec4 c = invProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
        return c.xyz / c.w;
      }
      void main(){
        float d0 = texture2D(tDepth, vUv).x;
        if (d0 >= 1.0) { gl_FragColor = vec4(1.0); return; }
        vec3 p = viewPos(vUv);
        vec3 px1 = viewPos(vUv + vec2(texel.x, 0.0)), px0 = viewPos(vUv - vec2(texel.x, 0.0));
        vec3 py1 = viewPos(vUv + vec2(0.0, texel.y)), py0 = viewPos(vUv - vec2(0.0, texel.y));
        vec3 dx = abs(px1.z - p.z) < abs(p.z - px0.z) ? px1 - p : p - px0;
        vec3 dy = abs(py1.z - p.z) < abs(p.z - py0.z) ? py1 - p : p - py0;
        vec3 n = normalize(cross(dx, dy));
        float a = ign(gl_FragCoord.xy) * 6.2831853;
        vec3 rv = vec3(cos(a), sin(a), 0.0);
        vec3 t = normalize(rv - n * dot(rv, n));
        vec3 b = cross(n, t);
        mat3 tbn = mat3(t, b, n);
        float occ = 0.0;
        float rad = radius * (0.6 + 0.4 * clamp(-p.z / 3.0, 0.0, 1.0));
        for (int i = 0; i < 14; i++) {
          vec3 sp = p + tbn * kernel[i] * rad;
          vec4 o = proj * vec4(sp, 1.0);
          vec2 suv = o.xy / o.w * 0.5 + 0.5;
          float sz = viewPos(suv).z;
          float range = smoothstep(0.0, 1.0, rad / abs(p.z - sz));
          occ += (sz >= sp.z + 0.004 ? 1.0 : 0.0) * range;
        }
        float ao = 1.0 - occ / 14.0;
        gl_FragColor = vec4(vec3(ao), 1.0);
      }`, {
      tDepth: { value: this.sceneRT.depthTexture }, proj: { value: new THREE.Matrix4() }, invProj: { value: new THREE.Matrix4() },
      kernel: { value: kernel }, radius: { value: 0.09 }, texel: { value: new THREE.Vector2(2 / w, 2 / h) },
    });
    this.aoBlur = shader(`
      uniform sampler2D tAO; uniform sampler2D tDepth; uniform vec2 texel; uniform float near; uniform float far; varying vec2 vUv;
      float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
      void main(){
        float z0 = lin(texture2D(tDepth, vUv).x);
        float s = 0.0, ws = 0.0;
        for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
          vec2 uv = vUv + vec2(float(i), float(j)) * texel;
          float z = lin(texture2D(tDepth, uv).x);
          float w = exp(-abs(z - z0) / (0.02 * z0 + 0.005));
          s += texture2D(tAO, uv).r * w; ws += w;
        }
        gl_FragColor = vec4(vec3(s / ws), 1.0);
      }`, { tAO: { value: this.aoRT.texture }, tDepth: { value: this.sceneRT.depthTexture }, texel: { value: new THREE.Vector2(2 / w, 2 / h) }, near: { value: 0.05 }, far: { value: 80 } });
    this.coc = shader(`
      uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tAO; uniform float near; uniform float far;
      uniform float focus; uniform float cocInf; uniform float aoStrength; varying vec2 vUv;
      float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
      void main(){
        vec3 c = texture2D(tColor, vUv).rgb;
        float ao = texture2D(tAO, vUv).r;
        c *= mix(1.0, ao, aoStrength);
        float z = lin(texture2D(tDepth, vUv).x);
        // thin lens: CoC proportional to |1 - focus/z|, signed (near < 0)
        float coc = cocInf * (1.0 - focus / z);
        coc = clamp(coc, -cocInf * 1.2, cocInf);
        gl_FragColor = vec4(c, coc);
      }`, { tColor: { value: this.sceneRT.texture }, tDepth: { value: this.sceneRT.depthTexture }, tAO: { value: this.aoBlurRT.texture }, near: { value: 0.05 }, far: { value: 80 }, focus: { value: 1.7 }, cocInf: { value: 20 }, aoStrength: { value: 0.85 } });
    this.combine = shader(`
      uniform sampler2D tSharp; uniform sampler2D tBlur; uniform float invScale; varying vec2 vUv;
      void main(){
        vec4 s = texture2D(tSharp, vUv);
        vec4 b = texture2D(tBlur, vUv);
        // blend by own CoC (full-res px) or foreground coverage (half-res px)
        float c = max(abs(s.a), b.a * invScale);
        float t = smoothstep(0.7, 2.4, c);
        gl_FragColor = vec4(mix(s.rgb, b.rgb, t), 1.0);
      }`, { tSharp: { value: this.cocRT.texture }, tBlur: { value: this.halfA.texture }, invScale: { value: 1 / this.dofScale } });
    this.final = shader(`
      ${COMMON}
      uniform sampler2D tSrc; uniform sampler2D tBloom; uniform sampler2D tMask; uniform float useMask;
      uniform float exposure; uniform float bloomK; uniform float frame; uniform vec2 res; varying vec2 vUv;
      void main(){
        // slight lateral chromatic aberration toward the frame edges
        vec2 ca = (vUv - 0.5) * 0.0018;
        vec3 c = vec3(texture2D(tSrc, vUv + ca).r, texture2D(tSrc, vUv).g, texture2D(tSrc, vUv - ca).b) + texture2D(tBloom, vUv).rgb * bloomK;
        c *= exposure;
        // warm grade (pre-tonemap white balance)
        c *= vec3(1.02, 1.0, 0.95);
        vec3 t = acesFilm(c);
        // gentle lift in the shadows toward warm grey, slight contrast
        t = mix(vec3(0.028, 0.022, 0.016), vec3(1.0), t);
        t = mix(vec3(dot(t, vec3(0.2126, 0.7152, 0.0722))), t, 0.86);
        // vignette
        vec2 q = vUv - 0.5; q.x *= res.x / res.y;
        t *= 1.0 - 0.18 * smoothstep(0.4, 1.1, length(q));
        vec3 o = toSRGB(clamp(t, 0.0, 1.0));
        // grain (~1.5%) + dither (+-1/255): fixed function of pixel and frame
        float f = mod(frame, 600.0);
        float g = hash12(gl_FragCoord.xy + vec2(f * 37.0, f * 91.0)) + hash12(gl_FragCoord.yx * 1.31 + f * 17.0) - 1.0;
        o += g * 0.015;
        o += (ign(gl_FragCoord.xy + f * 5.588238) - 0.5) * (2.0 / 255.0);
        if (useMask > 0.5) {
          float m = texture2D(tMask, vUv).r;
          o = mix(o, vec3(0.0, 1.0, 0.0), m);
        }
        gl_FragColor = vec4(o, 1.0);
      }`, { tSrc: { value: this.combRT.texture }, tBloom: { value: null }, tMask: { value: this.maskRT ? this.maskRT.texture : null }, useMask: { value: this.maskRT ? 1 : 0 }, exposure: { value: 1.35 }, bloomK: { value: 0.12 }, frame: { value: 0 }, res: { value: new THREE.Vector2(w, h) } });
  }

  private instances(list: PlacedParcel[], copies: number): ParcelInst[] {
    const n = copies || Math.max(1, Math.ceil((this.v.window[1] - this.v.window[0]) / L));
    return list.map((p) => {
      const groups: THREE.Group[] = [];
      for (let c = 0; c < n; c++) {
        const g = parcelGroup(p.geo, this.mats);
        g.rotation.y = p.rotY;
        this.scene.add(g);
        groups.push(g);
      }
      return { p, groups };
    });
  }

  private buildHero(green: boolean) {
    // The hero: a long carton, label (or chroma panel) facing the camera.
    const size: [number, number, number] = [0.62, 0.3, 0.42];
    const geo = makeParcel("medium", 5150, {
      size,
      tint: 1.0,
      decals: [
        ...(green ? [] : [{ face: 4, region: "labelA" as const, a: -0.19, b: 0.02, w: 0.11, ink: false }]),
        { face: 4, region: "recycleBox" as const, a: 0.22, b: -0.06, w: 0.13, ink: true },
        { face: 0, region: "handling" as const, a: 0, b: 0.06, w: 0.15, ink: true },
      ],
    });
    const group = parcelGroup(geo, this.mats);
    let panel: THREE.Mesh | null = null;
    if (green) {
      const pg = heroPanelGeometry({ size }, -0.19, 0.02);
      // visible copy in the main scene (keeps depth/DoF sensible)…
      const vis = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 1, 0) }));
      group.add(vis);
      // …and the mask copy, composited after post as pure #00FF00
      panel = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      this.maskScene.add(panel);
      // black corner crop marks
      const markMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const mw = 0.11, mh = 0.17, len = 0.018, th = 0.0022, gap = 0.006;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const cx = -0.19 + sx * (mw / 2 + gap), cy = 0.02 + sy * (mh / 2 + gap);
        const hbar = new THREE.Mesh(new THREE.PlaneGeometry(len, th), markMat);
        hbar.position.set(cx - (sx * len) / 2 + sx * th / 2, cy, size[2] / 2 + 0.003);
        const vbar = new THREE.Mesh(new THREE.PlaneGeometry(th, len), markMat);
        vbar.position.set(cx, cy - (sy * len) / 2 + sy * th / 2, size[2] / 2 + 0.003);
        group.add(hbar, vbar);
      }
    }
    group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(group);
    this.hero = { group, panel, x0: 0 };
  }

  private buildForegroundRack() {
    // 1C: rack upright frame (two uprights + X bracing) close to the lens,
    // plus a signal panel on a post. One pass per loop (period L).
    const g = new THREE.Group();
    const up = new THREE.BoxGeometry(0.07, 3.2, 0.06);
    for (const x of [0, 0.9]) {
      const u = new THREE.Mesh(up, this.mats.upright);
      u.position.set(x, 1.6, 0);
      g.add(u);
    }
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.25, 0.03), this.mats.upright);
      b.position.set(0.45, 0.4 + k * 0.7, 0);
      b.rotation.z = (k % 2 ? 1 : -1) * 0.8;
      g.add(b);
    }
    // signal panel on a post, half a period later
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.15, 12), this.mats.frame);
    post.position.set(L / 2, 0.575, 0.15);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.08), new THREE.MeshStandardMaterial({ color: "#8a8d92", metalness: 0.5, roughness: 0.45 }));
    box.position.set(L / 2, 1.2, 0.15);
    g.add(post, box);
    const lampG = new THREE.CylinderGeometry(0.025, 0.025, 0.012, 20);
    lampG.rotateX(Math.PI / 2);
    const lamps: Array<[number, THREE.Color]> = [[-0.1, new THREE.Color(9, 0.6, 0.25)], [0.0, new THREE.Color(0.6, 6.5, 0.6)], [0.08, new THREE.Color(0.6, 6.5, 0.6)]];
    for (const [dx, c] of lamps) {
      const l = new THREE.Mesh(lampG, new THREE.MeshBasicMaterial({ color: c }));
      l.position.set(L / 2 + dx, 1.2, 0.195);
      g.add(l);
    }
    this.fgRack = g;
    this.scene.add(g);
  }

  private place(frame: number, camX: number) {
    const travel = frame * SPEED;
    for (const lane of this.parcels) {
      const lo = camX + this.v.window[0];
      for (const it of lane.inst) {
        const base = it.p.x0 - travel;
        const rel = (((base - lo) % L) + L) % L;
        it.groups.forEach((g, c) => {
          const y = lane.topY !== undefined ? lane.topY - it.p.geo.size[1] / 2 : lane.y + it.p.geo.size[1] / 2;
          g.position.set(lo + rel + c * L, y, lane.z + it.p.z);
        });
      }
    }
    for (const { line, z } of this.lines) spinRollers(line, z, travel);
    if (this.hero) {
      // the hero rides line 1 at belt speed; at frame 0 it is at x = 0
      this.hero.group.position.set(-travel, BELT_Y + 0.15, 0.02);
      if (this.hero.panel) this.hero.panel.position.copy(this.hero.group.position);
    }
    if (this.fgRack) {
      // static in the world, 0.55 m in front of the belt: repeat every L
      const lo = camX - L / 2;
      const rel = ((((0 - lo) % L) + L) % L);
      this.fgRack.position.set(lo + rel - 1.0, 0, 1.05);
    }
  }

  render(gl: THREE.WebGLRenderer, frame: number) {
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const pose = this.v.cam(f);
    const cam = this.camera;
    cam.position.copy(pose.pos);
    cam.fov = pose.fov;
    cam.aspect = this.W / this.H;
    cam.near = 0.05;
    cam.far = 80;
    cam.lookAt(pose.target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    this.place(f, pose.pos.x);

    // key light follows the camera in x, snapped to whole shadow texels
    // (texel = 8 m / 4096; L is a whole number of texels -> loops exactly)
    const texel = 8 / 4096;
    const sx = Math.round(pose.pos.x / texel) * texel;
    this.key.position.set(sx - 3.6, BELT_Y + 3.4, 1.5);
    this.key.target.position.set(sx, BELT_Y, -0.2);
    this.key.target.updateMatrixWorld();

    // 1. scene -> HDR (MSAA)
    gl.setRenderTarget(this.sceneRT);
    gl.setClearColor(0x000000, 1);
    gl.clear();
    gl.render(this.scene, cam);
    // 1b. chroma panel mask (only the panel, in its own MSAA buffer)
    if (this.maskRT) {
      gl.setRenderTarget(this.maskRT);
      gl.setClearColor(0x000000, 1);
      gl.clear();
      gl.render(this.maskScene, cam);
    }
    // 2. SSAO (half res) + depth-aware blur
    this.ssao.uniforms.proj.value.copy(cam.projectionMatrix);
    this.ssao.uniforms.invProj.value.copy(cam.projectionMatrixInverse);
    if (!DBG.noAO) {
      this.fs.run(gl, this.ssao, this.aoRT);
      this.fs.run(gl, this.aoBlur, this.aoBlurRT);
    }
    // 3. AO composite + signed CoC
    const cocPx = this.v.blur * this.H;
    this.coc.uniforms.focus.value = this.v.focus(f, pose);
    this.coc.uniforms.cocInf.value = cocPx;
    this.fs.run(gl, this.coc, this.cocRT);
    // 4. DoF gather at the working resolution (CoC scaled to its pixels)
    const ds = this.dofScale, dw = this.halfA.width, dh = this.halfA.height;
    // taps read the full-res colour+CoC directly, so every tap keeps its
    // own CoC (no mixing of thin bright details with the background's CoC)
    this.gather.uniforms.tSrc.value = this.cocRT.texture;
    this.gather.uniforms.texel.value.set(1 / dw, 1 / dh);
    this.gather.uniforms.cocScale.value = ds;
    this.gather.uniforms.maxCoc.value = Math.max(2, cocPx * 1.2 * ds);
    if (!DBG.noDof) this.fs.run(gl, this.gather, this.halfA);
    this.tent.uniforms.tSrc.value = this.halfA.texture;
    this.tent.uniforms.texel.value.set(1 / dw, 1 / dh);
    this.fs.run(gl, this.tent, this.halfB);
    this.combine.uniforms.tBlur.value = this.halfB.texture;
    this.fs.run(gl, this.combine, this.combRT);
    // 5. bloom
    const bl = DBG.noBloom ? this.combRT.texture : this.bloom.run(gl, this.fs, this.combRT.texture, this.W, this.H);
    // 6. grade, tonemap, vignette, grain, dither; chroma panel last
    this.final.uniforms.tBloom.value = bl;
    this.final.uniforms.frame.value = f;
    this.fs.run(gl, this.final, null);
  }

}

// ------------------------------------------------------------- variants --
const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const VARIANTS: Record<string, ConveyorVariant> = {
  side: {
    name: "Side View",
    cam: () => ({ pos: V3(0, 1.05, 2.2), target: V3(0, 1.012, 0), fov: 16 }),
    focus: () => 2.03,
    blur: 0.05,
    passBys: true,
    rackPass: false,
    hero: "none",
    window: [-3, 3],
    beltRange: [-9, 9],
  },
};

export const conveyorFactory = (key: string): StageFactory => (gl, w, h) => new ConveyorStage(gl, w, h, VARIANTS[key]);
