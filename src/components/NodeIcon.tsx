import React, {useEffect, useMemo, useRef} from 'react';
import {ICONS} from '../icons';
import {CARD} from '../geometry';
import {THEMES, withAlpha, type Variant} from '../theme';
import type {IconId} from '../workflows';

const ICON = Math.round(CARD * 0.52);
const PAD = Math.round(CARD * 0.2);
const BOX = ICON + PAD * 2;

/**
 * A glowing line-art icon. The artwork is rasterised ONCE per (icon, variant)
 * into an offscreen canvas and blitted — no path work per frame.
 */
export const NodeIcon: React.FC<{icon: IconId; variant: Variant}> = ({icon, variant}) => {
  const theme = THEMES[variant];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sprite = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = BOX;
    c.height = BOX;
    const ctx = c.getContext('2d');
    if (!ctx) return c;

    ctx.translate(PAD, PAD);
    ctx.scale(ICON / 100, ICON / 100);
    ctx.lineWidth = 6.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ICONS[icon](ctx);

    // Bloom first, then the crisp core on top.
    ctx.strokeStyle = withAlpha(theme.icon, 0.34);
    ctx.shadowColor = withAlpha(theme.icon, 0.95);
    ctx.shadowBlur = 26;
    ctx.stroke();
    ctx.stroke();

    ctx.shadowBlur = 10;
    ctx.strokeStyle = theme.icon;
    ctx.stroke();

    return c;
  }, [icon, theme.icon]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, BOX, BOX);
    ctx.drawImage(sprite, 0, 0);
  });

  return (
    <canvas
      ref={canvasRef}
      width={BOX}
      height={BOX}
      style={{
        position: 'absolute',
        left: (CARD - BOX) / 2,
        top: (CARD - BOX) / 2,
        width: BOX,
        height: BOX,
      }}
    />
  );
};
