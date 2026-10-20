import { RAMP as S, DIR, EDGE_U, TOP_U, rampAt, CHUTE, CHUTE_FRAME, J_START } from "../../src/machines/magnet.spec.ts";
import { k, G, T, fit, boxPoints, parts, solid, line, dots, plinth, beam, rod, collar, byDepth } from "./common.mjs";

const PLINTH = { x: -104, y: -34, w: 230, d: 84, r: 8 };
const deg = Math.PI / 180;
const N = [Math.sin(S.slope * deg), 0, Math.cos(S.slope * deg)]; // the ramp's up normal
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

export function build() {
  const P = fit([...boxPoints(-104, 126, -34, 50, -6, 12), ...boxPoints(-90, 112, -20, 30, 0, 104)], { fill: 0.7, fillH: 0.78, cy: 1080 + 40 });
  const out = parts();
  const plankDepth = S.ball + S.plankThickness / 2;
  /** the plank's centre line at ramp distance u */
  const plankAt = (u) => add(rampAt(u), N, -plankDepth);
  const plankPiece = (u0, u1, y0, y1) => {
    const a = add(plankAt(u0), [0, (y0 + y1) / 2, 0]);
    const b = add(plankAt(u1), [0, (y0 + y1) / 2, 0]);
    return beam(P, a, b, y1 - y0, S.plankThickness, "oak", { tone: "mid" });
  };
  const holeNear = EDGE_U;
  const holeFar = EDGE_U + (2 * S.holeHalf) / Math.cos(S.slope * deg);
  const W2 = S.plankWidth / 2;

  // ---- base and the lodestone's pillar -------------------------------------
  const [mx, , mz] = S.magnet;
  const stand = [];
  stand.push(solid(k.slabOf({ x: mx - 13, y: -13, w: 26, d: 26, r: 3 }, 12, 6, P, 4, 0.8), "oak", { tone: "mid" }));
  stand.push(solid(k.cylinder(mx, 0, 7, 18, 3, P, 40, 0.6), "brass", { tone: "mid" }));
  stand.push(solid(k.cylinder(mx, 0, 4, 21, mz - 34, P, 40), "brass", { tone: "mid", inner: k.lineSvg(k.sideArc(mx, 0, 4, 40, P, 20), { tone: "faint" }) }));
  stand.push(solid(k.cylinder(mx, 0, 6.5, mz - 13, 3, P, 40, 0.6), "brass", { tone: "mid" }));
  out.add("base", plinth(P, PLINTH, 12) + stand.join(""), { material: "oak" });

  // the armed lodestone: a dark stone in a brass cradle with iron pole pieces
  const stone = [];
  const F = G.frameOf([mx, 0, mz], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const rock = [
    [-10, -6],
    [-4, -10],
    [6, -9],
    [11, -2],
    [9, 7],
    [1, 10],
    [-8, 8],
    [-11, 1],
  ];
  stone.push(solid(k.slabOf({ x: mx - 11, y: -10, w: 22, d: 20, r: 3 }, mz - 10, 3, P, 4, 0.6), "brass", { tone: "mid" }));
  stone.push(solid(G.prismOf(F, rock, -7, 9, P), "iron", { tone: "hi" }));
  stone.push(solid(G.prismOf(G.frameOf([mx, 0, mz + 9], [0, 0, 1], [1, 0, 0], [0, 1, 0]), rock.map(([x, y]) => [x * 0.72, y * 0.72]), 0, 3.5, P), "iron", { tone: "hi" }));
  for (const y of [-7, 7]) stone.push(beam(P, [mx + 9, y, mz - 2], [mx + 15, y, mz - 3.5], 3.6, 5, "iron", { tone: "hi" }));
  stone.push(beam(P, [mx - 1, -11.5, mz - 8], [mx - 1, -11.5, mz + 7], 3, 2, "brass"));
  stone.push(beam(P, [mx - 1, 11.5, mz - 8], [mx - 1, 11.5, mz + 7], 3, 2, "brass"));
  stone.push(beam(P, [mx - 1, -11.5, mz + 7], [mx - 1, 11.5, mz + 7], 3, 2.4, "brass"));
  out.add("lodestone", stone.join(""), { material: "iron" });

  // ---- the ramp's top end support (behind the ramp) ------------------------
  const topEnd = plankAt(TOP_U);
  out.add("topPost", beam(P, [topEnd[0] + 2, 0, 12], [topEnd[0] + 2, 0, topEnd[2] - 2], 6, 6, "oak") + beam(P, [topEnd[0] - 6, 0, topEnd[2] - 3.5], [topEnd[0] + 10, 0, topEnd[2] - 3.5], 5, 3, "brass"), { material: "oak" });

  // ---- the return chute: two brass rails, then its supports ----------------
  const railPoints = (from, to, side) => {
    const pts = [];
    for (let i = from; i <= to; i++) {
      const { lat, up } = CHUTE_FRAME[i];
      pts.push(add(add(CHUTE[i], lat, side * 3.4), up, -3.7));
    }
    return pts;
  };
  const rails = (from, to) => {
    const pieces = [];
    for (const side of [-1, 1]) pieces.push(...T.tubePieces(railPoints(from, to, side), 1.05, P, { maxLength: 8 }));
    return byDepth(pieces, P, (p) => p.mid)
      .map((p) => `<g class="m-brass">${T.tubeSvg(p, { tone: "mid" })}</g>`)
      .join("");
  };
  // supports: brass posts from the plinth to a saddle under the rails
  const supports = [];
  for (const i of [30, 70, 110, 150, 182]) {
    const c = CHUTE[i];
    const { up } = CHUTE_FRAME[i];
    const under = add(c, up, -6.2);
    supports.push(solid(k.cylinder(under[0], under[1], 3.2, 12, 1.4, P, 24), "brass", { tone: "lo" }));
    supports.push(rod(P, [under[0], under[1], 13.4], under, 1.3, "brass"));
    const { lat } = CHUTE_FRAME[i];
    supports.push(rod(P, add(under, lat, -4.4), add(under, lat, 4.4), 1.1, "brass"));
  }
  // the catch at the chute's head, under the hole: an end stop
  const head = CHUTE[0];
  const headStop = collar(P, add(head, [-1, 0, 0], 3), [1, 0, 0], 3.6, 1.2, "brass", { tone: "mid" });
  const headPost = rod(P, [head[0] + 2, 0, 12], add(head, [0, 0, -6], 1), 1.4, "brass");
  out.add("chute", headPost + supports.join("") + headStop + rails(0, J_START), { material: "brass" });

  // ---- the ramp: posts, then the plank in two parts around the hole ---------
  const posts = [];
  for (const x of [72, 24]) {
    const u = (S.start[0] - x) / Math.cos(S.slope * deg);
    const b = plankAt(u);
    posts.push(solid(k.slabOf({ x: x - 6, y: -6, w: 12, d: 12, r: 1.5 }, 12, 4, P, 3, 0.5), "oak", { tone: "mid" }));
    posts.push(beam(P, [x, 0, 16], [x, 0, b[2] - S.plankThickness / 2 - 1], 6, 6, "oak"));
    posts.push(beam(P, [x - 6, 0, b[2] - S.plankThickness / 2 - 1.6], [x + 6, 0, b[2] - S.plankThickness / 2 + 1.0], 5, 2.2, "brass"));
  }
  out.add("rampPosts", posts.join(""), { material: "oak" });

  const guides = (u0, u1) =>
    [-1, 1]
      .map((side) => {
        const a = add(add(rampAt(u0), N, -S.ball), [0, side * 9.2, 0]);
        const b = add(add(rampAt(u1), N, -S.ball), [0, side * 9.2, 0]);
        return beam(P, add(a, N, 0.9), add(b, N, 0.9), 2.2, 1.8, "brass", { tone: "mid" });
      })
      .join("");
  const rampFar = [plankPiece(holeFar, TOP_U + 3, -W2, W2), guides(holeFar, TOP_U + 2)];
  // end stop at the top
  rampFar.push(beam(P, add(rampAt(TOP_U + 1.5), N, -S.ball + 1), add(rampAt(TOP_U + 1.5), N, -S.ball + 6), 18, 3, "brass", { tone: "mid" }));
  // side strips beside the hole
  const rampSides = [plankPiece(holeNear, holeFar, -W2, -S.holeHalfWidth), plankPiece(holeNear, holeFar, S.holeHalfWidth, W2), guides(holeNear, holeFar)];
  // a brass rim around the hole, on the plank's top face
  const rim = [];
  const top = (u, y) => k.iso(add(add(rampAt(u), N, -S.ball), [0, y, 0]), P);
  const corners = [top(holeNear, -S.holeHalfWidth), top(holeFar, -S.holeHalfWidth), top(holeFar, S.holeHalfWidth), top(holeNear, S.holeHalfWidth)];
  rim.push(line(k.pathOf(corners, true), "brass", { tone: "hi" }));
  out.add("rampFar", rampFar.join("") + rampSides[0], { material: "oak" });
  out.add("rampNear", [plankPiece(-1.5, holeNear, -W2, W2), guides(0, holeNear), rampSides[1], rampSides[2], rim.join("")].join(""), { material: "oak" });

  // ---- the J-curl, in front of the ramp's foot ------------------------------
  const jPost = rod(P, [100, 0, 12], [100, 0, 20 - 10 - 6.2], 1.4, "brass") + solid(k.cylinder(100, 0, 3.2, 12, 1.4, P, 24), "brass", { tone: "lo" });
  out.add("jcurl", jPost + rails(J_START - 2, CHUTE.length - 1), { material: "brass" });

  return {
    id: "magnet",
    P,
    parts: out.list,
    shadows: [
      { x: 11, y: 8, rx: 128, ry: 50, strength: 0.9, power: 4, feather: 0.45 },
      { x: 11, y: 8, rx: 180, ry: 95, strength: 0.32, power: 2, feather: 0.9 },
    ],
    grid: 20,
    extra: { dir: DIR },
  };
}
