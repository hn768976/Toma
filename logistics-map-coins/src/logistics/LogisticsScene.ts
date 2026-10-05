import * as THREE from 'three';
import {defaultPostParams, PostPipeline} from '../three/Post';
import type {SceneController} from '../three/ThreeStage';
import type {MapRasters} from '../lib/geo';
import {mulberry32} from '../lib/random';
import {clamp, easeInOut, phase, smoothstep, TAU} from '../lib/anim';
import {lonLatToWorld, makeMapMaterial, makeMapTextures} from './mapMaterial';
import {iconAspect, iconTexture} from './icons';
import type {MapVersion, RouteDef} from './versions';

export const LOOP = 600;

const ARC_VERT = /* glsl */ `
varying float vT;
void main() {
  vT = uv.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const ARC_FRAG = /* glsl */ `
uniform vec3 color;
uniform float pulse;
uniform float pulseWidth;
uniform float head;
uniform float tail;
uniform float base;
uniform float pulseGain;
varying float vT;
void main() {
  float vis = smoothstep(tail - 0.01, tail + 0.01, vT) * (1.0 - smoothstep(head - 0.01, head + 0.01, vT));
  float p = exp(-pow((vT - pulse) / pulseWidth, 2.0));
  // a short bright trail behind the pulse
  float trail = smoothstep(pulse - pulseWidth * 6.0, pulse, vT) * step(vT, pulse) * 0.35;
  // the drawing head glows while an arc is drawing on
  float hg = exp(-pow((vT - head) / 0.02, 2.0)) * step(head, 0.999) * 2.0;
  float ends = smoothstep(0.0, 0.03, vT) * smoothstep(1.0, 0.97, vT);
  float a = vis * ends * (base + (p + trail) * pulseGain + hg);
  gl_FragColor = vec4(color * a, 1.0);
}
`;

const RING_FRAG = /* glsl */ `
uniform vec3 color;
uniform float alpha;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float ring = smoothstep(0.78, 0.9, r) * (1.0 - smoothstep(0.92, 1.0, r));
  float disc = (1.0 - smoothstep(0.0, 0.6, r)) * 0.25;
  gl_FragColor = vec4(color * (ring + disc) * alpha, 1.0);
}
`;
const PLAIN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const GLOW_FRAG = /* glsl */ `
uniform vec3 color;
uniform float alpha;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float g = exp(-r * r * 5.0) * (1.0 - smoothstep(0.8, 1.0, r));
  gl_FragColor = vec4(color * g * alpha, 1.0);
}
`;

const hdr = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k);

type ArcObj = {core: THREE.Mesh; halo: THREE.Mesh; mats: THREE.ShaderMaterial[]};
type CounterObj = {mesh: THREE.Mesh; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; values: string[]; step: number; prefix: string; last: string};
type RouteObj = {def: RouteDef; pts: THREE.Vector3[]; cum: number[]; total: number; sprites: THREE.Sprite[]; aspect: number};

export class LogisticsScene implements SceneController {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private v: MapVersion;
  private arcs: {def: MapVersion['arcs'][number]; obj: ArcObj}[] = [];
  private rings: {mesh: THREE.Mesh; mat: THREE.ShaderMaterial; period: number; offset: number; size: number}[] = [];
  private counters: CounterObj[] = [];
  private routes: RouteObj[] = [];
  private statics: {sprite: THREE.Sprite; base: THREE.Color; offset: number}[] = [];
  private post = defaultPostParams();
  private scale: number;
  private clear = new THREE.Color('#03080A');

  constructor(gl: THREE.WebGLRenderer, width: number, height: number, v: MapVersion, rasters: MapRasters) {
    this.v = v;
    const cam = v.camera;
    this.scale = cam.dist / 41;
    this.camera = new THREE.PerspectiveCamera(cam.fov, width / height, cam.dist * 0.05, cam.dist * 8);
    const target = lonLatToWorld(cam.target[0], cam.target[1]);

    // Ground / map
    const tex = makeMapTextures(rasters);
    const size = cam.dist * 4.2;
    const geo = new THREE.PlaneGeometry(size * 1.6, size, 640, 400);
    geo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(geo, makeMapMaterial(tex, v.look, v.hotspots, target, size * 0.62));
    ground.position.set(target.x, 0, target.z);
    ground.renderOrder = 0;
    this.scene.add(ground);

    // HUD layer on the ground
    this.scene.add(this.buildHud());

    const accent = hdr(v.accent, v.accentGain);
    const lift = v.look.reliefHeight * 0.6;

    // Pins
    v.pins.forEach((p, i) => {
      const t = iconTexture(p.kind);
      const isMain = p.kind !== 'pinMinor' && !(p.kind === 'badge' && !p.code);
      const color = isMain ? accent.clone() : hdr(v.minorColor ?? '#D9E6EA', 0.9);
      const mat = new THREE.SpriteMaterial({map: t, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true});
      const s = new THREE.Sprite(mat);
      const sz = v.pinSize * this.scale * (isMain ? 1 : 0.62) * (p.scale ?? 1);
      s.center.set(0.5, 0.02);
      s.scale.set(sz, sz * iconAspect(p.kind), 1);
      s.position.copy(lonLatToWorld(p.lon, p.lat, lift));
      s.renderOrder = 5;
      this.scene.add(s);
      if (isMain) {
        // base glow + pulse ring flat on the ground
        const glowMat = new THREE.ShaderMaterial({
          vertexShader: PLAIN_VERT, fragmentShader: GLOW_FRAG,
          uniforms: {color: {value: accent.clone().multiplyScalar(0.9)}, alpha: {value: 1}},
          blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
        });
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), glowMat);
        glow.scale.setScalar(sz * 1.4);
        glow.position.copy(lonLatToWorld(p.lon, p.lat, lift * 0.5));
        glow.renderOrder = 3;
        this.scene.add(glow);
        const ringMat = new THREE.ShaderMaterial({
          vertexShader: PLAIN_VERT, fragmentShader: RING_FRAG,
          uniforms: {color: {value: accent.clone()}, alpha: {value: 1}},
          blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
        });
        const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), ringMat);
        ring.position.copy(lonLatToWorld(p.lon, p.lat, lift * 0.5));
        ring.renderOrder = 4;
        this.scene.add(ring);
        const periods = [75, 100, 120, 150];
        this.rings.push({mesh: ring, mat: ringMat, period: periods[i % periods.length], offset: i * 37, size: sz * 1.6 * (p.ring ?? 1)});
      }
    });

    // Arcs
    for (const a of v.arcs) {
      const A = v.pins[a.from];
      const B = v.pins[a.to];
      const pa = lonLatToWorld(A.lon, A.lat, lift);
      const pb = lonLatToWorld(B.lon, B.lat, lift);
      const span = pa.distanceTo(pb);
      const h = span * (a.height ?? 0.3);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) {
        const t = i / 96;
        const p = pa.clone().lerp(pb, t);
        p.y += Math.sin(Math.PI * t) * h;
        pts.push(p);
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const r = v.arcRadius * this.scale * 41 / 41;
      const mk = (radius: number, base: number, gain: number, col: THREE.Color) => {
        const m = new THREE.ShaderMaterial({
          vertexShader: ARC_VERT, fragmentShader: ARC_FRAG,
          uniforms: {
            color: {value: col}, pulse: {value: 0}, pulseWidth: {value: 0.035}, head: {value: 1}, tail: {value: 0},
            base: {value: base}, pulseGain: {value: gain},
          },
          blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
        });
        const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 192, radius, 6, false), m);
        mesh.renderOrder = 6;
        this.scene.add(mesh);
        return {mesh, m};
      };
      const core = mk(r, 0.55, 3.5, accent.clone());
      const halo = mk(r * 4, 0.05, 0.35, accent.clone());
      this.arcs.push({def: a, obj: {core: core.mesh, halo: halo.mesh, mats: [core.m, halo.m]}});
    }

    // Out-of-focus light streaks on the map plane
    for (const st of v.streaks ?? []) {
      const m = new THREE.ShaderMaterial({
        vertexShader: PLAIN_VERT, fragmentShader: GLOW_FRAG,
        uniforms: {color: {value: hdr(st.color, st.gain)}, alpha: {value: 1}},
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), m);
      mesh.position.copy(lonLatToWorld(st.lon, st.lat, st.height));
      mesh.scale.set(st.length / 10, 1, st.width / 10);
      mesh.rotation.y = st.angle;
      mesh.renderOrder = 6;
      this.scene.add(mesh);
    }

    // Counters
    for (const c of v.counters) this.counters.push(this.buildCounter(c));

    // Transport icons
    for (const r of v.routes) {
      const pts = r.path.map(([lon, lat]) => lonLatToWorld(lon, lat, lift + v.iconSize * this.scale * 0.02));
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
      const sprites: THREE.Sprite[] = [];
      const col = r.color === 'white' ? hdr(v.iconWhite ?? '#DDF4FF', 1.5) : accent.clone();
      for (let i = 0; i < r.count; i++) {
        const mat = new THREE.SpriteMaterial({map: iconTexture(r.icon), color: col.clone(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true});
        const s = new THREE.Sprite(mat);
        s.center.set(0.5, 0.15);
        s.renderOrder = 7;
        this.scene.add(s);
        sprites.push(s);
      }
      this.routes.push({def: r, pts, cum, total: cum[cum.length - 1], sprites, aspect: iconAspect(r.icon)});
      // faint route line
      if (!r.altitude) {
        const lineMat = new THREE.LineBasicMaterial({color: col.clone().multiplyScalar(0.18), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false});
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
        line.renderOrder = 2;
        this.scene.add(line);
      }
    }
    v.staticIcons.forEach((si, i) => {
      const base = si.color === 'white' ? hdr(v.iconWhite ?? '#DDF4FF', 1.4) : accent.clone();
      const mat = new THREE.SpriteMaterial({map: iconTexture(si.icon), color: base.clone(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true});
      const s = new THREE.Sprite(mat);
      s.center.set(0.5, 0.1);
      const sz = v.iconSize * this.scale;
      s.scale.set(sz, sz * iconAspect(si.icon), 1);
      s.position.copy(lonLatToWorld(si.lon, si.lat, lift));
      s.renderOrder = 7;
      this.scene.add(s);
      this.statics.push({sprite: s, base, offset: i * 53});
    });

    const p = this.post;
    p.dof = true;
    p.aperture = v.post.aperture;
    p.maxBlur = v.post.maxBlur;
    p.nearScale = 0.6;
    p.bloomStrength = v.post.bloomStrength;
    p.bloomThreshold = v.post.bloomThreshold;
    p.bloomRadius = 0.85;
    p.vignette = v.post.vignette;
    p.topLight = v.post.topLight;
    p.exposure = v.post.exposure;
    p.toneMap = 'none';
    p.grain = 0.02;
    if (v.lift) p.lift.set(v.lift);
    if (v.haze) p.haze = {x: v.haze.x, y: v.haze.y, radius: v.haze.radius, color: new THREE.Color(v.haze.color).multiplyScalar(v.haze.strength)};
    void gl;
  }

  private buildHud() {
    const v = this.v;
    const [lon0, lon1, lat0, lat1] = v.hudBox;
    const W = 4096;
    const pxPerDeg = W / (lon1 - lon0);
    const H = Math.min(4096, Math.round((lat1 - lat0) * pxPerDeg));
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;
    const X = (lon: number) => (lon - lon0) * pxPerDeg;
    const Y = (lat: number) => (lat1 - lat) * (H / (lat1 - lat0));
    const fs = v.hudSize * pxPerDeg;
    const accentCss = v.accent;
    const soft = v.accent === '#5FE8FF' ? '#BFF6FF' : '#FFD2A8';
    const rng = mulberry32(0x4d5a + v.id.length * 97);
    ctx.lineCap = 'square';

    // long thin construction lines
    ctx.strokeStyle = 'rgba(150,215,225,0.16)';
    ctx.lineWidth = Math.max(1, fs * 0.05);
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      const horizontal = rng() < 0.5;
      if (horizontal) {
        const y = rng() * H;
        const x0 = rng() * W * 0.5;
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + W * (0.3 + rng() * 0.6), y);
      } else {
        const x = rng() * W;
        const y0 = rng() * H * 0.5;
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y0 + H * (0.3 + rng() * 0.6));
      }
      ctx.stroke();
    }
    // large faint frames
    ctx.strokeStyle = 'rgba(150,215,225,0.10)';
    for (let i = 0; i < 6; i++) {
      const x = rng() * W * 0.8;
      const y = rng() * H * 0.8;
      ctx.strokeRect(x, y, W * (0.08 + rng() * 0.15), H * (0.08 + rng() * 0.2));
    }

    const label = (x: number, y: number, text: string, size: number, color: string, alpha: number, font = 'Rajdhani', weight = 600) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size}px "${font}"`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, x, y);
      ctx.globalAlpha = 1;
      return ctx.measureText(text).width;
    };

    // pin labels with leader lines
    for (const p of v.pins) {
      if (!p.code) continue;
      const px = X(p.lon);
      const py = Y(p.lat);
      const lx = X(p.lon + (p.labelDx ?? 3));
      const ly = Y(p.lat + (p.labelDy ?? 3));
      ctx.strokeStyle = accentCss;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(1, fs * 0.06);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(lx, ly + fs * 0.25);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const w = label(lx, ly, p.code, fs, soft, 0.95);
      ctx.fillStyle = accentCss;
      ctx.fillRect(lx, ly + fs * 0.22, w, Math.max(1, fs * 0.07));
      ctx.fillRect(lx - fs * 0.4, ly - fs * 0.62, fs * 0.22, fs * 0.22);
      if (p.sub) label(lx, ly + fs * 1.15, p.sub, fs * 0.72, '#CFE6EA', 0.8, 'JetBrains Mono', 400);
    }
    for (const l of v.freeLabels) {
      const size = fs * (l.size ?? 0.85);
      const w = label(X(l.lon), Y(l.lat), l.text, size, '#CFE6EA', l.alpha ?? 0.75);
      // bracket marks
      ctx.strokeStyle = 'rgba(200,230,235,0.45)';
      ctx.lineWidth = Math.max(1, fs * 0.05);
      ctx.beginPath();
      ctx.moveTo(X(l.lon) - size * 0.3, Y(l.lat) - size * 0.9);
      ctx.lineTo(X(l.lon) - size * 0.3, Y(l.lat) + size * 0.25);
      ctx.lineTo(X(l.lon) + w * 0.3, Y(l.lat) + size * 0.25);
      ctx.stroke();
    }
    const ex = v.hudExtras ?? {};
    ctx.lineWidth = Math.max(1, fs * 0.05);
    for (let i = 0; i < (ex.diagonals ?? 0); i++) {
      ctx.strokeStyle = 'rgba(170,225,235,0.22)';
      ctx.beginPath();
      const x0 = rng() * W;
      const y0 = rng() < 0.5 ? 0 : rng() * H * 0.3;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + (rng() - 0.3) * W * 1.2, y0 + H * (0.7 + rng() * 0.5));
      ctx.stroke();
    }
    for (const [a0, b0, a1, b1] of ex.boxes ?? []) {
      const x0 = X(a0);
      const y0 = Y(b1);
      const x1 = X(a1);
      const y1 = Y(b0);
      ctx.strokeStyle = 'rgba(190,235,245,0.32)';
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      const k = fs * 0.9;
      ctx.strokeStyle = accentCss;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = Math.max(1, fs * 0.09);
      for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * k, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + dy * k);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(1, fs * 0.05);
    }
    for (const [lon, lat, text] of ex.badges ?? []) {
      const r = fs * 1.1;
      ctx.strokeStyle = soft;
      ctx.lineWidth = Math.max(1, fs * 0.08);
      ctx.beginPath();
      ctx.arc(X(lon), Y(lat), r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.textAlign = 'center';
      label(X(lon), Y(lat) + fs * 0.3, text, fs * 0.8, soft, 0.9);
      ctx.textAlign = 'start';
    }
    for (const [lon, lat, len] of ex.sliders ?? []) {
      const x0 = X(lon);
      const x1 = X(lon + len);
      const y = Y(lat);
      ctx.strokeStyle = 'rgba(200,235,240,0.6)';
      ctx.lineWidth = Math.max(1, fs * 0.08);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      const mx = x0 + (x1 - x0) * 0.62;
      ctx.fillStyle = soft;
      ctx.beginPath();
      ctx.moveTo(mx, y - fs * 0.15);
      ctx.lineTo(mx - fs * 0.35, y - fs * 0.65);
      ctx.lineTo(mx + fs * 0.35, y - fs * 0.65);
      ctx.closePath();
      ctx.fill();
    }
    for (let i = 0; i < (ex.dashBars ?? 0); i++) {
      const x = rng() * W;
      const y = rng() * H;
      ctx.fillStyle = accentCss;
      ctx.globalAlpha = 0.55 + rng() * 0.35;
      const n = 4 + Math.floor(rng() * 6);
      for (let k = 0; k < n; k++) ctx.fillRect(x + k * fs * 0.9, y, fs * 0.6, fs * 0.16);
      ctx.globalAlpha = 1;
    }
    // small tick clusters and dashes
    for (let i = 0; i < 26; i++) {
      const x = rng() * W;
      const y = rng() * H;
      const n = 3 + Math.floor(rng() * 6);
      ctx.fillStyle = rng() < 0.35 ? accentCss : '#9CC9D0';
      ctx.globalAlpha = 0.25 + rng() * 0.35;
      for (let k = 0; k < n; k++) ctx.fillRect(x + k * fs * 0.35, y, fs * 0.18, fs * 0.06);
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 14; i++) {
      const x = rng() * W;
      const y = rng() * H;
      ctx.strokeStyle = rng() < 0.4 ? accentCss : '#9CC9D0';
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = Math.max(1, fs * 0.05);
      ctx.setLineDash([fs * 0.4, fs * 0.25]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + fs * (3 + rng() * 6), y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    const mat = new THREE.MeshBasicMaterial({map: tex, color: new THREE.Color(1, 1, 1).multiplyScalar(1.25), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false});
    const wWorld = (lon1 - lon0) / 10;
    const hWorld = ((H / pxPerDeg)) / 10;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wWorld, hWorld).rotateX(-Math.PI / 2), mat);
    const latBottom = lat1 - H / pxPerDeg;
    mesh.position.copy(lonLatToWorld((lon0 + lon1) / 2, (lat1 + latBottom) / 2, v.look.reliefHeight));
    mesh.renderOrder = 1;
    return mesh;
  }

  private buildCounter(c: MapVersion['counters'][number]): CounterObj {
    const v = this.v;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshBasicMaterial({map: tex, color: new THREE.Color(1, 1, 1).multiplyScalar(1.4), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false});
    const hDeg = v.hudSize * 1.35 * (c.size ?? 1);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry((hDeg * 8) / 10, hDeg / 10).rotateX(-Math.PI / 2), mat);
    const p = lonLatToWorld(c.lon + hDeg * 4, c.lat, v.look.reliefHeight);
    mesh.position.copy(p);
    mesh.renderOrder = 2;
    this.scene.add(mesh);
    // fixed cycling sequence (LOOP / step values)
    const n = LOOP / c.step;
    const rng = mulberry32(0x9e37 + c.seed * 131);
    const values: string[] = [];
    let val = Math.floor(rng() * Math.pow(10, c.digits));
    for (let i = 0; i < n; i++) {
      val = (val + 1 + Math.floor(rng() * Math.pow(10, Math.max(1, c.digits - 2)))) % Math.pow(10, c.digits);
      values.push(String(val).padStart(c.digits, '0'));
    }
    return {mesh, canvas, tex, values, step: c.step, prefix: c.prefix, last: ''};
  }

  private drawCounter(co: CounterObj, text: string) {
    if (co.last === text) return; // texture content is a pure function of text
    co.last = text;
    const ctx = co.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 1024, 128);
    ctx.font = '500 72px "JetBrains Mono"';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.v.accent;
    ctx.fillText(text, 8, 66);
    co.tex.needsUpdate = true;
  }

  private placeCamera(frame: number) {
    const c = this.v.camera;
    const t = (frame % LOOP) / LOOP;
    const push = (1 - Math.cos(TAU * t)) / 2;
    const dist = c.dist * (1 - c.push * push);
    const yaw = THREE.MathUtils.degToRad(c.yaw + c.yawDrift * Math.sin(TAU * t));
    const tilt = THREE.MathUtils.degToRad(c.tilt);
    const target = lonLatToWorld(c.target[0], c.target[1]);
    const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    target.addScaledVector(right, c.side * this.scale * Math.sin(TAU * t));
    const pos = target.clone().addScaledVector(back, Math.sin(tilt) * dist).add(new THREE.Vector3(0, Math.cos(tilt) * dist, 0));
    this.camera.position.copy(pos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(target);
    if (c.roll) this.camera.rotateZ(THREE.MathUtils.degToRad(c.roll));
    this.camera.updateMatrixWorld();
    return pos.distanceTo(target);
  }

  render(frame: number, pipeline: PostPipeline) {
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const focus = this.placeCamera(f);

    for (const r of this.rings) {
      const p = phase(f, r.period, r.offset);
      r.mesh.scale.setScalar(r.size * (0.25 + 0.95 * p));
      r.mat.uniforms.alpha.value = Math.pow(1 - p, 1.6) * 1.4;
    }

    for (const {def, obj} of this.arcs) {
      const pp = phase(f, def.period, def.offset);
      let head = 1;
      let tail = 0;
      if (def.draw) {
        const [start, period] = def.draw;
        const local = phase(f - start, period) * period;
        head = easeInOut(local / 50);
        tail = easeInOut((local - 200) / 50);
        if (local >= 250) head = tail = 0;
      }
      for (const m of obj.mats) {
        m.uniforms.pulse.value = -0.15 + 1.3 * pp;
        m.uniforms.head.value = head;
        m.uniforms.tail.value = tail;
      }
      obj.core.visible = obj.halo.visible = head > tail + 0.001;
    }

    for (const co of this.counters) {
      const idx = Math.floor(f / co.step) % co.values.length;
      const close = co.prefix.trim().endsWith('[') ? ' ]' : '';
      this.drawCounter(co, `${co.prefix}${co.prefix.endsWith('[') ? ' ' : ''}${co.values[idx]}${close}`);
    }

    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    for (const r of this.routes) {
      r.sprites.forEach((s, i) => {
        const u = phase(f * r.def.laps, LOOP, (r.def.offset + i / r.def.count) * LOOP);
        const pos = this.along(r, u, tmpA);
        s.position.copy(pos);
        // face the direction of travel on screen; when a path turns back the
        // icon squashes through zero over a few frames instead of mirroring
        // instantly (no pop)
        const behind = this.along(r, Math.max(0, u - 0.04), tmpB).clone().project(this.camera);
        const ahead = this.along(r, Math.min(1, u + 0.04), tmpB).project(this.camera);
        const dx = (ahead.x - behind.x) / Math.max(1e-4, Math.hypot(ahead.x - behind.x, ahead.y - behind.y));
        const facing = THREE.MathUtils.clamp(dx / 0.35, -1, 1);
        const sz = this.v.iconSize * this.scale;
        s.scale.set(sz * (Math.abs(facing) < 0.08 ? 0.08 * Math.sign(facing || 1) : facing), sz * r.aspect, 1);
        const fade = smoothstep(0, 0.07, u) * (1 - smoothstep(0.93, 1, u));
        (s.material as THREE.SpriteMaterial).opacity = fade;
        s.visible = fade > 0.001;
      });
    }
    for (const st of this.statics) {
      const k = 0.75 + 0.25 * Math.sin(TAU * phase(f, 120, st.offset));
      (st.sprite.material as THREE.SpriteMaterial).color.copy(st.base).multiplyScalar(k);
    }

    pipeline.renderScene(this.scene, this.camera, this.clear);
    this.post.focus = focus;
    this.post.grainFrame = f;
    pipeline.post(this.camera, this.post);
  }

  private along(r: RouteObj, u: number, out: THREE.Vector3) {
    const d = clamp(u) * r.total;
    let i = 1;
    while (i < r.cum.length - 1 && r.cum[i] < d) i++;
    const seg = r.cum[i] - r.cum[i - 1] || 1;
    const t = (d - r.cum[i - 1]) / seg;
    out.copy(r.pts[i - 1]).lerp(r.pts[i], clamp(t));
    if (r.def.altitude) out.y += Math.sin(Math.PI * clamp(u)) * r.def.altitude * this.scale * 4;
    return out;
  }
}
