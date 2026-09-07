import { useThree } from "@react-three/fiber";

/**
 * Size of the actual drawing buffer, in device pixels.
 *
 * Remotion's --scale shows up as devicePixelRatio, so this is 2160 for a 4K
 * render and 1080 for the --scale=0.5 preview. Every size in the shaders is a
 * fraction of frame height multiplied by this, which is what keeps the preview
 * a true scale model of the 4K master.
 */
export const usePixelSize = (): { width: number; height: number } => {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  return { width: size.width * dpr, height: size.height * dpr };
};
