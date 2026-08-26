import {chance, rint} from './rand';

export type GlitchEvent = {start: number; length: number; index: number};

/**
 * Glitch accents are irregular and clustered: most events are 40-110 frames
 * apart, but roughly a third of them are followed by a quick second hit a few
 * frames later, which is what stops the rhythm from feeling metronomic.
 */
export const buildGlitchEvents = (durationInFrames: number): GlitchEvent[] => {
  const events: GlitchEvent[] = [];
  let f = rint('glitch-first', 34, 74);
  let i = 0;

  while (f < durationInFrames && i < 64) {
    const length = rint(`glitch-len-${i}`, 2, 4);
    events.push({start: f, length, index: i});

    const clustered = chance(`glitch-cluster-${i}`, 0.34);
    f += clustered
      ? length + rint(`glitch-gap-${i}`, 2, 10)
      : rint(`glitch-wait-${i}`, 40, 110);
    i++;
  }

  return events;
};

export const activeGlitch = (
  events: GlitchEvent[],
  frame: number
): GlitchEvent | null => {
  for (const e of events) {
    if (frame >= e.start && frame < e.start + e.length) {
      return e;
    }
  }
  return null;
};
