import {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {CanvasRefContext} from './canvas';
import {hexToRgb, rgbaCss} from './colors';
import {Burst} from './components/Burst';
import {NightSky} from './components/NightSky';
import {Shell} from './components/Shell';
import {TrailLayer} from './components/TrailLayer';
import {GRAIN_TILE_SIZE, getGrainTiles} from './grain';
import {getSchedule} from './schedule';
import {rand} from './rng';
import {DURATION_IN_FRAMES, HEIGHT, VARIANTS, WIDTH} from './variants';
import type {VariantName} from './variants';

export type FireworksProps = {
  readonly variant: VariantName;
};

/**
 * Everything is a pure function of the frame number: the schedule, every
 * particle, the twinkle of every star and the grain. Nothing is stored between
 * frames except memoised particle sets, so `npx remotion render` is
 * deterministic and the piece loops exactly.
 */
export const Fireworks: React.FC<FireworksProps> = ({variant: name}) => {
  const frame = useCurrentFrame() % DURATION_IN_FRAMES;
  const variant = VARIANTS[name];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const schedule = getSchedule(name);
  const active = schedule.filter(
    (b) => frame >= b.start && frame <= b.start + b.maxLife,
  );
  const rising = schedule.filter(
    (b) =>
      b.launch !== null && frame >= b.launch.start && frame < b.start,
  );

  // Runs after every child's draw effect, so this is the finishing pass over
  // the completed frame: vignette, then grain.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    const vignette = ctx.createRadialGradient(
      WIDTH / 2,
      HEIGHT * 0.46,
      WIDTH * 0.26,
      WIDTH / 2,
      HEIGHT * 0.46,
      WIDTH * 0.74,
    );
    const shade = hexToRgb(variant.palette.vignette);
    vignette.addColorStop(0, rgbaCss(shade, 0));
    vignette.addColorStop(0.6, rgbaCss(shade, 0.06));
    vignette.addColorStop(1, rgbaCss(shade, 0.2));
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const tiles = getGrainTiles(name, variant.palette);
    const tile = tiles[Math.floor(rand(name + ':grainTile' + frame) * tiles.length) % tiles.length];
    const pattern = tile ? ctx.createPattern(tile, 'repeat') : null;
    if (pattern) {
      const ox = Math.floor(rand(name + ':grainX' + frame) * GRAIN_TILE_SIZE);
      const oy = Math.floor(rand(name + ':grainY' + frame) * GRAIN_TILE_SIZE);
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.04;
      ctx.translate(-ox, -oy);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, WIDTH + GRAIN_TILE_SIZE, HEIGHT + GRAIN_TILE_SIZE);
    }
    ctx.restore();
  });

  return (
    <CanvasRefContext.Provider value={canvasRef}>
      <AbsoluteFill style={{backgroundColor: variant.palette.skyDeep}}>
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          style={{width: '100%', height: '100%', display: 'block'}}
        />
        <NightSky frame={frame} name={name} variant={variant} />
        {rising.map((burst) => (
          <Shell
            key={burst.id}
            burst={burst}
            frame={frame}
            name={name}
            variant={variant}
          />
        ))}
        <TrailLayer
          bursts={active}
          frame={frame}
          name={name}
          variant={variant}
        />
        {active.map((burst) => (
          <Burst
            key={burst.id}
            burst={burst}
            frame={frame}
            name={name}
            variant={variant}
          />
        ))}
      </AbsoluteFill>
    </CanvasRefContext.Provider>
  );
};
