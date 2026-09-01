/**
 * dotMapFromLand + fitProjection.
 *
 * The demo ships a small inline land GeoJSON rather than fetching Natural Earth,
 * so the composition renders offline and deterministically. Real projects pass
 * their own data — the library never bundles any.
 */
import React, { useCallback, useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { fitProjection, dotMapFromLand, type GeoCollection } from '../../../src/geo';
import { Canvas, type DrawFn } from '../Canvas';
import { Label } from '../Label';
import { THEME, WIDTH, HEIGHT } from '../theme';
import { LAND } from '../land';

export const DotMapDemo: React.FC = () => {
  const dots = useMemo(() => {
    const land = LAND as GeoCollection;
    // NOTE: `dropAntarctica` is deliberately NOT used here. It matches on
    // feature name properties, and world-atlas land-110m is a single merged
    // feature called 'land' — so it would be a silent no-op. With this dataset
    // a latitude cut is the honest remedy; `dropAntarctica` is for
    // country-level data where each landmass is its own named feature.
    const fitted = fitProjection({
      land, width: WIDTH, height: HEIGHT, padding: 60,
    });

    // Ask the PROJECTION where a latitude lands rather than recomputing it.
    // fitExtent letterboxes a 2:1 sphere inside the box, so the map is not the
    // full frame height and any hand-rolled formula gets this wrong.
    const yAt = (lat: number): number => fitted.project([0, lat])?.[1] ?? 0;
    const CUT_LAT = -58;
    const cutY = yAt(CUT_LAT);
    const shift = (yAt(84) + cutY) / 2 - HEIGHT / 2;

    return dotMapFromLand({ fitted, land, pitch: 15 })
      .filter((d) => d.y <= cutY)
      .map((d) => ({ ...d, y: d.y - shift }));
  }, []);

  const draw: DrawFn = useCallback((ctx, frame, width, height) => {
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const d of dots) {
      // A slow travelling highlight, a pure function of position and frame.
      const pulse = 0.5 + 0.5 * Math.sin(frame * 0.05 - d.x * 0.004);
      if (d.isCoastal) {
        ctx.fillStyle = THEME.cyan;
        ctx.globalAlpha = 0.65 + pulse * 0.35;
        ctx.fillRect(d.x - 2, d.y - 2, 4.4, 4.4);
      } else {
        ctx.fillStyle = THEME.accent;
        ctx.globalAlpha = 0.22 + pulse * 0.2;
        ctx.fillRect(d.x - 1.5, d.y - 1.5, 3, 3);
      }
    }
    ctx.restore();

    ctx.font = '20px ui-monospace, monospace';
    ctx.fillStyle = THEME.text;
    ctx.fillText(`${dots.length} dots · coastal dots brightened`, 64, 980);
  }, [dots]);

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
      <Canvas draw={draw} />
      <Label title="geo/fitProjection + dotMapFromLand" note="Grid sampled against rasterised land; coastal flag from neighbour count." />
    </AbsoluteFill>
  );
};
