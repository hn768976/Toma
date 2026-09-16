/**
 * Turns routed polylines into one merged ribbon mesh.
 *
 * Every route becomes a mitred triangle strip lying flat on the board. The
 * ribbon is deliberately much wider than the visible conductor: the shader
 * draws a thin core plus a soft halo inside that width, which is cheaper and
 * steadier than stacking a second glow mesh on top.
 */

import { BufferGeometry, BufferAttribute } from "three/webgpu";
import { TRACE_Y } from "./constants";
import type { Route } from "./traceNetwork";

const BASE_WIDTH = 0.145;
/** Distant traces get slightly wider so they keep covering a pixel or two. */
const WIDTH_GROWTH = 0.055;
const MAX_WIDTH_SCALE = 5.0;

export const buildTraceGeometry = (routes: Route[]): BufferGeometry => {
  let vertexCount = 0;
  let indexCount = 0;

  for (let i = 0; i < routes.length; i++) {
    vertexCount += routes[i].points.length * 2;
    indexCount += (routes[i].points.length - 1) * 6;
  }

  const positions = new Float32Array(vertexCount * 3);
  const across = new Float32Array(vertexCount);
  const arc = new Float32Array(vertexCount);
  // x: route seed, y: route length, z: radius the route starts at
  const routeData = new Float32Array(vertexCount * 3);
  const indices =
    vertexCount > 65535
      ? new Uint32Array(indexCount)
      : new Uint16Array(indexCount);

  let vertex = 0;
  let index = 0;

  for (let r = 0; r < routes.length; r++) {
    const route = routes[r];
    const points = route.points;
    const first = vertex;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const previous = points[i - 1];
      const next = points[i + 1];

      // Normal of the incoming and outgoing segments, in the board plane.
      let inX = 0;
      let inZ = 0;
      if (previous !== undefined) {
        const dx = point.x - previous.x;
        const dz = point.z - previous.z;
        const length = Math.sqrt(dx * dx + dz * dz) || 1;
        inX = -dz / length;
        inZ = dx / length;
      }

      let outX = 0;
      let outZ = 0;
      if (next !== undefined) {
        const dx = next.x - point.x;
        const dz = next.z - point.z;
        const length = Math.sqrt(dx * dx + dz * dz) || 1;
        outX = -dz / length;
        outZ = dx / length;
      }

      let normalX = inX + outX;
      let normalZ = inZ + outZ;
      let normalLength = Math.sqrt(normalX * normalX + normalZ * normalZ);
      if (normalLength < 1e-5) {
        normalX = previous === undefined ? outX : inX;
        normalZ = previous === undefined ? outZ : inZ;
        normalLength = 1;
      } else {
        normalX /= normalLength;
        normalZ /= normalLength;
      }

      // Mitre: stretch the offset so the outer edge stays continuous.
      const reference =
        previous === undefined
          ? { x: outX, z: outZ }
          : { x: inX, z: inZ };
      const projection = Math.abs(
        normalX * reference.x + normalZ * reference.z,
      );
      const mitre = 1 / Math.max(0.42, projection);

      const radius = Math.sqrt(point.x * point.x + point.z * point.z);
      const width =
        BASE_WIDTH *
        Math.min(MAX_WIDTH_SCALE, 1 + radius * WIDTH_GROWTH) *
        0.5 *
        mitre;

      for (let side = 0; side < 2; side++) {
        const sign = side === 0 ? 1 : -1;
        const offset = vertex * 3;
        positions[offset] = point.x + normalX * width * sign;
        positions[offset + 1] = TRACE_Y;
        positions[offset + 2] = point.z + normalZ * width * sign;

        across[vertex] = sign;
        arc[vertex] = route.arcLengths[i];
        routeData[offset] = route.seed;
        routeData[offset + 1] = route.length;
        routeData[offset + 2] = route.startRadius;

        vertex++;
      }

      if (i < points.length - 1) {
        const a = first + i * 2;
        indices[index] = a;
        indices[index + 1] = a + 1;
        indices[index + 2] = a + 3;
        indices[index + 3] = a;
        indices[index + 4] = a + 3;
        indices[index + 5] = a + 2;
        index += 6;
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aAcross", new BufferAttribute(across, 1));
  geometry.setAttribute("aArc", new BufferAttribute(arc, 1));
  geometry.setAttribute("aRoute", new BufferAttribute(routeData, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();

  return geometry;
};
