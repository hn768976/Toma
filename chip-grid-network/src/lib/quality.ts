import { getInputProps } from "remotion";

// Render quality knobs, overridable with --props='{"msaa":0,...}'.
// Defaults are the delivery settings.
export type Quality = { msaa: number; reflectRes: number; shadows: boolean };

// The floor reflection is blurred heavily, so its render target scales with
// the output size: 512 at 1080p, 1024 at 4K, 2048 for the 6000px stills.
const defaultReflectRes = () => {
  const dpr = typeof window === "undefined" ? 0.5 : window.devicePixelRatio;
  const steps = Math.round(Math.log2(Math.max(dpr, 0.5) / 0.5));
  return Math.min(2048, 512 * 2 ** steps);
};

export const getQuality = (): Quality => {
  const p = (typeof window === "undefined" ? {} : getInputProps()) as Partial<Quality>;
  return { msaa: 4, reflectRes: defaultReflectRes(), shadows: true, ...p };
};
