import { seededRandom } from "../particle-ring/random";
import {
  ACCENT_BRIGHTNESS_BOOST,
  ACCENT_COLUMN_CHANCE,
  COLUMN_BRIGHTNESS_MAX,
  COLUMN_BRIGHTNESS_MIN,
  ROW_BRIGHTNESS,
  SEGMENTS_X,
  SEGMENTS_Z,
} from "./constants";
import {
  VERTEX_COLUMNS,
  VERTEX_ROWS,
  vertexX,
  vertexZ,
} from "./displacement";

// Every grid line is drawn as a screen-space-expanded quad rather than a
// GL line, because GL line width is capped at 1px in practically every
// WebGL implementation -- which would make the 1080p preview four times
// heavier than the 4K render and put the "1.2px at 4K" spec out of reach.
// Each segment gets four vertices (two per endpoint, one either side of
// the line) that the vertex shader pushes apart perpendicular to the
// line's screen-space direction.
const VERTICES_PER_SEGMENT = 4;
const INDICES_PER_SEGMENT = 6;

export type GridBuffers = {
  segmentCount: number;
  vertexCount: number;
  // Static, uploaded once.
  startXZ: Float32Array; // vec2 per vertex
  endXZ: Float32Array; // vec2 per vertex
  side: Float32Array; // -1 / +1, which side of the line this corner is on
  endSelect: Float32Array; // 0 = start endpoint, 1 = end endpoint
  brightness: Float32Array;
  tint: Float32Array; // 0 = base colour, 1 = accent colour
  indices: Uint32Array;
  // Grid-vertex index each segment endpoint reads its height from.
  startHeightIndex: Int32Array;
  endHeightIndex: Int32Array;
};

const gridIndex = (column: number, row: number) => row * VERTEX_COLUMNS + column;

export const buildGridBuffers = (): GridBuffers => {
  // Lines running across x (the horizontal "rows"), plus lines running
  // away from the camera along z (the converging "columns").
  const rowSegments = VERTEX_ROWS * SEGMENTS_X;
  const columnSegments = VERTEX_COLUMNS * SEGMENTS_Z;
  const segmentCount = rowSegments + columnSegments;
  const vertexCount = segmentCount * VERTICES_PER_SEGMENT;

  const startXZ = new Float32Array(vertexCount * 2);
  const endXZ = new Float32Array(vertexCount * 2);
  const side = new Float32Array(vertexCount);
  const endSelect = new Float32Array(vertexCount);
  const brightness = new Float32Array(vertexCount);
  const tint = new Float32Array(vertexCount);
  const indices = new Uint32Array(segmentCount * INDICES_PER_SEGMENT);
  const startHeightIndex = new Int32Array(segmentCount);
  const endHeightIndex = new Int32Array(segmentCount);

  // Per-column identity: brightness jitter and the occasional stronger
  // accent line. Columns are indexed by x, which never scrolls, so this
  // stays rock-steady across the loop.
  const columnBrightness = new Float32Array(VERTEX_COLUMNS);
  const columnTint = new Float32Array(VERTEX_COLUMNS);
  for (let column = 0; column < VERTEX_COLUMNS; column++) {
    const jitter = seededRandom(column, 11);
    const accent = seededRandom(column, 23) < ACCENT_COLUMN_CHANCE;
    columnBrightness[column] =
      COLUMN_BRIGHTNESS_MIN +
      (COLUMN_BRIGHTNESS_MAX - COLUMN_BRIGHTNESS_MIN) * jitter +
      (accent ? ACCENT_BRIGHTNESS_BOOST : 0);
    columnTint[column] = accent ? 1 : 0;
  }

  let segment = 0;
  const pushSegment = (
    startColumn: number,
    startRow: number,
    endColumn: number,
    endRow: number,
    segmentBrightness: number,
    segmentTint: number,
  ) => {
    const base = segment * VERTICES_PER_SEGMENT;
    const ax = vertexX(startColumn);
    const az = vertexZ(startRow);
    const bx = vertexX(endColumn);
    const bz = vertexZ(endRow);
    for (let corner = 0; corner < VERTICES_PER_SEGMENT; corner++) {
      const vertex = base + corner;
      startXZ[vertex * 2] = ax;
      startXZ[vertex * 2 + 1] = az;
      endXZ[vertex * 2] = bx;
      endXZ[vertex * 2 + 1] = bz;
      side[vertex] = corner % 2 === 0 ? -1 : 1;
      endSelect[vertex] = corner < 2 ? 0 : 1;
      brightness[vertex] = segmentBrightness;
      tint[vertex] = segmentTint;
    }
    const indexBase = segment * INDICES_PER_SEGMENT;
    indices[indexBase] = base;
    indices[indexBase + 1] = base + 1;
    indices[indexBase + 2] = base + 2;
    indices[indexBase + 3] = base + 2;
    indices[indexBase + 4] = base + 1;
    indices[indexBase + 5] = base + 3;
    startHeightIndex[segment] = gridIndex(startColumn, startRow);
    endHeightIndex[segment] = gridIndex(endColumn, endRow);
    segment++;
  };

  for (let row = 0; row < VERTEX_ROWS; row++) {
    for (let column = 0; column < SEGMENTS_X; column++) {
      pushSegment(column, row, column + 1, row, ROW_BRIGHTNESS, 0);
    }
  }
  for (let column = 0; column < VERTEX_COLUMNS; column++) {
    const b = columnBrightness[column];
    const c = columnTint[column];
    for (let row = 0; row < SEGMENTS_Z; row++) {
      pushSegment(column, row, column, row + 1, b, c);
    }
  }

  return {
    segmentCount,
    vertexCount,
    startXZ,
    endXZ,
    side,
    endSelect,
    brightness,
    tint,
    indices,
    startHeightIndex,
    endHeightIndex,
  };
};
