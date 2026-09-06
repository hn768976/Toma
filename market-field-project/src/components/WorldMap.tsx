import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { planeTransform, planesAt } from "../camera";
import { CAMERA } from "../config";
import { LAND_PATHS, MAP_VIEWBOX_WIDTH } from "../map/land-paths";
import { MAP_COLOR } from "../palettes";

/**
 * Continental silhouette across the upper two thirds.
 *
 * Cropped to 84N..58S (the reference map stops well above Antarctica) and
 * blurred a little, so it reads as a shape and never as detail. It sits on
 * its own lattice, further back than the charts, so the camera's push-in
 * grows it more slowly than the data in front of it — that difference in
 * rate is what sells the depth.
 */

// Equirectangular y for the crop, in the generated 1000 x 500 viewBox.
const VIEW_TOP = 14; // 84N
const VIEW_HEIGHT = 397; // down to ~58S

/** Baseline softening, in map user units at scale 1. */
const BASE_SOFTENING = 0.9;

export const WorldMap: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const mapWidth = width * 1.02;
  const mapScale = mapWidth / MAP_VIEWBOX_WIDTH;
  const layout = `translate(${((width - mapWidth) / 2).toFixed(2)} ${(height * 0.045).toFixed(2)}) scale(${mapScale.toFixed(5)}) translate(0 ${-VIEW_TOP})`;

  const planes = planesAt(frame / durationInFrames, CAMERA.mapDepth);

  // One map user unit is `mapScale * plane.scale` screen pixels, so both the
  // baseline softening and the defocus are converted back through that to
  // stay constant on screen as a plane comes forward.
  const softening = (plane: (typeof planes)[number]) =>
    BASE_SOFTENING / plane.scale +
    (plane.dof * CAMERA.mapDofScale * width) / (mapScale * plane.scale);

  return (
    <AbsoluteFill>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <radialGradient id="map-falloff" cx="50%" cy="46%" r="62%">
            <stop offset="0%" stopColor="#fff" stopOpacity={1} />
            <stop offset="48%" stopColor="#fff" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#fff" stopOpacity={0} />
          </radialGradient>
          <mask id="map-mask">
            <rect
              x={0}
              y={VIEW_TOP}
              width={MAP_VIEWBOX_WIDTH}
              height={VIEW_HEIGHT}
              fill="url(#map-falloff)"
            />
          </mask>
          {planes.map((plane, i) => (
            // Softening is atmosphere, not geometry: dividing by the plane
            // scale keeps it constant on screen as the plane approaches.
            <filter key={i} id={`map-soften-${i}`} x="-6%" y="-6%" width="112%" height="112%">
              <feGaussianBlur stdDeviation={softening(plane)} />
            </filter>
          ))}
        </defs>
        {planes.map((plane, i) => (
          <g key={i} opacity={plane.opacity} transform={planeTransform(plane.scale, width, height)}>
            <g transform={layout}>
              <g mask="url(#map-mask)" filter={`url(#map-soften-${i})`}>
                {LAND_PATHS.map((d, n) => (
                  <path key={n} d={d} fill={MAP_COLOR} />
                ))}
              </g>
            </g>
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};
