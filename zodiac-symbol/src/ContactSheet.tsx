import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {ZodiacSymbol} from './ZodiacSymbol';
import {SIGNS} from './zodiac-data';

/**
 * All twelve at once, on one frame.
 *
 * This is the framing check: glyphs vary a lot in proportion, and a sign that
 * is only ever looked at on its own can read fine there and still be visibly
 * heavier or lighter than its neighbours. Seeing the set together is the only
 * way to catch that before a 4K batch spends the render time.
 *
 * Not a deliverable - it is a review tool, and it is deliberately left
 * registered so the check can be repeated after any change to the data file.
 */

const COLUMNS = 4;
const ROWS = 3;

export const ContactSheet: React.FC = () => {
  const {width, height} = useVideoConfig();
  const cellWidth = width / COLUMNS;
  const cellHeight = height / ROWS;
  const scale = cellWidth / width;

  return (
    <AbsoluteFill style={{backgroundColor: '#000000'}}>
      {SIGNS.map((sign, i) => {
        const column = i % COLUMNS;
        const row = Math.floor(i / COLUMNS);
        return (
          <div
            key={sign.name}
            style={{
              position: 'absolute',
              left: column * cellWidth,
              top: row * cellHeight,
              width: cellWidth,
              height: cellHeight,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: (cellHeight - height * scale) / 2,
                width,
                height,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              <ZodiacSymbol sign={sign.name} />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
