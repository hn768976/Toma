import {DURATION_IN_FRAMES, FLICKER_EVENT_COUNT, FLICKER_EVENT_FRAMES, PANELS} from './config';
import {rint, rrange} from './lib/draw';
import type {Variant} from './theme';

export type FlickerKind = 'code-line' | 'ring' | 'row' | 'blink';

export type FlickerEvent = {
  startFrame: number;
  panelId: string;
  kind: FlickerKind;
  /** Which sub-element inside the panel the event touches. */
  slot: number;
  seed: string;
};

/**
 * A fixed schedule of ~2.5 content events per second, derived only from seeded
 * randomness. Every event's window is evaluated modulo 372, so an event that
 * starts near the end of the loop wraps cleanly into the beginning.
 */
export const buildFlickerEvents = (variant: Variant): FlickerEvent[] => {
  const events: FlickerEvent[] = [];
  for (let e = 0; e < FLICKER_EVENT_COUNT; e++) {
    const seed = `${variant}-flicker-${e}`;
    const panel = PANELS[rint(`${seed}-p`, 0, PANELS.length - 1)];
    const kinds: FlickerKind[] =
      panel.kind === 'code'
        ? ['code-line', 'code-line', 'blink']
        : panel.kind === 'dashboard'
          ? ['ring', 'row', 'ring']
          : panel.kind === 'list' || panel.kind === 'stat'
            ? ['row', 'blink', 'row']
            : ['blink', 'blink', 'row'];
    events.push({
      startFrame: rint(`${seed}-f`, 0, DURATION_IN_FRAMES - 1),
      panelId: panel.id,
      kind: kinds[rint(`${seed}-k`, 0, kinds.length - 1)],
      slot: rint(`${seed}-s`, 0, 11),
      seed,
    });
  }
  return events;
};

export type ActiveFlicker = FlickerEvent & {
  /** 1 at the start of the event, easing to 0 at its end. */
  intensity: number;
};

/** All events touching `panelId` on this frame. Cheap — the list is 31 long. */
export const activeFlickers = (
  events: readonly FlickerEvent[],
  panelId: string,
  frame: number
): ActiveFlicker[] => {
  const out: ActiveFlicker[] = [];
  for (const ev of events) {
    if (ev.panelId !== panelId) continue;
    const age =
      (((frame - ev.startFrame) % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) %
      DURATION_IN_FRAMES;
    if (age >= FLICKER_EVENT_FRAMES) continue;
    const k = age / FLICKER_EVENT_FRAMES;
    out.push({...ev, intensity: (1 - k) ** 1.6});
  }
  return out;
};

/** Baseline value for a dashboard ring, before any event bump. */
export const ringBase = (seed: string): number => rrange(seed, 0.28, 0.86);
