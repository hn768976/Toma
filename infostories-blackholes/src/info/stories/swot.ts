import { Group, type Object3D } from "three";
import { easeInOutCubic, easeOutBack, easeOutCubic, lerp, ramp } from "../../lib/anim";
import { PAL, lineMesh, makeLabel, rectMesh, rectPts } from "../kit";
import type { StoryBuilder } from "../pipeline";

/** 1C — SWOT (450 frames). */

const TW = 1.9, TH = 2.0, GAP = 0.2;
const GX = 0.4, GY = -0.08; // grid centre
const COLS = [GX - (TW + GAP) / 2, GX + (TW + GAP) / 2];
const ROWS = [GY + (TH + GAP) / 2, GY - (TH + GAP) / 2];
const CELLS = [
  { letter: "S", word: "Strengths", c: 0, r: 0 },
  { letter: "W", word: "Weaknesses", c: 1, r: 0 },
  { letter: "O", word: "Opportunities", c: 0, r: 1 },
  { letter: "T", word: "Threats", c: 1, r: 1 },
];
const WORD_X = 0.25, WORD_Y = 0.95, WORD_EM = 0.95, WORD_STEP = 0.78;
const FINAL_EM = 1.12;

const order = <T extends Object3D>(o: T, r: number): T => {
  o.renderOrder = r;
  return o;
};

export const swot: StoryBuilder = ({ anisotropy }) => {
  const root = new Group();

  const cells = CELLS.map((c, i) => {
    const cx = COLS[c.c], cy = ROWS[c.r];
    // tile: violet with cyan edges; lower row slightly lighter blue
    const tile = new Group();
    tile.position.set(cx, cy, -0.05);
    const fill = rectMesh(TW, TH, c.r === 0 ? "#8A48D8" : "#7458DC", 0.55);
    const edge = lineMesh(rectPts(TW, TH), 0.03, PAL.cyan, true, 1.15);
    tile.add(order(fill, 2), order(edge, 3));
    root.add(tile);

    const letter = makeLabel(c.letter, {
      family: "Montserrat",
      weight: 800,
      px: 560,
      em: 1,
      align: "center",
      bevel: true,
      glow: 0,
      anisotropy,
    });
    const lg = new Group();
    lg.add(order(letter.mesh, 9));
    root.add(lg);

    const sub = makeLabel(c.word, { em: 0.28, align: "center", anisotropy, glow: 0.35, px: 200 });
    sub.mesh.position.set(cx, cy - 0.63, 0.02);
    root.add(order(sub.mesh, 10));
    const wordPos = [WORD_X + (i - 1.5) * WORD_STEP, WORD_Y] as const;
    return { c, cx, cy, tile, fill, edge, letter, lg, sub, wordPos, i };
  });

  const axis = [
    { text: "Helpful", x: COLS[0], y: ROWS[0] + TH / 2 + 0.24, rot: 0, t0: 240 },
    { text: "Harmful", x: COLS[1], y: ROWS[0] + TH / 2 + 0.24, rot: 0, t0: 252 },
    { text: "Internal", x: COLS[0] - TW / 2 - 0.36, y: ROWS[0] + 0.2, rot: Math.PI / 2, t0: 264 },
    { text: "External", x: COLS[0] - TW / 2 - 0.36, y: ROWS[1] + 0.2, rot: Math.PI / 2, t0: 276 },
  ].map((a) => {
    const l = makeLabel(a.text, { em: 0.31, align: "center", weight: 400, color: "#3AC8FF", anisotropy, glow: 0.12, px: 200 });
    const g = new Group();
    g.position.set(a.x, a.y, 0.02);
    g.rotation.z = a.rot;
    g.add(order(l.mesh, 10));
    root.add(g);
    return { ...a, l, g };
  });

  const update = (f: number) => {
    for (const k of cells) {
      // fly in one by one, tilting into place as a word
      const t0 = 8 + k.i * 13;
      const fly = easeOutCubic(ramp(f, t0, t0 + 30));
      const split = easeInOutCubic(ramp(f, 92 + k.i * 5, 140 + k.i * 5));
      const wx = k.wordPos[0], wy = k.wordPos[1];
      const fx = lerp(wx + 2.6, wx, fly), fy = lerp(wy + 1.1, wy, fly), fz = lerp(3.2, 0, fly);
      const finalX = k.cx, finalY = k.cy + 0.22;
      k.lg.position.set(lerp(fx, finalX, split), lerp(fy, finalY + 0.02, split), fz + 0.25 * Math.sin(Math.PI * split));
      k.lg.rotation.set(lerp(-0.7, 0, fly), lerp(-1.25, 0, fly), lerp(0.35, 0, fly), "YXZ");
      k.lg.scale.setScalar(lerp(WORD_EM, FINAL_EM, split));
      k.letter.setOpacity(ramp(f, t0, t0 + 8));

      // tiles pop in behind each letter; subtitles fade in
      const p0 = 152 + k.i * 12;
      const pt = ramp(f, p0, p0 + 14);
      k.tile.scale.setScalar(Math.max(1e-4, lerp(0.72, 1, pt <= 0 ? 0 : easeOutBack(pt))));
      k.fill.material.uniforms.uOpacity.value = 0.55 * ramp(f, p0, p0 + 6);
      k.edge.material.uniforms.uOpacity.value = ramp(f, p0, p0 + 3);
      k.edge.material.uniforms.uDraw.value = easeInOutCubic(ramp(f, p0, p0 + 18));
      const s0 = 168 + k.i * 12;
      k.sub.setOpacity(easeOutCubic(ramp(f, s0, s0 + 16)));
      k.sub.mesh.position.y = k.cy - 0.63 - 0.12 * (1 - easeOutCubic(ramp(f, s0, s0 + 16)));

      // light sweep across the tiles
      const sw = lerp(-4.5, 4.5, easeInOutCubic(ramp(f, 286, 336)));
      k.fill.material.uniforms.uSweep.value = [sw - (k.cx + 0.55 * k.cy), 0.45, 0.28 * ramp(f, 286, 292) * (1 - ramp(f, 330, 336))];
    }
    for (const a of axis) {
      const t = easeOutCubic(ramp(f, a.t0, a.t0 + 18));
      a.l.setOpacity(t);
      const d = 0.35 * (1 - t);
      if (a.rot === 0) a.g.position.y = a.y + d;
      else a.g.position.x = a.x - d;
    }
  };

  return { group: root, update };
};
