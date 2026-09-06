import * as THREE from "three";
import { LINE_COUNT, ROW_COUNT, SEGMENT_COUNT } from "./constants";
import { mulberry32 } from "./random";

/**
 * One instanced quad per polyline segment. The whole field is a single draw
 * call — 117k segments as 117k instances of a 4-vertex quad — rather than an
 * object per stroke, and the attributes are built once and never touched
 * again: all of the animation happens in the vertex shader.
 *
 * Instances are emitted **far row first**. Because the camera is locked and
 * the grid's Z never changes, that back-to-front order is correct for every
 * frame of the loop, so the strokes can be composited with plain alpha
 * blending and no depth buffer without ever being re-sorted. Near crests draw
 * over the material behind them, and overlapping strokes accumulate density in
 * the right order.
 */
export const createStrokeGeometry = () => {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.instanceCount = SEGMENT_COUNT;

  // Base quad. `position` is unused by the shader — the corners are placed
  // from aCorner in screen space — but three wants it present.
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(12), 3),
  );
  geometry.setAttribute(
    "aCorner",
    new THREE.BufferAttribute(
      // (side, end)
      new Float32Array([-1, 0, 1, 0, -1, 1, 1, 1]),
      2,
    ),
  );
  geometry.setIndex([0, 1, 2, 2, 1, 3]);

  const segment = new Float32Array(SEGMENT_COUNT * 2);
  const random = new Float32Array(SEGMENT_COUNT * 2);

  // Alpha jitter and accent membership are per *line*, not per segment: a
  // polyline whose segments each drew at a different opacity would read as a
  // dashed line rather than a continuous stroke.
  const rand = mulberry32(0x51_4e_11);
  const lineRandom = new Float32Array(LINE_COUNT * 2);
  for (let line = 0; line < LINE_COUNT; line++) {
    lineRandom[line * 2] = rand();
    lineRandom[line * 2 + 1] = rand();
  }

  let i = 0;
  for (let row = ROW_COUNT - 2; row >= 0; row--) {
    const v = row / (ROW_COUNT - 1);
    for (let line = 0; line < LINE_COUNT; line++) {
      segment[i * 2] = line / (LINE_COUNT - 1);
      segment[i * 2 + 1] = v;
      random[i * 2] = lineRandom[line * 2];
      random[i * 2 + 1] = lineRandom[line * 2 + 1];
      i++;
    }
  }

  geometry.setAttribute(
    "iSegment",
    new THREE.InstancedBufferAttribute(segment, 2),
  );
  geometry.setAttribute(
    "iRandom",
    new THREE.InstancedBufferAttribute(random, 2),
  );

  // The vertex shader ignores `position` entirely, so three cannot derive a
  // meaningful bounding volume; the mesh opts out of frustum culling instead.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

  return geometry;
};
