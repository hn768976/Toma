import { Composition, Folder } from 'remotion';
import { ICONS } from './icons';
import { NeonIcon, type NeonIconProps } from './NeonIcon';
import { FPS, LOOP } from './lib/loop';

// 10 icons → 10 compositions, all 3840×2160, 30 fps, 600 frames (20 s loop).
// --props='{"loopCheck":true}' makes them 601 frames so frame 600 can be
// compared against frame 0 (loop test).
export const RemotionRoot = () => (
  <Folder name="NeonCircuitIcons">
    {ICONS.map((icon) => (
      <Composition
        key={icon.id}
        id={icon.id}
        component={NeonIcon}
        defaultProps={{ icon, loopCheck: false } satisfies NeonIconProps}
        calculateMetadata={({ props }) => ({
          durationInFrames: props.loopCheck ? LOOP + 1 : LOOP,
        })}
        durationInFrames={LOOP}
        fps={FPS}
        width={3840}
        height={2160}
      />
    ))}
  </Folder>
);
