declare const process: { env: Record<string, string | undefined> };

const read = (k: string) =>
  typeof process !== "undefined" ? process.env[k] : undefined;

/** Debug switches, used only while bringing the render up. */
export const POST_MODE = read("REMOTION_POST_MODE") ?? "full";
/** Comma list of effects to include: dof,bloom,tonemap,grain */
export const POST_FX = (read("REMOTION_POST_FX") ?? "dof,bloom,tonemap,grain")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
/** "half" or "uint" */
export const POST_FB = read("REMOTION_POST_FB") ?? "half";

/** Camera override for angle sweeps: "px,py,pz,lx,ly,lz,fov". */
export const CAM_OVERRIDE = (() => {
  const raw = read("REMOTION_CAM");
  if (!raw) return null;
  const n = raw.split(",").map(Number);
  if (n.length !== 7 || n.some(Number.isNaN)) return null;
  return {
    position: [n[0], n[1], n[2]] as [number, number, number],
    lookAt: [n[3], n[4], n[5]] as [number, number, number],
    fov: n[6],
  };
})();
