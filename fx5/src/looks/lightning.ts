import { Capsules, SEG_DIST, type Seg } from '../lib/capsules';
import { FINISH, NOISE } from '../lib/glsl';
import { Bloom, Pass, makeRT } from '../lib/pixi';
import type { SceneFactory } from '../lib/PixiStage';
import { hash01, hexToLinear, mulberry32, smoothstep } from '../lib/random';

export interface LightningParams {
  core: string;    // main channel colour
  branch: string;  // branch colour
  skyTop: string | null;    // null → pure black overlay
  skyBottom: string | null;
  skyFlash: boolean;
  loopFrames: number;
}

const W = 3840;
const H = 2160;

// ~7 strikes per 600-frame loop; strike lengths + gaps sum to exactly 600.
const STRIKES = [48, 66, 39, 72, 54, 63, 45];
const GAPS = [30, 33, 27, 33, 30, 27, 33];
const SCHEDULE = (() => {
  const out: { start: number; len: number }[] = [];
  let t = 0;
  STRIKES.forEach((len, i) => {
    t += GAPS[i];
    out.push({ start: t - GAPS[i] + GAPS[i], len });
    t += len;
  });
  if (t !== 600) throw new Error('lightning schedule must divide 600');
  return out;
})();

type Pt = [number, number];

/** midpoint displacement between a and b; amp in px, rough 0..1 */
function displace(a: Pt, b: Pt, depth: number, amp: number, rnd: () => number, decay = 0.56): Pt[] {
  let pts: Pt[] = [a, b];
  let A = amp;
  for (let d = 0; d < depth; d++) {
    const next: Pt[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      const off = (rnd() * 2 - 1) * A;
      next.push([mx + (-dy / len) * off, my + (dx / len) * off], pts[i + 1]);
    }
    pts = next;
    A *= decay;
  }
  return pts;
}

interface Bolt {
  main: Pt[];
  branches: { pts: Pt[]; level: number; i0: number }[];
}

/** The whole bolt for strike k (shape) and re-form index sub (fine jitter). */
function makeBolt(k: number, sub: number): Bolt {
  const rnd = mulberry32(Math.floor(hash01(k, 911) * 2 ** 31));
  const jit = mulberry32(Math.floor(hash01(k, sub, 313) * 2 ** 31));
  const x0 = W * (0.4 + 0.2 * rnd());
  const x1 = x0 + W * (rnd() - 0.5) * 0.12;
  // coarse shape from k, finest two levels from (k, sub) so it crackles
  const coarse = displace([x0, -40], [x1, H + 40], 5, 230, rnd, 0.38);
  // a pronounced, smooth S-curve sway on top of the displacement
  const sway = W * (0.01 + 0.012 * rnd()) * (rnd() < 0.5 ? -1 : 1);
  const swayPh = rnd() * 0.6;
  coarse.forEach((pt) => {
    pt[0] += sway * Math.sin(Math.PI * 2 * (pt[1] / H) * 0.85 + swayPh);
  });
  const main: Pt[] = [coarse[0]];
  for (let i = 0; i < coarse.length - 1; i++) {
    const seg = displace(coarse[i], coarse[i + 1], 2, 5, jit, 0.5);
    main.push(...seg.slice(1));
  }
  const branches: Bolt['branches'] = [];
  const nb = 3 + Math.floor(rnd() * 2);
  for (let b = 0; b < nb; b++) {
    const u = 0.12 + 0.8 * Math.pow(rnd(), 0.7);
    const i0 = Math.floor(u * (main.length - 1));
    const [sx, sy] = main[i0];
    const side = b % 2 === 0 ? -1 : 1; // alternate sides
    // mostly down-and-out; the odd branch reaches sideways or back up
    const ang = side * (rnd() < 0.25 ? 1.6 + 0.9 * rnd() : 0.3 + 0.8 * rnd()); // from straight down
    const len = H * (0.4 + 0.5 * rnd()) * (1.1 - 0.4 * u);
    const ex = sx + Math.sin(ang) * len;
    const ey = sy + Math.cos(ang) * len;
    const pts = displace([sx, sy], [ex, ey], 5, len * 0.07, rnd, 0.4);
    branches.push({ pts, level: 1, i0 });
    // sub-branches
    const ns = 0;
    for (let s = 0; s < ns; s++) {
      const j = Math.floor((0.2 + 0.6 * rnd()) * (pts.length - 1));
      const [qx, qy] = pts[j];
      const a2 = ang + side * (0.2 + 0.5 * rnd()) * (rnd() < 0.3 ? -1 : 1);
      const l2 = len * (0.25 + 0.35 * rnd());
      branches.push({
        pts: displace([qx, qy], [qx + Math.sin(a2) * l2, qy + Math.cos(a2) * l2], 5, l2 * 0.09, rnd, 0.5),
        level: 2,
        i0,
      });
    }
  }
  // a faint ghost channel running alongside the upper two-thirds of the trunk
  const ghostEnd = Math.floor(main.length * (0.55 + 0.15 * rnd()));
  const off = -W * (0.012 + 0.01 * rnd());
  const ghost = main.slice(0, ghostEnd).map(([x, y], i) => [x + off + Math.sin(i * 0.21 + k) * 14, y] as Pt);
  branches.push({ pts: ghost, level: 3, i0: 0 });
  return { main, branches };
}

function toSegs(bolt: Bolt, reveal: number, branchOn: (i: number) => number): Seg[] {
  const segs: Seg[] = [];
  const revealY = -40 + reveal * (H + 80);
  const m = bolt.main;
  for (let i = 0; i < m.length - 1; i++) {
    if (m[i][1] > revealY) break;
    segs.push({ ax: m[i][0], ay: m[i][1], bx: m[i + 1][0], by: m[i + 1][1], w: 10, ia: 0.42, ib: 0.42, kind: 0 });
  }
  bolt.branches.forEach((br, bi) => {
    const on = branchOn(bi);
    if (on <= 0.01) return;
    const n = br.pts.length - 1;
    for (let i = 0; i < n; i++) {
      if (br.pts[i][1] > revealY) break;
      const fa = br.level === 3 ? 1 - Math.pow(i / n, 3) : Math.pow(1 - i / n, 1.3);
      const fb = br.level === 3 ? 1 - Math.pow((i + 1) / n, 3) : Math.pow(1 - (i + 1) / n, 1.3);
      const base = (br.level === 1 ? 0.09 : br.level === 3 ? 0.06 : 0.06) * on;
      segs.push({
        ax: br.pts[i][0], ay: br.pts[i][1], bx: br.pts[i + 1][0], by: br.pts[i + 1][1],
        w: (br.level === 1 ? 15 : br.level === 3 ? 12 : 9) * (0.6 + 0.4 * fa),
        ia: base * fa, ib: base * fb, kind: 1,
      });
    }
  });
  return segs;
}

const BOLT_FRAG = /* glsl */ `
in vec2 vP; in vec4 vSeg; in vec4 vProp; in vec2 vPath;
out vec4 finalColor;
uniform vec3 uCore; uniform vec3 uBranch; uniform float uS;
${SEG_DIST}
void main() {
  vec2 dh = segDist(vP, vSeg.xy, vSeg.zw);
  float aa = 0.75 / uS;                 // ~0.75 physical px of edge softness
  float w = max(vProp.x, 0.9 / uS);     // never thinner than ~1 physical px
  float thin = min(vProp.x / w, 1.0);   // keep energy when clamped
  // soft-edged channel (gaussian core) plus a short halo that is gone well
  // before the quad edge (pad = 30 design px)
  float x = dh.x / w;
  float core = (vProp.w < 0.5 ? exp(-x * x * 0.8) : exp(-x * x * 0.3)) * thin;
  float halo = exp(-dh.x / (w * 1.2)) * 0.35 * (1.0 - smoothstep(8.0, 28.0, dh.x - w));
  float i = mix(vProp.y, vProp.z, dh.y);
  // trunk: lavender-white at the top, the green-white core colour lower down;
  // branches: the branch colour softened toward dusty mauve
  vec3 trunk = mix(vec3(0.82, 0.8, 1.0), uCore, smoothstep(900.0, 2000.0, vP.y));
  vec3 col = vProp.w < 0.5 ? trunk : mix(uBranch, vec3(0.75, 0.55, 0.8) * length(uBranch) * 0.58, 0.4);
  finalColor = vec4(col * i * (core + halo), 1.0);
}
`;

const OUT_FRAG = /* glsl */ `
in vec2 vUV; out vec4 finalColor;
uniform sampler2D uBolt;
uniform sampler2D uB0; uniform sampler2D uB1; uniform sampler2D uB2; uniform sampler2D uB3; uniform sampler2D uB4;
uniform vec3 uTop; uniform vec3 uBottom; uniform float uSky; uniform float uFlash;
uniform vec2 uFlashPos; uniform float uFrameMod; uniform float uOverlay; uniform vec3 uBranch;
${NOISE}
${FINISH}
void main() {
  vec2 uv = vUV;
  // sky: deep blue at the top to near-black at the bottom, slightly brighter centre-top
  float y = uv.y;
  // brightest at the top centre, falling off quickly downward and to the sides
  float vig = exp(-pow((uv.x - 0.6) / 0.3, 2.0));
  vec3 sky = uBottom * smoothstep(0.2, 1.0, y) * vec3(1.3, 1.3, 0.5) + uTop * vec3(0.85, 1.15, 1.0) * exp(-5.2 * y) * mix(0.12, 1.0, vig) * (1.0 - smoothstep(0.55, 0.85, y));
  // faint whole-sky flash at each strike, strongest near the bolt's top
  float fd = length((uv - uFlashPos) * vec2(1.7778, 1.0));
  sky += uFlash * (uTop * 0.8 + uBranch * 0.12) * (0.6 * exp(-fd * 1.8) + 0.2) * exp(-4.0 * y);
  sky *= uSky;
  vec3 bolt = texture(uBolt, uv).rgb;
  // a modest halo: mostly the two finest bloom levels
  vec3 glow = texture(uB0, uv).rgb * 0.9 + texture(uB1, uv).rgb * 0.5 + texture(uB2, uv).rgb * 0.18
            + texture(uB3, uv).rgb * 0.08 + texture(uB4, uv).rgb * 0.05;
  vec3 c = sky + bolt * 0.85 + glow * 0.75;
  c = 1.0 - exp(-c * 1.15);
  vec3 s = linearToSrgb(c);
  if (uOverlay > 0.5) s = max(s - 2.0 / 255.0, 0.0) * (255.0 / 253.0);
  finalColor = vec4(finishColor(s, uFrameMod, 0.015), 1.0);
}
`;

export const lightningScene: SceneFactory<LightningParams> = ({ renderer, w, h, s }, p) => {
  const boltRT = makeRT(w, h);
  const bloom = new Bloom(w, h, 5, 2);
  const caps = new Capsules(
    BOLT_FRAG,
    {
      uCore: { value: hexToLinear(p.core).map((c) => c * 1.6), type: 'vec3<f32>' },
      uBranch: { value: hexToLinear(p.branch).map((c) => c * 1.7), type: 'vec3<f32>' },
    },
    s,
  );
  const overlay = !p.skyTop;
  const out = new Pass(
    w,
    h,
    OUT_FRAG,
    {
      uTop: { value: hexToLinear(p.skyTop ?? '#000000'), type: 'vec3<f32>' },
      uBottom: { value: hexToLinear(p.skyBottom ?? '#000000'), type: 'vec3<f32>' },
      uSky: { value: overlay ? 0 : 1, type: 'f32' },
      uFlash: { value: 0, type: 'f32' },
      uFlashPos: { value: [0.5, 0], type: 'vec2<f32>' },
      uFrameMod: { value: 0, type: 'f32' },
      uOverlay: { value: overlay ? 1 : 0, type: 'f32' },
      uBranch: { value: hexToLinear(p.branch), type: 'vec3<f32>' },
    },
    {
      uBolt: boltRT.source,
      uB0: bloom.levels[0].source,
      uB1: bloom.levels[1].source,
      uB2: bloom.levels[2].source,
      uB3: bloom.levels[3].source,
      uB4: bloom.levels[4].source,
    },
  );
  return {
    render(frame) {
      const f = frame % 600;
      let segs: Seg[] = [];
      let flash = 0;
      let flashX = 0.5;
      SCHEDULE.forEach(({ start, len }, k) => {
        const tau = f - start;
        if (tau < 0 || tau >= len) return;
        const sub = Math.floor(tau / 7);
        const bolt = makeBolt(k, sub);
        const reveal = Math.min(1, (tau + 1) / 3);
        // envelope: bright arrival, fast flicker from a hash of the frame bucket, fade out
        const bucket = Math.floor(f / 2);
        const hsh = hash01(bucket, k, 77);
        let flick = 0.6 + 0.4 * hsh;
        if (hsh < 0.12) flick = 0.18;
        const arrive = tau < 3 ? 1.5 : tau < 6 ? 1.2 : 1;
        const fade = 1 - smoothstep(len * 0.55, len, tau);
        const env = arrive * flick * fade;
        const branchOn = (bi: number) =>
          (hash01(bi, k, Math.floor(f / 3), 5) < 0.85 ? 1 : 0.25) * smoothstep(0, 4, tau);
        segs = toSegs(bolt, reveal, branchOn).map((sg) => ({ ...sg, ia: sg.ia * env, ib: sg.ib * env }));
        flash = p.skyFlash ? (tau < 4 ? 0.55 : 0.25 * flick) * fade : 0;
        flashX = bolt.main[0][0] / W;
      });
      caps.set(segs, 30);
      renderer.render({ container: caps.root, target: boltRT, clear: true, clearColor: [0, 0, 0, 0] });
      bloom.run(renderer, boltRT, 2);
      out.u.uFlash = flash;
      out.u.uFlashPos = [flashX, 0.05];
      out.u.uFrameMod = frame % p.loopFrames;
      out.draw(renderer);
    },
  };
};
