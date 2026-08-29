import {random} from 'remotion';
import {DURATION, HEIGHT, ROWS} from './constants';
import {lerp, randInt, randRange} from './draw';
import type {VariantConfig} from '../variants';

export type TearEvent = {id: number; start: number; end: number};

/**
 * Tear events fire irregularly and in clusters: a burst of two to four rapid
 * events, then a gap whose length is drawn from a window scaled by the
 * instability curve. Evenly spaced tearing reads as a pattern rather than as
 * failure, which is why the interval is jittered rather than fixed.
 *
 * The walk is bounded to [3, 296] so no event straddles the loop point — frame
 * 0 and frame 300 both sit in dead air.
 */
export const buildTearTimeline = (cfg: VariantConfig): TearEvent[] => {
  const events: TearEvent[] = [];
  const last = DURATION - 4;
  let t = 3;
  let id = 0;
  while (t < last && id < 500) {
    const inst = cfg.instability(t);
    // Below this the frame is stable and stays that way: no event may start
    // late enough to run past the point the curve reaches zero.
    if (inst < 0.12) {
      t += 8;
      id++;
      continue;
    }
    const clustered = random(`${cfg.name}-burst-${id}`) < 0.12 + inst * 0.5;
    const burst = clustered ? randInt(2, 4, `${cfg.name}-bn-${id}`) : 1;
    let bt = t;
    for (let b = 0; b < burst; b++) {
      const dur = randInt(2, 6, `${cfg.name}-dur-${id}-${b}`);
      if (bt + dur > last) break;
      events.push({id: id * 8 + b, start: bt, end: bt + dur});
      bt += dur + randInt(1, 3, `${cfg.name}-gap-${id}-${b}`);
    }
    const window = cfg.glitch.tearInterval(inst);
    const jitter = randRange(0.85, 1.25, `${cfg.name}-ivl-${id}`);
    t = Math.max(bt, t + 1) + Math.max(3, Math.round(window * jitter));
    id++;
  }
  return events;
};

export const activeTear = (events: TearEvent[], frame: number): TearEvent | null => {
  const f = frame % DURATION;
  for (const e of events) {
    if (f >= e.start && f < e.end) return e;
  }
  return null;
};

export type SliceKind = 'shift' | 'channel' | 'drop' | 'echo';

export type Slice = {
  y: number;
  h: number;
  dx: number;
  kind: SliceKind;
  /** For 'drop': near-black rather than wash colour. */
  dark: boolean;
  /** For 'echo': the vertical offset the duplicated text is pulled from. */
  echoFrom: number;
  /** For 'channel': red and blue separation in px. */
  fringe: number;
};

export const buildSlices = (cfg: VariantConfig, ev: TearEvent, frame: number, inst: number): Slice[] => {
  const f = frame % DURATION;
  const {sliceCount, sliceHeight, sliceShift, chromatic} = cfg.glitch;
  const count = Math.max(1, Math.round(lerp(sliceCount[0], sliceCount[1], inst)));
  const slices: Slice[] = [];
  for (let i = 0; i < count; i++) {
    const seed = `${cfg.name}-sl-${ev.id}-${f}-${i}`;
    const roll = random(`${seed}-k`);
    const kind: SliceKind =
      roll < 0.5 ? 'shift' : roll < 0.72 ? 'channel' : roll < 0.86 ? 'drop' : 'echo';
    const hMax = kind === 'echo' ? lerp(80, 230, inst) : lerp(30, sliceHeight[1], inst);
    const hMin = kind === 'echo' ? 60 : sliceHeight[0];
    const h = Math.round(randRange(hMin, Math.max(hMin + 2, hMax), `${seed}-h`));
    const y = Math.round(randRange(0, HEIGHT - h, `${seed}-y`));
    const maxShift = lerp(60, sliceShift[1], inst);
    const dx =
      Math.round(randRange(sliceShift[0], Math.max(sliceShift[0] + 4, maxShift), `${seed}-d`)) *
      (random(`${seed}-s`) < 0.5 ? -1 : 1);
    slices.push({
      y,
      h,
      dx,
      kind,
      dark: random(`${seed}-dk`) < 0.55,
      echoFrom: Math.round(randRange(-900, 900, `${seed}-e`)),
      fringe: Math.max(2, chromatic * inst * randRange(0.5, 1.4, `${seed}-fr`)),
    });
  }
  return slices;
};

export type CorruptionEvent = {id: number; start: number; duration: number; row: number; lines: number};

/**
 * Blocks of the terminal page replaced by garbled runs. In 'corrupt' mode these
 * recur for the whole clip and wrap around the loop point; in 'restoring' mode
 * they thin out and are gone by the configured frame.
 */
export const buildCorruptionTimeline = (cfg: VariantConfig): CorruptionEvent[] => {
  const {eventSpacing, lines, duration, clearedBy} = cfg.text;
  const span = Number.isFinite(clearedBy) ? Math.min(DURATION, clearedBy) : DURATION;
  const n = Math.max(1, Math.round(span / eventSpacing));
  const events: CorruptionEvent[] = [];
  for (let k = 0; k < n; k++) {
    const seed = `${cfg.name}-cor-${k}`;
    const slot = span / n;
    events.push({
      id: k,
      start: Math.round(k * slot + randRange(0, slot * 0.65, `${seed}-s`)),
      duration: randInt(duration[0], duration[1], `${seed}-d`),
      row: randInt(0, ROWS - 1, `${seed}-r`),
      lines: randInt(lines[0], lines[1], `${seed}-l`),
    });
  }
  return events;
};

export const corruptionAt = (
  cfg: VariantConfig,
  events: CorruptionEvent[],
  frame: number,
): CorruptionEvent[] => {
  const f = frame % DURATION;
  const out: CorruptionEvent[] = [];
  for (const e of events) {
    if (cfg.text.mode === 'corrupt') {
      // Circular window, so a run in flight at frame 299 is also in flight at 0.
      if ((f - e.start + DURATION) % DURATION < e.duration) out.push(e);
    } else {
      if (f < e.start || f >= e.start + e.duration || f >= cfg.text.clearedBy) continue;
      // Garbled lines are progressively handed back as clean text.
      const remaining = Math.round(e.lines * (1 - f / cfg.text.clearedBy));
      if (remaining >= 1) out.push({...e, lines: remaining});
    }
  }
  return out;
};
