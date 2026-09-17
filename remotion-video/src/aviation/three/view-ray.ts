import {
  cameraProjectionMatrixInverse,
  cameraWorldMatrix,
  normalize,
  screenUV,
  vec4,
} from "three/tsl";
import type { TSL } from "./tsl";

/**
 * World-space view ray for the current fragment, reconstructed from the screen
 * position and the camera matrices.
 *
 * The obvious alternative — normalising `positionWorld - cameraPosition` on the
 * sky dome — ties the ray to the dome's transform, and a dome that is re-centred
 * on the camera every frame is exactly the kind of thing that can be a frame
 * stale or subtly mismatched. Going through the projection matrix instead gives
 * a ray that is correct by construction and independent of what geometry
 * happens to be carrying the shader.
 *
 * three's `screenUV` runs bottom-up while clip space runs top-down, so V is
 * inverted here. Without it the sky is a perfect vertical mirror of the scene:
 * geometry lands correctly, the sun and the cloud deck end up on the wrong side
 * of frame, and nothing about the render looks broken enough to be obvious.
 */
export const viewRayDirection = (flipY = true): TSL => {
  const ndcX = screenUV.x.mul(2).sub(1);
  const rawY = screenUV.y.mul(2).sub(1);
  const ndcY = flipY ? rawY.negate() : rawY;
  // Any depth inside the frustum works; the ray only needs a direction.
  const view = cameraProjectionMatrixInverse.mul(vec4(ndcX, ndcY, 0.5, 1));
  const viewDirection = view.xyz.div(view.w);
  return normalize(cameraWorldMatrix.mul(vec4(viewDirection, 0)).xyz) as unknown as TSL;
};
