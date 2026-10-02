import * as THREE from "three";

/**
 * ACES desaturates bright colours towards white. Glows that should keep their
 * hue on screen start from a more saturated version of the brief's colour:
 * same hue, saturation pushed by `amount` (0 = unchanged, 1 = fully saturated).
 */
export function richer(hex: THREE.ColorRepresentation, amount = 0.6): THREE.Color {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, THREE.MathUtils.lerp(hsl.s, 1, amount), THREE.MathUtils.lerp(hsl.l, 0.5, amount));
}
