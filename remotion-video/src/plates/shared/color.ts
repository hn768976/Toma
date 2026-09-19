/**
 * Hex -> normalised RGB triple for shader uniforms.
 *
 * Values stay display-referred (plain hex/255) rather than being
 * converted to linear light. The plates do their own grading and write
 * straight to an 8-bit sRGB framebuffer, so keeping the authoring space
 * the same as the output space means a colour picked off the reference
 * frame lands on screen as that colour.
 */
export const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
