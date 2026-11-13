import { AbsoluteFill } from 'remotion';
import { MapCanvas } from '../render/MapCanvas';
import { hex, type PixiMap } from '../render/pixiMap';
import { TEAL, TEAL_IFACE } from '../looks/styles';
import { getTrack } from '../city/track';
import { LOOP } from '../city';
import { HudCanvas } from '../hud/HudCanvas';
import { drawInterfaceHud, IFACE_MAP } from '../hud/interfaceHud';

const YEL = hex('#F5E21E');
const CREAM = hex('#E8DC80');

// faint square grid behind the map lines (visible in the dark areas, as in the reference)
const grid = (ctx: CanvasRenderingContext2D) => {
  ctx.strokeStyle = 'rgba(120,200,210,0.07)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= 3840; x += 120) { ctx.moveTo(x, 0); ctx.lineTo(x, 2160); }
  for (let y = 0; y <= 2160; y += 120) { ctx.moveTo(0, y); ctx.lineTo(3840, y); }
  ctx.stroke();
};

export const GPSTrack: React.FC<{ variant: 'teal' | 'interface' }> = ({ variant }) => {
  const box = variant === 'teal' ? { x: 0, y: 0, w: 3840, h: 2160 } : IFACE_MAP;
  const zoomBase = variant === 'teal' ? 0.315 : 0.34;
  const dotCol = variant === 'teal' ? YEL : CREAM;
  const ds = variant === 'teal' ? 1 : 0.8;
  const draw = (m: PixiMap, frame: number) => {
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const tr = getTrack();
    const cam = tr.cam[f], dot = tr.dot[f];
    const zoom = zoomBase * (1 + 0.07 * Math.sin((2 * Math.PI * f) / LOOP * 2 + 0.6));
    const pulse = (f % 60) / 60; // 10 pulses per loop
    m.render(
      { cx: cam.x, cy: cam.y, zoom, rot: cam.rot },
      {
        routeHead: dot.s,
        fx: [
          { kind: 'glow', x: dot.x, y: dot.y, r: 80 * ds, color: dotCol, alpha: 0.55, world: true },
          { kind: 'ring', x: dot.x, y: dot.y, r: (34 + 70 * pulse) * ds, thick: 3, color: dotCol, alpha: 0.45 * (1 - pulse) ** 2, world: true },
          { kind: 'disc', x: dot.x, y: dot.y, r: 50 * ds, color: [0.08, 0.1, 0.1], alpha: 0.6, world: true },
          { kind: 'disc', x: dot.x, y: dot.y, r: 49 * ds, color: [1, 1, 0.92], alpha: 1, world: true },
          { kind: 'disc', x: dot.x, y: dot.y, r: 38 * ds, color: variant === 'teal' ? hex('#F2C81E') : CREAM, alpha: 1, world: true },
          { kind: 'disc', x: dot.x, y: dot.y, r: 28 * ds, color: dotCol, alpha: 1, world: true },
        ],
      },
    );
  };
  return (
    <AbsoluteFill style={{ background: variant === 'teal' ? '#000' : '#0B0C0D' }}>
      <MapCanvas style={variant === 'teal' ? TEAL : TEAL_IFACE} {...box} draw={draw} />
      {variant === 'interface' ? <HudCanvas draw={drawInterfaceHud} /> : <HudCanvas draw={grid} />}
    </AbsoluteFill>
  );
};
