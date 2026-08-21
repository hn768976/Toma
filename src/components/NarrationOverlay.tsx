import React from 'react';
import {useCurrentFrame} from 'remotion';
import {COLORS, FONT_STACK} from '../lib/theme';
import {NARRATION} from '../lib/narration';

/**
 * Recording aid, not part of the film. It deliberately ignores the "max three
 * words on screen" rule because it exists only to time takes against the
 * finished visuals. Never enabled on the delivered render.
 */
export const NarrationOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = NARRATION.find((c) => frame >= c.from && frame <= c.to);
  const sync = NARRATION.find((c) => c.syncCritical);
  const onSyncFrame = sync?.syncCritical && frame >= sync.syncCritical.frame - 4 && frame <= sync.syncCritical.frame + 4;

  return (
    <div
      style={{
        position: 'absolute',
        left: 120,
        right: 120,
        bottom: 40,
        textAlign: 'center',
        fontFamily: FONT_STACK,
        fontWeight: 400,
        fontSize: 26,
        lineHeight: 1.4,
        color: onSyncFrame ? COLORS.accent : COLORS.ink,
        opacity: 0.75,
      }}
    >
      {cue?.text ?? ''}
    </div>
  );
};
