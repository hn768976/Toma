import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/** Drawing-buffer size in device pixels (e.g. 1280x720 at --scale=1/3). */
export const useBufferSize = () => {
  const { gl, size } = useThree();
  const v = new THREE.Vector2();
  gl.getDrawingBufferSize(v);
  // size is a dependency so callers re-run when the canvas resizes
  return { w: v.x || size.width, h: v.y || size.height };
};
