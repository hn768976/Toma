import { AbsoluteFill } from 'remotion';
import { MapCanvas } from '../render/MapCanvas';
import { hex, type PixiMap } from '../render/pixiMap';
import { TEAL, TEAL_IFACE } from '../looks/styles';
import { getTrack } from '../city/track';
import { LOOP } from '../city';
import { HudCanvas } from '../hud/HudCanvas';
import { drawInterfaceHud, IFACE_MAP } from '../hud/interfaceHud';

const YEL = hex('#FFE04A');

export const GPSTrack: React.FC<{ variant: 'teal' | 'interface' }> = ({ variant }) => {
  const box = variant === 'teal' ? { x: 0, y: 0, w: 3840, h: 2160 } : IFACE_MAP;
  const zoomBase = variant === 'teal' ? 0.315 : 0.34;
  const draw = (m: PixiMap, frame: number) => {
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const tr = getTrack();
    const cam = tr.cam[f], dot = tr.dot[f];
    const zoom = zoomBase * (1 + 0.07 * Math.sin((2 * Math.PI * f) / LOOP * 2 + 0.6));
    const pulse = (f % 60) / 60; // 10 pulses per loop
    m.render(
      { cx: cam.x, cy: cam.y, zoom, rot: cam.rot },
      {
        fx: [
          { kind: 'glow', x: dot.x, y: dot.y, r: 95, color: YEL, alpha: 0.5, world: true },
          { kind: 'ring', x: dot.x, y: dot.y, r: 50 + 130 * pulse, thick: 5, color: YEL, alpha: 0.8 * (1 - pulse) ** 1.6, world: true },
          { kind: 'disc', x: dot.x, y: dot.y, r: 48, color: [1, 0.97, 0.8], alpha: 0.95, world: true },
          { kind: 'disc', x: dot.x, y: dot.y, r: 40, color: YEL, alpha: 1, world: true },
        ],
      },
    );
  };
  return (
    <AbsoluteFill style={{ background: variant === 'teal' ? '#000' : '#0B0C0D' }}>
      <MapCanvas style={variant === 'teal' ? TEAL : TEAL_IFACE} {...box} draw={draw} />
      {variant === 'interface' ? <HudCanvas draw={drawInterfaceHud} /> : null}
    </AbsoluteFill>
  );
};
