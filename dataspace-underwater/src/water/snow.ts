// Marine snow: pale specks drifting on closed, whole-cycle paths.
import { Particle, ParticleContainer } from "pixi.js";
import { loopTheta } from "../lib/loop";
import { mulberry32, range } from "../lib/random";
import { WaterKit } from "./kit";
import { CELL, SHARP_D, BLUR_D, Sprite } from "./sprites";

type Speck = {
  x0: number;
  y0: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  n1: number;
  n2: number;
  p1: number;
  p2: number;
  p3: number;
  size: number; // px at 720p
  alpha: number;
  bokeh: boolean;
  tw: number; // twinkle cycles per loop
  tp: number;
};

const makeSpecks = (seed: number, count: number): Speck[] => {
  const rng = mulberry32(seed);
  const out: Speck[] = [];
  for (let i = 0; i < count; i++) {
    const bokeh = rng() < 0.22;
    const near = bokeh ? 1 : rng() < 0.5 ? 0.6 : 0.35;
    out.push({
      x0: range(rng, -0.05, 1.05),
      y0: range(rng, -0.05, 1.05),
      // Amplitudes in fraction of height: slow drifts in different directions.
      ax: range(rng, 0.01, 0.06) * near * 1.5,
      ay: range(rng, 0.01, 0.05) * near * 1.5,
      bx: range(rng, 0.0, 0.02),
      by: range(rng, 0.0, 0.02),
      n1: rng() < 0.5 ? 1 : -1,
      n2: rng() < 0.5 ? 2 : -2,
      p1: range(rng, 0, Math.PI * 2),
      p2: range(rng, 0, Math.PI * 2),
      p3: range(rng, 0, Math.PI * 2),
      size: bokeh ? range(rng, 4, 11) : Math.pow(rng(), 2) * 1.6 + 0.7,
      alpha: bokeh ? range(rng, 0.1, 0.28) : range(rng, 0.35, 0.95),
      bokeh,
      tw: 1 + Math.floor(rng() * 4),
      tp: range(rng, 0, Math.PI * 2),
    });
  }
  return out;
};

export class MarineSnow {
  readonly container: ParticleContainer;
  private readonly specks: Speck[];
  private readonly parts: Particle[] = [];

  constructor(
    private kit: WaterKit,
    seed: number,
    count: number,
    private brightness = 1,
  ) {
    this.specks = makeSpecks(seed, count);
    this.container = new ParticleContainer({
      dynamicProperties: { position: true, vertex: true, color: true, rotation: false, uvs: false },
      texture: kit.sprite(Sprite.Speck),
    });
    for (const s of this.specks) {
      const p = new Particle({
        texture: kit.sprite(s.bokeh ? Sprite.SpeckBokeh : Sprite.Speck),
        anchorX: 0.5,
        anchorY: 0.5,
      });
      this.parts.push(p);
      this.container.addParticle(p);
    }
  }

  update(frame: number) {
    const th = loopTheta(frame);
    const { pw, ph } = this.kit;
    const k = ph / 720;
    for (let i = 0; i < this.specks.length; i++) {
      const s = this.specks[i];
      const p = this.parts[i];
      const yN = s.y0 + s.ay * Math.sin(s.n1 * th + s.p2) + s.by * Math.sin(s.n2 * th + s.p3);
      const xN = s.x0 + (s.ax * Math.cos(s.n1 * th + s.p1) + s.bx * Math.sin(s.n2 * th + s.p3)) * (ph / pw);
      const par = s.bokeh ? 1.6 : 0.8;
      p.x = (xN + this.kit.drift[0] * par) * pw;
      p.y = (yN + this.kit.drift[1] * par) * ph;
      const d = Math.max(1.0, s.size * k);
      const drawn = s.bokeh ? BLUR_D : SHARP_D;
      const sc = (d / drawn) * (CELL / CELL);
      p.scaleX = p.scaleY = sc;
      // Area compensation for sub-pixel specks; brighter near the lit top.
      const area = Math.min(1, ((s.size * k) / d) ** 2);
      const lit = 0.55 + 0.6 * Math.pow(Math.max(0, 1 - yN), 1.5);
      const tw = 0.8 + 0.2 * Math.sin(s.tw * th + s.tp);
      p.alpha = Math.min(1, s.alpha * area * lit * tw * this.brightness);
    }
  }
}
