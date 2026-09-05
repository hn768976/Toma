import { AbsoluteFill, useVideoConfig } from "remotion";
import { LAND_PATHS, MAP_VIEWBOX_WIDTH } from "../map/land-paths";
import { MAP_COLOR } from "../palettes";

/**
 * Static continental silhouette across the upper two thirds.
 *
 * Cropped to 84N..58S (the reference map stops well above Antarctica) and
 * blurred a little, so it reads as a shape and never as detail. It does not
 * move with the charts.
 */

// Equirectangular y for the crop, in the generated 1000 x 500 viewBox.
const VIEW_TOP = 14; // 84N
const VIEW_HEIGHT = 397; // down to ~58S

export const WorldMap: React.FC = () => {
  const { width, height } = useVideoConfig();
  const mapWidth = width * 1.02;
  const mapHeight = (mapWidth / MAP_VIEWBOX_WIDTH) * VIEW_HEIGHT;

  return (
    <AbsoluteFill>
      <svg
        width={mapWidth}
        height={mapHeight}
        viewBox={`0 ${VIEW_TOP} ${MAP_VIEWBOX_WIDTH} ${VIEW_HEIGHT}`}
        style={{
          position: "absolute",
          left: (width - mapWidth) / 2,
          top: height * 0.045,
        }}
      >
        <defs>
          <filter id="map-soften" x="-5%" y="-5%" width="110%" height="110%">
            {/* User units, so the softening scales with the render resolution. */}
            <feGaussianBlur stdDeviation={0.9} />
          </filter>
          <radialGradient id="map-falloff" cx="50%" cy="46%" r="62%">
            <stop offset="0%" stopColor="#fff" stopOpacity={1} />
            <stop offset="48%" stopColor="#fff" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#fff" stopOpacity={0.06} />
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
        </defs>
        <g mask="url(#map-mask)" filter="url(#map-soften)">
          {LAND_PATHS.map((d, i) => (
            <path key={i} d={d} fill={MAP_COLOR} />
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
