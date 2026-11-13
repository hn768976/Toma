import { AbsoluteFill } from 'remotion';
import { MapCanvas } from '../render/MapCanvas';
import { TEAL } from '../looks/styles';
import { MAP_W, MAP_H } from '../city';

// The whole invented city in one still (used for the realism check).
export const CityMapFull: React.FC = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    <MapCanvas
      style={{ ...TEAL, vignette: 0 }}
      w={3840}
      h={2160}
      draw={(m) => m.render({ cx: MAP_W / 2, cy: MAP_H / 2, zoom: 3840 / 12400, rot: 0 })}
    />
  </AbsoluteFill>
);
