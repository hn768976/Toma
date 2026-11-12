// Builds the four Lottie loops for the Sea ABC pilot.
//   node scripts/lottie/build.mjs [outDir]
// Default output: public/lottie/*.json (consumed by @remotion/lottie).
import fs from 'node:fs';
import path from 'node:path';
import {
  E, ellipse, path as shPath, fill, group,
  shapeLayer, nullLayer, comp, smooth, poly, resetInd,
} from './lib.mjs';

// NO OUTLINES: every part is a base fill + a darker same-hue tone (~15-20%) for
// shading + a lighter tone for small highlights. Keep in sync with src/theme.ts.
const C = {
  navy: '#1E2A44',
  coral: '#FF8A8A', coralDark: '#DB6D74', coralLight: '#FFB4AE', coralDeep: '#C25E66',
  cream: '#FFF3DA', creamDark: '#EAD7B2',
  yellow: '#FFC93C', yellowDark: '#DBA62A', yellowLight: '#FFE592',
  orange: '#FF9233', orangeDark: '#D9752A', orangeLight: '#FFBC7E',
  grape: '#8B5FD0', grapeDark: '#6F48AE', grapeLight: '#AC8BE3',
  white: '#FFFFFF',
};

/** Thin filled quad from p0 (width w0) to p1 (width w1): ridges, stripes. */
const wedge = (p0, p1, w0, w1) => {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  return poly([
    [p0[0] + nx * w0 / 2, p0[1] + ny * w0 / 2], [p1[0] + nx * w1 / 2, p1[1] + ny * w1 / 2],
    [p1[0] - nx * w1 / 2, p1[1] - ny * w1 / 2], [p0[0] - nx * w0 / 2, p0[1] - ny * w0 / 2],
  ]);
};
/** Filled crescent along a quadratic curve p0 -> c -> p1, thickness 2t at the middle. */
const lensP = (p0, c, p1, t) => {
  const q = (cy) => {
    const c1 = [p0[0] + (2 / 3) * (c[0] - p0[0]), p0[1] + (2 / 3) * (cy - p0[1])];
    const c2 = [p1[0] + (2 / 3) * (c[0] - p1[0]), p1[1] + (2 / 3) * (cy - p1[1])];
    return [c1, c2];
  };
  const [a1, a2] = q(c[1] - t);
  const [b1, b2] = q(c[1] + t);
  return {
    c: true,
    v: [p0, p1],
    o: [[a1[0] - p0[0], a1[1] - p0[1]], [b2[0] - p1[0], b2[1] - p1[1]]],
    i: [[b1[0] - p0[0], b1[1] - p0[1]], [a2[0] - p1[0], a2[1] - p1[1]]],
  };
};
/** Transform a path object: scale about (ox,oy) then translate. */
const xf = (pth, k, ox, oy, dx = 0, dy = 0) => ({
  c: pth.c,
  v: pth.v.map(([x, y]) => [ox + (x - ox) * k + dx, oy + (y - oy) * k + dy]),
  i: pth.i.map(([x, y]) => [x * k, y * k]),
  o: pth.o.map(([x, y]) => [x * k, y * k]),
});

const outDir = process.argv[2] ?? path.join(process.cwd(), 'public', 'lottie');
fs.mkdirSync(outDir, { recursive: true });

const write = (name, data) => {
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(data));
  console.log('wrote', name, `${data.op} frames`, `${data.w}x${data.h}`);
};

// overshoot helper: scale a 2D vector
const sc = (v, k) => [v[0] * k, v[1] * k];

/* ------------------------------------------------------------------ */
/* a) CLAM OPEN — front view scallop clam, lid swings back            */
/* ------------------------------------------------------------------ */
function buildClam() {
  resetInd();
  const W = 520, H = 440;
  const hx = 260, hy = 300; // hinge line centre

  // scalloped fan for lid (in lid-local coords, hinge at 0,0, pointing up)
  const fanPts = [];
  const N = 9;
  for (let k = 0; k <= N * 2; k++) {
    const a = Math.PI + (k / (N * 2)) * Math.PI; // 180..360deg
    const r = k % 2 === 0 ? 218 : 232;
    fanPts.push([Math.cos(a) * r * 1.04, Math.sin(a) * r]);
  }
  const fanPath = smooth([[226, 0], [0, 6], [-226, 0], ...fanPts.slice(1, -1)], true, 0.9);
  const ridges = [];
  for (let k = 1; k < 8; k++) {
    const a = Math.PI + (k / 8) * Math.PI;
    ridges.push(shPath(wedge([Math.cos(a) * 40, Math.sin(a) * 30], [Math.cos(a) * 196, Math.sin(a) * 190], 3, 12)));
  }

  const root = nullLayer('root', {
    a: [hx, 430, 0],
    p: [hx, 430, 0],
    s: [
      [0, [100, 100, 100]],
      [4, [107, 93, 100]], // anticipation squeeze
      [8, [94, 106, 100], E.out], // release stretch
      [11, [101, 99, 100]],
      [12, [101, 99, 100], E.snap],
      [14, [109, 92, 100]], // recoil when Nova bursts out (global frame 32)
      [18, [96, 104, 100]],
      [23, [101.5, 98.5, 100]],
      [28, [100, 100, 100]],
      [44, [101, 99, 100]],
      [59, [100, 100, 100]],
    ],
  });

  const lidBack = shapeLayer(
    'lidBack',
    [
      group('ridges', [...ridges, fill(C.grapeLight)]),
      // darker tone deep inside the lid, near the hinge
      group('hingeShade', [ellipse(300, 70, 0, -6), fill(C.grapeDark)]),
      group('fan', [shPath(fanPath), fill(C.grape)]),
    ],
    {
      a: [0, 0, 0],
      p: [hx, hy - 2, 0],
      s: [
        [0, [100, 0, 100]],
        [6, [100, 0, 100], E.out],
        [10, [100, 114, 100]],
        [14, [100, 93, 100]],
        [19, [100, 103, 100]],
        [25, [100, 100, 100]],
        [42, [100, 98, 100]],
        [59, [100, 100, 100]],
      ],
      r: [[0, 0], [10, -3], [15, 2], [22, 0], [40, 1], [59, 0]],
      o: [[0, 0, null], [6, 100]],
    },
    { parent: root.ind },
  );

  const interior = shapeLayer(
    'interior',
    [
      // inside the clam: cream lining with a darker back half, inside a darker shell wall
      group('liningShade', [ellipse(330, 36, hx, hy - 12), fill(C.creamDark)]),
      group('lining', [ellipse(404, 86, hx, hy + 4), fill(C.cream)]),
      group('innerWall', [ellipse(432, 108, hx, hy), fill(C.grapeDark)]),
    ],
    {},
    { parent: root.ind },
  );

  const pearl = shapeLayer(
    'pearl',
    [
      group('hi2', [ellipse(10, 10, hx + 14, hy - 10), fill(C.white)]),
      group('hi', [ellipse(22, 16, hx - 12, hy - 42), fill(C.white)]),
      group('ball', [ellipse(72, 72, hx - 3, hy - 30), fill(C.cream)]),
      group('ballShade', [ellipse(80, 80, hx, hy - 26), fill(C.creamDark)]),
    ],
    {
      a: [hx, hy + 8, 0],
      p: [hx, hy + 8, 0],
      s: [
        [0, [0, 0, 100]],
        [7, [0, 0, 100], E.out],
        [10, [122, 122, 100]],
        [14, [92, 92, 100]],
        [19, [103, 103, 100]],
        [24, [100, 100, 100]],
      ],
    },
    { parent: root.ind },
  );

  // closed dome = lid seen from the front, flattens to edge-on as it swings back
  const lidFront = shapeLayer(
    'lidFront',
    [group('ridges', [...ridges, fill(C.grapeLight)]), group('dome', [shPath(fanPath), fill(C.grape)])],
    {
      a: [0, 0, 0],
      p: [hx, hy + 2, 0],
      s: [
        [0, [100, 30, 100]],
        [4, [100, 22, 100], E.in],
        [6, [100, 0, 100]],
      ],
      o: [[0, 100, null], [6, 0]],
    },
    { parent: root.ind },
  );

  // bottom bowl (front)
  const bowl = smooth(
    [[32, hy], [hx, hy + 8], [488, hy], [470, 360], [400, 412], [hx, 430], [120, 412], [50, 360]],
    true,
    1,
  );
  // flatten the rim: straight tangents across the top
  bowl.i[0] = [6, -18]; bowl.o[0] = [60, 6];
  bowl.i[1] = [-90, 0]; bowl.o[1] = [90, 0];
  bowl.i[2] = [-60, 6]; bowl.o[2] = [6, -18];
  const bowlRidges = [];
  for (let k = 1; k < 8; k++) {
    const x = 32 + (k / 8) * 456;
    bowlRidges.push(shPath(wedge([x + (hx - x) * 0.05, hy + 26], [hx + (x - hx) * 0.55, 410], 12, 3)));
  }
  const bowlLayer = shapeLayer(
    'bowl',
    [
      // lighter tone along the rim, light ridges, base, darker underside
      group('rimLip', [shPath(wedge([70, hy + 6], [450, hy + 6], 8, 8)), fill(C.grapeLight)]),
      group('ridges', [...bowlRidges, fill(C.grapeLight)]),
      group('bowl', [shPath(xf(bowl, 0.97, hx, hy, 0, -2)), fill(C.grape)]),
      group('bowlShade', [shPath(bowl), fill(C.grapeDark)]),
    ],
    {},
    { parent: root.ind },
  );

  return comp({
    nm: 'clam_open', w: W, h: H, op: 60,
    layers: [root, lidBack, interior, pearl, lidFront, bowlLayer],
  });
}

/* ------------------------------------------------------------------ */
/* PUFF parts (shared by idle and inflate)                            */
/* ------------------------------------------------------------------ */
const PW = 440, PC = [220, 220];
const P = (x, y) => [PC[0] + x, PC[1] + y];

function puffLayers({ rootKs, puffKs, spikeKs, eyesKs, mouthKs, finR, tailR, dorsalR }) {
  resetInd();
  const root = nullLayer('root', { a: [...P(0, 70), 0], p: [...P(0, 70), 0], ...rootKs });
  const puff = nullLayer('puffer', { a: [...P(0, 0), 0], p: [...P(0, 0), 0], ...puffKs }, { parent: root.ind });

  const spikes = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + 0.2;
    const b = 0.17;
    const pt = (ang, r) => [Math.cos(ang) * r, Math.sin(ang) * r];
    // two-tone spike: lit half + darker half (no outline)
    spikes.push(group(`spikeL${k}`, [shPath(poly([pt(a - b, 56), pt(a, 96), pt(a, 56)])), fill(C.orange)]));
    spikes.push(group(`spikeD${k}`, [shPath(poly([pt(a, 56), pt(a, 96), pt(a + b, 56)])), fill(C.orangeDark)]));
  }
  const spikeLayer = shapeLayer('spikes', [group('spk', spikes)], {
    a: [0, 0, 0], p: [...P(0, 0), 0], ...spikeKs,
  }, { parent: puff.ind });

  const tail = shapeLayer('tail', [
    group('tailfin', [
      shPath(smooth([[0, -6], [40, -34], [52, -30], [44, 0], [52, 30], [40, 34], [0, 6]], true, 0.8)),
      fill(C.orange),
    ]),
    group('tailShade', [shPath(smooth([[0, 2], [44, 0], [52, 30], [40, 34], [0, 6]], true, 0.8)), fill(C.orangeDark)]),
  ].reverse(), { a: [0, 0, 0], p: [...P(62, 4), 0], r: tailR }, { parent: puff.ind });

  const dorsal = shapeLayer('dorsal', [
    group('dfin', [
      shPath(smooth([[-22, 6], [-10, -26], [6, -30], [18, -14], [22, 6]], true, 0.8)),
      fill(C.orange),
    ]),
    group('dShade', [shPath(smooth([[4, -2], [18, -14], [22, 6], [-4, 8]], true, 0.8)), fill(C.orangeDark)]),
  ].reverse(), { a: [0, 0, 0], p: [...P(14, -62), 0], r: dorsalR }, { parent: puff.ind });

  const body = shapeLayer('body', [
    group('spots', [
      ellipse(20, 18, ...P(28, -38)), ellipse(14, 13, ...P(52, -4)), ellipse(22, 20, ...P(36, 36)),
      ellipse(12, 11, ...P(-12, 46)), ellipse(10, 9, ...P(4, -56)), fill(C.orange),
    ]),
    group('finShade', [ellipse(40, 18, ...P(30, 36)), fill(C.yellowDark)]),
    group('bellyShade', [ellipse(62, 14, ...P(-12, 50)), fill(C.creamDark)]),
    group('belly', [ellipse(74, 38, ...P(-14, 36)), fill(C.cream)]),
    group('shine', [ellipse(36, 18, ...P(-24, -44)), fill(C.yellowLight)]),
    group('ball', [ellipse(132, 128, ...P(-4, -5)), fill(C.yellow)]),
    group('ballShade', [ellipse(140, 136, ...P(0, 0)), fill(C.yellowDark)]),
  ], {}, { parent: puff.ind });

  const fin = shapeLayer('fin', [
    group('pfin', [
      shPath(smooth([[0, -7], [22, -14], [32, -4], [26, 10], [12, 12], [0, 6]], true, 0.9)),
      fill(C.orange),
    ]),
    group('pfinShade', [shPath(smooth([[0, 2], [30, 0], [26, 10], [12, 12], [0, 6]], true, 0.9)), fill(C.orangeDark)]),
  ].reverse(), { a: [0, 0, 0], p: [...P(30, 26), 0], r: finR }, { parent: puff.ind });

  const eyes = shapeLayer('eyes', [
    group('hl', [ellipse(6, 6, ...P(-40, -20)), ellipse(5, 5, ...P(-6, -22)), fill(C.white)]),
    group('dots', [ellipse(19, 21, ...P(-37, -16)), ellipse(16, 19, ...P(-4, -18)), fill(C.navy)]),
  ], { a: [...P(-20, -17), 0], p: [...P(-20, -17), 0], ...eyesKs }, { parent: puff.ind });

  const mouth = shapeLayer('mouth', [
    group('o', [ellipse(17, 15, ...P(-34, 18)), fill(C.navy)]),
  ], { a: [...P(-34, 18), 0], p: [...P(-34, 18), 0], ...mouthKs }, { parent: puff.ind });

  return [root, puff, spikeLayer, tail, dorsal, body, fin, eyes, mouth];
}

const osc = (start, end, period, amp, lag = 0, ease = E.inOut) => {
  // alternating keys amp/-amp every half period, starting from 0 at start
  const keys = [[start, 0, ease]];
  let sign = 1;
  for (let t = start + period / 4 + lag; t < end - period / 4; t += period / 2) {
    keys.push([Math.round(t * 10) / 10, sign * amp, ease]);
    sign *= -1;
  }
  keys.push([end, 0]);
  return keys;
};

function buildPuffIdle() {
  const op = 60;
  const by = PC[1] + 70;
  const layers = puffLayers({
    rootKs: {
      p: [
        [0, [PC[0], by, 0]], [15, [PC[0], by - 14, 0]], [30, [PC[0], by, 0]],
        [45, [PC[0], by - 14, 0]], [60, [PC[0], by, 0]],
      ],
      s: [
        [0, [104, 96, 100]], [15, [97, 103, 100]], [30, [104, 96, 100]],
        [45, [97, 103, 100]], [60, [104, 96, 100]],
      ],
    },
    puffKs: { r: [[0, -2], [15, 2], [30, -2], [45, 2], [60, -2]] },
    spikeKs: { s: [0, 0, 100] },
    eyesKs: {
      s: [
        [0, [100, 100, 100]], [40, [100, 100, 100], E.in], [42, [100, 8, 100]],
        [43, [100, 8, 100], E.out], [45, [100, 100, 100]], [60, [100, 100, 100]],
      ],
    },
    mouthKs: { s: [[0, [100, 100, 100]], [15, [110, 85, 100]], [30, [100, 100, 100]], [45, [110, 85, 100]], [60, [100, 100, 100]]] },
    finR: [[0, 20], [5, -22], [10, 20], [15, -22], [20, 20], [25, -22], [30, 20], [35, -22], [40, 20], [45, -22], [50, 20], [55, -22], [60, 20]],
    tailR: [[0, 12], [10, -12], [20, 12], [30, -12], [40, 12], [50, -12], [60, 12]],
    dorsalR: [[0, -8], [15, 8], [30, -8], [45, 8], [60, -8]],
  });
  return comp({ nm: 'puff_idle', w: PW, h: PW, op, layers });
}

function buildPuffInflate() {
  const op = 30;
  const by = PC[1] + 70;
  const layers = puffLayers({
    rootKs: { p: [PC[0], by, 0] },
    puffKs: {
      s: [
        [0, [100, 100, 100]],
        [3, [116, 86, 100], E.snap], // anticipation squash
        [6, [180, 180, 100]], // inflate, overshoot
        [8, [158, 158, 100]],
        [10, [166, 166, 100]],
        [12, [162, 162, 100]],
        [21, [164, 164, 100], E.in],
        [24, [84, 84, 100], E.out], // deflate past rest
        [26, [112, 90, 100]],
        [28, [94, 106, 100]],
        [30, [100, 100, 100]],
      ],
      r: [[0, 0], [9, 0], [11, 4], [13, -4], [15, 4], [17, -4], [19, 3], [21, 0], [25, -10], [28, 6], [30, 0]],
    },
    spikeKs: {
      s: [
        [0, [0, 0, 100]], [3, [0, 0, 100], E.out], [6, [118, 118, 100]], [8, [96, 96, 100]],
        [10, [100, 100, 100]], [21, [100, 100, 100], E.in], [23, [0, 0, 100]],
      ],
    },
    eyesKs: {
      s: [
        [0, [100, 100, 100]], [3, [118, 60, 100], E.snap], [6, [130, 130, 100]], [9, [120, 120, 100]],
        [21, [122, 122, 100]], [24, [90, 112, 100]], [28, [100, 100, 100]],
      ],
    },
    mouthKs: {
      s: [
        [0, [100, 100, 100]], [3, [70, 60, 100]], [6, [55, 40, 100]], [21, [55, 40, 100], E.snap],
        [24, [150, 160, 100]], [28, [100, 100, 100]],
      ],
    },
    finR: [[0, 20], [2, -30], [4, 30], [6, -30], [8, 30], [10, -30], [12, 30], [14, -30], [16, 30], [18, -30], [20, 30], [22, -30], [24, 30], [26, -20], [28, 15], [30, 20]],
    tailR: [[0, 12], [4, -18], [8, 18], [12, -18], [16, 18], [20, -18], [24, 18], [28, -10], [30, 12]],
    dorsalR: [[0, -8], [6, 10], [12, -10], [18, 10], [24, -10], [30, -8]],
  });
  return comp({ nm: 'puff_inflate', w: PW, h: PW, op, layers });
}

/* ------------------------------------------------------------------ */
/* d) NOVA CHEER — front 3/4                                         */
/* ------------------------------------------------------------------ */
function buildNovaCheer() {
  resetInd();
  const op = 90;
  const FX = 300, FY = 470; // feet / ground contact

  const root = nullLayer('root', {
    a: [FX, FY, 0],
    p: [
      [0, [FX, FY, 0]],
      [5, [FX, FY, 0], [0.2, 0.6, 0.35, 1]],
      [14, [FX, FY - 140, 0]],
      [16, [FX, FY - 140, 0], [0.6, 0, 0.9, 0.55]],
      [22, [FX, FY, 0]],
      [34, [FX, FY, 0], [0.2, 0.6, 0.35, 1]],
      [42, [FX, FY - 105, 0]],
      [44, [FX, FY - 105, 0], [0.6, 0, 0.9, 0.55]],
      [50, [FX, FY, 0]],
      [89, [FX, FY, 0]],
    ],
    s: [
      [0, [100, 100, 100]],
      [5, [117, 85, 100], E.snap], // anticipation squash
      [8, [86, 116, 100]], // launch stretch
      [13, [97, 103, 100]],
      [16, [101, 99, 100]],
      [20, [92, 109, 100], E.snap],
      [22, [125, 80, 100]], // landing squash
      [25, [93, 107, 100]],
      [28, [103, 97, 100]],
      [31, [100, 100, 100]],
      [34, [112, 89, 100], E.snap],
      [37, [89, 113, 100]],
      [41, [98, 102, 100]],
      [44, [101, 99, 100]],
      [48, [93, 108, 100], E.snap],
      [50, [120, 83, 100]],
      [53, [95, 105, 100]],
      [56, [102, 98, 100]],
      [60, [100, 100, 100]],
      [70, [101.5, 98.5, 100]],
      [80, [98.8, 101.2, 100]],
      [89, [100.5, 99.5, 100]],
    ],
    r: [
      [0, 0], [8, -4], [15, 3], [22, 0], [37, 4], [43, -3], [50, 0], [60, 0],
      [67, -5], [74, 5], [81, -3], [89, 1],
    ],
  });
  const P = { parent: root.ind };

  // tail flukes peeking behind the body, upper left
  const tail = shapeLayer('tail', [
    group('fluke', [
      shPath(smooth([[0, 0], [-30, -40], [-70, -70], [-92, -58], [-62, -46], [-58, -34], [-96, -22], [-82, -6], [-40, 4]], true, 0.9)),
      fill(C.coralDark),
    ]),
  ], {
    a: [0, 0, 0], p: [190, 300, 0],
    r: [[0, 0], [6, -12], [11, 16], [17, -10], [23, 14], [27, -8], [33, 0], [39, -12], [45, 14], [51, -10], [55, 8], [60, 0], [70, 8], [80, -6], [89, 0]],
  }, P);

  const farFin = shapeLayer('farFin', [
    group('fin', [
      shPath(smooth([[0, -10], [-44, -2], [-66, 22], [-50, 34], [-14, 22], [6, 10]], true, 0.9)),
      fill(C.coralDeep),
    ]),
  ], {
    a: [0, 0, 0], p: [168, 372, 0],
    r: osc(0, 89, 7, 34, 3).map(([t, v, e]) => [t, -v, e]),
  }, P);

  const blob = smooth([[300, 190], [390, 205], [448, 260], [462, 340], [432, 420], [352, 466], [250, 466], [170, 426], [140, 346], [160, 262], [215, 207]], true, 1);
  const belly = smooth([[220, 380], [300, 340], [400, 352], [438, 400], [400, 452], [300, 466], [226, 440]], true, 1);
  const body = shapeLayer('body', [
    group('spots', [ellipse(16, 12, 250, 232), ellipse(10, 8, 282, 220), ellipse(13, 10, 402, 248), fill(C.coralDark)]),
    // darker tone under the near fin
    group('finShade', [ellipse(58, 26, 420, 392), fill(C.coralDark)]),
    group('bellyShade', [ellipse(168, 28, 322, 444), fill(C.creamDark)]),
    group('belly', [shPath(belly), fill(C.cream)]),
    // lighter tone on top of the head
    group('headShine', [ellipse(130, 22, 292, 210), fill(C.coralLight)]),
    group('blob', [shPath(xf(blob, 0.965, 300, 190)), fill(C.coral)]),
    group('blobShade', [shPath(blob), fill(C.coralDark)]),
  ], {}, P);

  const nearFin = shapeLayer('nearFin', ([
    group('fin', [
      shPath(smooth([[0, -12], [44, -4], [70, 20], [54, 36], [14, 24], [-6, 10]], true, 0.9)),
      fill(C.coralLight),
    ]),
    group('finEdge', [shPath(smooth([[0, 6], [60, 22], [54, 36], [14, 24], [-6, 10]], true, 0.9)), fill(C.coral)]),
  ]).reverse(), {
    a: [0, 0, 0], p: [438, 368, 0],
    r: osc(0, 89, 7, 34, 3),
  }, P);

  // horn: local coords, base at 0,0 pointing up (-y)
  const hornShape = smooth([[-21, 0], [-14, -60], [-6, -130], [0, -152], [6, -130], [14, -60], [21, 0], [0, 6]], true, 0.6);
  // stripes as filled darker bands, inset so they stay inside the cone
  const stripes = [-36, -72, -104].map((y, k) => {
    const hw = 17 - k * 4.5;
    return shPath(wedge([-hw, y + 7], [hw, y - 7], 7, 7));
  });
  const horn = shapeLayer('horn', [
    group('stripes', [...stripes, fill(C.yellowDark)]),
    // lighter tone along the left (top) edge, darker right (under) side
    group('hornLight', [shPath(poly([[-17, -4], [-11, -62], [-4, -128], [-1, -146], [-6, -100], [-9, -50], [-11, -4]])), fill(C.yellowLight)]),
    group('hornDark', [shPath(poly([[2, 4], [2, -146], [6, -130], [14, -60], [21, 0], [8, 6]])), fill(C.yellowDark)]),
    group('cone', [shPath(hornShape), fill(C.yellow)]),
  ], {
    a: [0, 0, 0], p: [330, 206, 0],
    r: [[0, 22], [8, 28], [12, 16], [18, 24], [25, 14], [29, 26], [33, 22], [40, 28], [45, 16], [52, 26], [56, 20], [62, 22], [89, 22]],
  }, P);

  const blush = shapeLayer('blush', [
    group('cheeks', [ellipse(42, 22, 222, 352), ellipse(40, 22, 410, 346), fill(C.coralDark)]),
  ], {}, P);

  // open eyes
  const eye = (cx, cy, w, h, pr, k) =>
    group(`eye${k}`, [
      group('hl', [ellipse(pr * 0.75, pr * 0.75, cx + pr * 0.05, cy - pr * 0.42), ellipse(pr * 0.36, pr * 0.36, cx + pr * 0.85, cy + pr * 0.45), fill(C.white)]),
      group('pupil', [ellipse(pr * 2, pr * 2.1, cx + 10, cy + 6), fill(C.navy)]),
      group('white', [ellipse(w, h, cx, cy), fill(C.white)]),
    ]);
  const eyesOpen = shapeLayer('eyesOpen', [eye(262, 292, 64, 76, 21, 0), eye(356, 288, 70, 82, 22, 1)], {
    a: [310, 300, 0], p: [310, 300, 0],
    s: [[0, [100, 100, 100]], [3, [100, 100, 100], E.in], [6, [104, 12, 100]], [65, [104, 12, 100], E.out], [69, [100, 108, 100]], [72, [100, 100, 100]]],
    o: [[0, 100, null], [6, 0, null], [65, 100]],
  }, P);

  // happy squint: filled navy crescents (no strokes)
  const arc = (cx, cy, w) => shPath(lensP([cx - w, cy + 8], [cx, cy - 22], [cx + w, cy + 8], 4.5));
  const eyesHappy = shapeLayer('eyesHappy', [group('arcs', [arc(262, 296, 28), arc(356, 292, 30), fill(C.navy)])], {
    a: [310, 300, 0], p: [310, 300, 0],
    s: [[0, [100, 40, 100]], [6, [100, 40, 100], E.out], [9, [104, 110, 100]], [12, [100, 100, 100]]],
    o: [[0, 0, null], [6, 100, null], [65, 0]],
  }, P);

  const brows = shapeLayer('brows', [
    group('b', [
      shPath(lensP([240, 240], [262, 226], [284, 238], 3)),
      shPath(lensP([332, 234], [356, 220], [380, 232], 3)),
      fill(C.navy),
    ]),
  ], {
    p: [[0, [0, 0, 0]], [5, [0, 8, 0]], [9, [0, -10, 0]], [14, [0, -6, 0]], [60, [0, -6, 0]], [66, [0, -12, 0]], [72, [0, -4, 0]]],
  }, P);

  // mouth morph: closed smile -> big grin (same vertex count)
  const smile = {
    c: true,
    v: [[-26, -3], [0, 7], [26, -3], [0, 15]],
    i: [[6, 8], [-12, 0], [-8, 6], [14, 0]],
    o: [[8, 6], [12, 0], [-6, 8], [-14, 0]],
  };
  const grin = {
    c: true,
    v: [[-44, -10], [0, -4], [44, -10], [0, 42]],
    i: [[2, 18], [-18, 0], [-10, 4], [30, 0]],
    o: [[10, 4], [18, 0], [-2, 18], [-30, 0]],
  };
  const big = { ...grin, v: grin.v.map((p) => sc(p, 1.12)), i: grin.i.map((p) => sc(p, 1.12)), o: grin.o.map((p) => sc(p, 1.12)) };
  const mouth = shapeLayer('mouth', [
    group('tongue', [ellipse(36, 18, 0, 28), fill(C.coralDark)], {
      s: [[0, [0, 0]], [6, [0, 0], E.out], [9, [112, 112]], [12, [100, 100]]],
    }),
    group('m', [
      shPath([[0, smile], [5, smile, E.out], [9, big], [12, grin], [89, grin]]),
      fill(C.navy),
    ]),
  ], { p: [312, 362, 0] }, P);

  return comp({
    nm: 'nova_cheer', w: 600, h: 600, op,
    layers: [root, tail, farFin, body, nearFin, horn, blush, eyesOpen, eyesHappy, brows, mouth],
  });
}

write('clam_open.json', buildClam());
write('puff_idle.json', buildPuffIdle());
write('puff_inflate.json', buildPuffInflate());
write('nova_cheer.json', buildNovaCheer());
