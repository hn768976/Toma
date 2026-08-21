import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  interpolateColors,
  useCurrentFrame,
} from 'remotion';
import {COLORS, STROKE, TYPE} from '../lib/theme';
import {SLIDE, fadeIn, fadeInOut, fadeOut, ms, slide, snap} from '../lib/motion';

/**
 * SCENE 3 -- THE REASSEMBLY (0:38 - 0:56)
 *
 * Build note from the spec: the merge is not a real merge. The gaps and the
 * slot dividers fade to zero while the three packets slide flush. Visually
 * identical, trivially simpler.
 */

const CENTER_X = 1920 / 2;

// Sized so that three slots closed flush reproduce the Scene 1 rectangle
// exactly -- 1152 x 260, centred on the canvas. The merge is a callback, so
// it has to land on the same pixels the film opened on.
const SLOT_W = 384; // 1152 / 3
const SLOT_H = 260;
const SLOT_GAP = 24;
const SLOT_TOP = 540 - SLOT_H / 2; // 410

const BOX_PAD = 36;
const NUMBER_BAND = 55;
const BOX_W = SLOT_W * 3 + SLOT_GAP * 2 + BOX_PAD * 2;
const BOX_TOP = SLOT_TOP - BOX_PAD;
const BOX_H = SLOT_H + BOX_PAD + NUMBER_BAND;

const OFFSCREEN_X = -SLOT_W; // packets arrive from the left, out of frame

// Local frame cues.
const F_ARRIVE = [105, 132, 90]; // by packet index -- 3 lands first, then 1, then 2
const F_SNAP = [270, 273, 276]; // 0:47, 100ms apart
const F_REORDERING = 180; // 0:44
const F_BAR = 240; // 0:46
const F_MERGE = 360; // 0:50
const F_COUNTER = 420; // 0:52

const BAR_W = 600;
const BAR_FILL = ms(300);

/** Which slot each packet lands in -- deliberately the wrong one. */
const LANDING_SLOT = [1, 2, 0];

const slotX = (slot: number, gap: number) =>
  CENTER_X + (slot - 1) * (SLOT_W + gap);

const PACKET_LABELS = ['Packet 1', 'Packet 2', 'Packet 3'];

export const Scene3Reassembly: React.FC = () => {
  const frame = useCurrentFrame();

  const boxOpacity = Math.min(fadeIn(frame, 0), fadeOut(frame, F_MERGE));
  const slotsOpacity = boxOpacity;

  // 2. slide -- the gaps close, which is the whole of the "merge".
  const gap = slide(frame, F_MERGE, SLOT_GAP, 0);

  const destinationLabel = Math.min(fadeIn(frame, 0), fadeOut(frame, F_MERGE));
  const reorderingOpacity = fadeInOut(frame, F_REORDERING, F_MERGE);
  const barProgress = interpolate(frame, [F_BAR, F_BAR + BAR_FILL], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const packetLabelOpacity = fadeOut(frame, F_MERGE);
  const counterOpacity = fadeIn(frame, F_COUNTER);
  const elapsed = interpolate(frame, [F_COUNTER, F_COUNTER + 18], [0, 0.24], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Orange packets -> one grey message again. Accent belongs to packets only,
  // so it has to leave at the same moment they stop being packets.
  const packetFill = interpolateColors(
    frame,
    [F_MERGE, F_MERGE + 9],
    [COLORS.accent, COLORS.fill],
  );
  const mergedOutlineOpacity = fadeIn(frame, F_MERGE + 6);

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg}}>
      {/* Destination container */}
      <div
        style={{
          position: 'absolute',
          left: CENTER_X - BOX_W / 2,
          top: BOX_TOP,
          width: BOX_W,
          height: BOX_H,
          border: `${STROKE}px solid ${COLORS.ink}`,
          opacity: boxOpacity,
        }}
      />

      {/* Empty numbered slots */}
      {[0, 1, 2].map((i) => (
        <React.Fragment key={`slot-${i}`}>
          <div
            style={{
              position: 'absolute',
              left: slotX(i, SLOT_GAP) - SLOT_W / 2,
              top: SLOT_TOP,
              width: SLOT_W,
              height: SLOT_H,
              border: `3px dashed ${COLORS.ink}`,
              opacity: slotsOpacity,
            }}
          />
          <div
            style={{
              ...TYPE,
              position: 'absolute',
              left: slotX(i, SLOT_GAP) - SLOT_W / 2,
              top: SLOT_TOP + SLOT_H + 14,
              width: SLOT_W,
              textAlign: 'center',
              fontSize: 26,
              opacity: slotsOpacity,
            }}
          >
            {i + 1}
          </div>
        </React.Fragment>
      ))}

      {/* The packets themselves */}
      {PACKET_LABELS.map((label, i) => {
        const landedX = slotX(LANDING_SLOT[i], SLOT_GAP);
        // 2. slide in from off frame, then 3. snap into the correct slot.
        const x =
          frame < F_SNAP[i]
            ? interpolate(
                frame,
                [F_ARRIVE[i] - SLIDE, F_ARRIVE[i]],
                [OFFSCREEN_X, landedX],
                {
                  easing: Easing.inOut(Easing.ease),
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                },
              )
            : snap(frame, F_SNAP[i], landedX, slotX(i, gap));

        return (
          <div
            key={label}
            style={{
              position: 'absolute',
              left: x - SLOT_W / 2,
              top: SLOT_TOP,
              width: SLOT_W,
              height: SLOT_H,
              backgroundColor: packetFill,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // Packet 3 crosses the other two during the reorder snap.
              zIndex: i === 2 ? 2 : 1,
            }}
          >
            <span style={{...TYPE, fontSize: 30, opacity: packetLabelOpacity}}>
              {label}
            </span>
          </div>
        );
      })}

      {/* The reassembled message: Scene 1's rectangle, down to the pixel. */}
      <div
        style={{
          position: 'absolute',
          left: CENTER_X - (SLOT_W * 3) / 2,
          top: SLOT_TOP,
          width: SLOT_W * 3,
          height: SLOT_H,
          border: `${STROKE}px solid ${COLORS.ink}`,
          opacity: mergedOutlineOpacity,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3,
        }}
      >
        <span style={{...TYPE, fontSize: 52}}>Your Message</span>
      </div>

      {/* Container label */}
      <div
        style={{
          ...TYPE,
          position: 'absolute',
          left: 0,
          top: 296,
          width: 1920,
          textAlign: 'center',
          fontSize: 40,
          opacity: destinationLabel,
        }}
      >
        Destination
      </div>

      {/* Reordering status + progress bar */}
      <div
        style={{
          ...TYPE,
          position: 'absolute',
          left: 0,
          top: 800,
          width: 1920,
          textAlign: 'center',
          fontSize: 30,
          opacity: reorderingOpacity,
        }}
      >
        Reordering…
      </div>
      <div
        style={{
          position: 'absolute',
          left: CENTER_X - BAR_W / 2,
          top: 860,
          width: BAR_W,
          height: 12,
          border: `${STROKE / 2}px solid ${COLORS.ink}`,
          opacity: reorderingOpacity,
        }}
      >
        <div
          style={{
            width: `${barProgress * 100}%`,
            height: '100%',
            backgroundColor: COLORS.ink,
          }}
        />
      </div>

      {/* Total elapsed time. Nothing else moves under the last line. */}
      <div
        style={{
          ...TYPE,
          position: 'absolute',
          left: 0,
          top: 792,
          width: 1920,
          textAlign: 'center',
          fontSize: 48,
          opacity: counterOpacity,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {elapsed.toFixed(2)}s
      </div>
    </AbsoluteFill>
  );
};
