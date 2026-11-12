import { CARD_COUNT, HOLD_FRAMES, LOOP_FRAMES } from "../settings";
import { chance, int, range, rngFor } from "./rng";

export type Slot = {
  /** First frame of this hold (0..LOOP_FRAMES-1). */
  start: number;
  /** Hold length in frames. */
  len: number;
  /** Which of the CARD_COUNT texture cards is shown. */
  card: number;
  /** Gate weave for this hold: offset in fractions of the frame, scale and rotation (radians). */
  dx: number;
  dy: number;
  scale: number;
  rot: number;
};

export type PersistEvent = {
  /** Slot index where the mark appears. */
  startSlot: number;
  /** Number of consecutive holds it stays for (2–3). */
  life: number;
  /** 0 = line-type mark (drawn with Canvas 2D), 1 = stain-type mark (drawn in the shader). */
  kind: 0 | 1;
  seed: number;
  /** Position (frame fractions, y down), size and per-hold drift. */
  x: number;
  y: number;
  driftX: number;
  driftY: number;
};

export type Schedule = {
  slots: Slot[];
  /** frame -> slot index */
  slotOfFrame: Int16Array;
  /** frame -> exposure gain (1 = none) */
  gain: Float32Array;
  persist: PersistEvent[];
};

type ScheduleOptions = {
  /** Size of the "working set" of cards the flicker cycles through before a new card rotates in. */
  window: number;
  /** Probability per frame-run of an exposure jump (0 disables). */
  exposureJumps: boolean;
  /** Where persistent marks may sit: "any" or "border" (outside the clean centre). */
  persistArea: "any" | "border";
};

const cache = new Map<string, Schedule>();

/** The flicker schedule of a look: a fixed, seeded sequence of holds that repeats every LOOP_FRAMES. */
export const getSchedule = (lookId: string, opts: ScheduleOptions): Schedule => {
  const key = `${lookId}:${HOLD_FRAMES.join("-")}:${opts.window}:${opts.exposureJumps}:${opts.persistArea}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const r = rngFor(lookId, "schedule");
  const [minHold, maxHold] = HOLD_FRAMES;

  // 1. Hold lengths, summing to exactly LOOP_FRAMES.
  const lens: number[] = [];
  let remaining = LOOP_FRAMES;
  while (remaining > 0) {
    if (remaining <= maxHold && remaining >= minHold) {
      lens.push(remaining);
      break;
    }
    const hi = Math.min(maxHold, remaining - minHold);
    const len = int(r, minHold, Math.max(minHold, hi));
    lens.push(len);
    remaining -= len;
  }

  // 2. Card per hold: cycle through a small working set, rotating a new card in every few holds.
  //    Never show the same card twice in a row (also across the loop seam).
  const working: number[] = [];
  for (let i = 0; i < opts.window; i++) working.push(i);
  let nextCard = opts.window % CARD_COUNT;
  const cards: number[] = [];
  let sinceRotate = 0;
  for (let i = 0; i < lens.length; i++) {
    if (sinceRotate >= int(r, 5, 9)) {
      // replace the oldest card of the working set
      working.shift();
      working.push(nextCard);
      nextCard = (nextCard + 1) % CARD_COUNT;
      sinceRotate = 0;
    }
    sinceRotate++;
    const prev = i > 0 ? cards[i - 1] : -1;
    const isLast = i === lens.length - 1;
    let c = working[Math.floor(r() * working.length)];
    let guard = 0;
    while ((c === prev || (isLast && c === cards[0])) && guard++ < 50) {
      c = working[Math.floor(r() * working.length)];
    }
    cards.push(c);
  }

  // 3. Slots with gate weave.
  const slots: Slot[] = [];
  let start = 0;
  for (let i = 0; i < lens.length; i++) {
    slots.push({
      start,
      len: lens[i],
      card: cards[i],
      dx: range(r, -0.005, 0.005),
      dy: range(r, -0.005, 0.005),
      scale: 1 + range(r, -0.01, 0.01),
      rot: range(r, -0.0012, 0.0012),
    });
    start += lens[i];
  }
  const slotOfFrame = new Int16Array(LOOP_FRAMES);
  slots.forEach((s, i) => {
    for (let f = s.start; f < s.start + s.len; f++) slotOfFrame[f] = i;
  });

  // 4. Exposure jumps: occasional 1–2 frame flashes / dips (looks 1–2 only).
  const gain = new Float32Array(LOOP_FRAMES).fill(1);
  if (opts.exposureJumps) {
    let f = int(r, 20, 60);
    while (f < LOOP_FRAMES - 3) {
      const dur = int(r, 1, 2);
      const g = chance(r, 0.7) ? range(r, 1.3, 1.65) : range(r, 0.6, 0.78);
      for (let k = 0; k < dur; k++) gain[f + k] = g;
      f += int(r, 35, 90);
    }
  }

  // 5. Persistent marks: each lives for 2–3 holds, drifting slightly from hold to hold.
  const persist: PersistEvent[] = [];
  let s = int(r, 0, 3);
  let kindToggle = 0;
  while (s < slots.length) {
    const life = int(r, 2, 3);
    let x = range(r, 0.08, 0.92);
    let y = range(r, 0.1, 0.9);
    if (opts.persistArea === "border") {
      // keep it in the border band around the clean centre
      const side = int(r, 0, 3);
      if (side === 0) y = range(r, 0.02, 0.14);
      else if (side === 1) y = range(r, 0.86, 0.98);
      else if (side === 2) x = range(r, 0.02, 0.1);
      else x = range(r, 0.9, 0.98);
    }
    persist.push({
      startSlot: s,
      life,
      kind: (kindToggle++ % 3 === 2 ? 1 : 0) as 0 | 1,
      seed: Math.floor(r() * 1e9),
      x,
      y,
      driftX: range(r, -0.0016, 0.0016),
      driftY: range(r, -0.0012, 0.0012),
    });
    s += int(r, 3, 7);
  }

  const sched = { slots, slotOfFrame, gain, persist };
  cache.set(key, sched);
  return sched;
};

/** Persistent marks alive during a slot, with how many holds they have already drifted. */
export const activePersist = (sched: Schedule, slotIndex: number) => {
  const n = sched.slots.length;
  const out: { ev: PersistEvent; age: number }[] = [];
  for (const ev of sched.persist) {
    const age = (slotIndex - ev.startSlot + n) % n;
    if (age < ev.life) out.push({ ev, age });
  }
  return out;
};
