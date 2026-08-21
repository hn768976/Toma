/**
 * Voiceover script with the frame each line is cued to.
 *
 * The visuals are authored first and the VO is timed to them, never the
 * reverse -- see the sync-critical note on Scene 2. Set the `showNarration`
 * prop (or render the `InternetMessageVOGuide` composition) to burn these
 * cues into the frame while recording takes.
 */
import {sec} from './timeline';

export type NarrationCue = {
  from: number;
  to: number;
  text: string;
  /** Word that must land on a specific visual beat. */
  syncCritical?: {word: string; frame: number};
};

export const NARRATION: NarrationCue[] = [
  {
    from: sec(1),
    to: sec(15),
    text:
      'This is your message. It is, unfortunately, too polite to travel in one piece — so the internet cuts it up first. Don’t worry. This is normal. This is also, somehow, the internet’s entire personality.',
  },
  {
    from: sec(19),
    to: sec(37),
    text:
      'The packets don’t travel together. They don’t even take the same route. One goes through Virginia. One, for reasons no one has ever fully explained, goes through Iceland. This is fine. This is apparently fine.',
    // Scene 2 timing: packet 3 touches the Iceland router dot on this frame.
    syncCritical: {word: 'Iceland', frame: sec(26)},
  },
  {
    from: sec(39),
    to: sec(53),
    text:
      'On the other end, everything gets put back in order — because computers, unlike people, are extremely good at following instructions. Total time elapsed: about a quarter of a second. Which is, coincidentally, also how long it took you to forget how any of this works.',
  },
];
