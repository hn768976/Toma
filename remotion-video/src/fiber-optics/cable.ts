import * as THREE from "three/webgpu";
import {
  cameraPosition,
  color,
  float,
  mix,
  normalWorld,
  positionWorld,
  texture,
  uniform,
  uv,
  vec2,
} from "three/tsl";
import type { Palette } from "./palette";

/**
 * A cable is modelled along its local +X axis with the plane the fibers leave
 * from at x = 0, so every part can be positioned by a single number:
 *
 *   x = -SHEATH_LENGTH ......... -2.25  -2.05 -1.85  ............ +0.1
 *       |<------ sheath ------>|  ring   ring  |<--- sleeve --->|
 *                                                 fibers exit ->
 */
export const SHEATH_LENGTH = 34;

/**
 * How many times the 14-glyph texture tiles along the sheath. Whole number, so
 * the grid wraps seamlessly; chosen to keep glyphs roughly square once wrapped
 * around a cable of SHEATH_RADIUS.
 */
const SHEATH_DIGIT_REPEAT = 10;
export const SHEATH_RADIUS = 0.5;
export const SLEEVE_RADIUS = 0.56;
export const SLEEVE_START = -1.85;
export const SLEEVE_END = 0.1;

/** Radius of the disc the fiber roots are packed into, inside the sleeve. */
export const CORE_RADIUS = 0.34;

/** Fresnel term: 1 on the silhouette, 0 where the surface faces the camera. */
const rimFactor = () =>
  cameraPosition
    .sub(positionWorld)
    .normalize()
    .dot(normalWorld)
    .abs()
    .oneMinus();

/** A cylinder whose axis runs along +X, spanning [xStart, xEnd]. */
const axialCylinder = (radius: number, xStart: number, xEnd: number, segments = 64) => {
  const length = xEnd - xStart;
  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments, 1, true);
  geometry.rotateZ(-Math.PI / 2); // +Y becomes +X, so v runs along the cable
  geometry.translate(xStart + length / 2, 0, 0);
  return geometry;
};

export type CableSkin = {
  group: THREE.Group;
  /** Advances the scrolling data texture. Called once per frame. */
  setScroll: (value: number) => void;
};

/**
 * Builds the sheath + ferrule rings + connector sleeve for one cable.
 * The fiber bundle is added separately by `buildFiberBundle`.
 */
export const buildCableShell = ({
  palette,
  binaryTexture,
  sleeveTexture,
  sparkleTexture,
  scrollOffset,
  dim,
}: {
  palette: Palette;
  binaryTexture: THREE.Texture;
  sleeveTexture: THREE.Texture;
  sparkleTexture: THREE.Texture;
  /** Per-cable phase so neighbouring cables don't scroll in lockstep. */
  scrollOffset: number;
  /** Overall brightness, used to push cables behind the hero one back. */
  dim: number;
}): CableSkin => {
  const group = new THREE.Group();
  const scroll = uniform(0);

  const sheathColor = color(palette.sheath);
  const rimColor = color(palette.rim);
  const digitColor = color(palette.digits);
  const sparkleColor = color(palette.sparkle);

  // --- Sheath: translucent data-printed tube -------------------------------
  const sheathMaterial = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const sheathUv = uv();
  // The cylinder's u runs around the circumference and v along the cable. The
  // glyphs in the texture stand upright along texture-y, so texture-y must map
  // to the circumference for digits to read across the cable the way printing
  // on a real cable does. Hence the swap.
  //
  // Both repeats are whole numbers so the random glyph grid tiles without a
  // visible seam. Scrolling texture-x sends the data towards the connector.
  //
  // Swapping the two axes on its own is a transpose, which would print every
  // glyph mirrored; flipping one axis back turns it into a plain rotation.
  const dataUv = vec2(
    sheathUv.y.mul(SHEATH_DIGIT_REPEAT).add(scroll.add(scrollOffset)),
    sheathUv.x.oneMinus(),
  );
  const digits = texture(binaryTexture, dataUv).r;
  const sparkles = texture(
    sparkleTexture,
    vec2(sheathUv.y.mul(7.0).add(scroll.mul(0.4)), sheathUv.x.mul(2.0)),
  ).r;
  const sheathRim = rimFactor().pow(2.4);

  // Perspective makes the far end of the sheath tiny; fading it out stops the
  // digits aliasing into noise where the tube is only a few pixels wide.
  const distanceFade = sheathUv.y.smoothstep(0.0, 0.55);

  sheathMaterial.colorNode = sheathColor
    .mul(0.22)
    .add(digitColor.mul(digits).mul(0.62))
    .add(sparkleColor.mul(sparkles).mul(0.3))
    .add(rimColor.mul(sheathRim).mul(0.8))
    .mul(distanceFade)
    .mul(dim);
  sheathMaterial.opacityNode = float(1);

  const sheath = new THREE.Mesh(
    axialCylinder(SHEATH_RADIUS, -SHEATH_LENGTH, -2.25, 48),
    sheathMaterial,
  );
  sheath.renderOrder = 2;
  group.add(sheath);

  // --- Ferrule rings: the dark collars at the connector --------------------
  const ferruleMaterial = new THREE.MeshBasicNodeMaterial();
  ferruleMaterial.colorNode = mix(
    color(palette.ferrule),
    rimColor.mul(0.5),
    rimFactor().pow(3.0),
  ).mul(dim);

  for (const [x, width, radius] of [
    [-2.22, 0.16, 0.62],
    [-2.0, 0.1, 0.6],
    [-1.86, 0.08, 0.6],
  ] as const) {
    const ring = new THREE.Mesh(
      axialCylinder(radius, x - width / 2, x + width / 2, 48),
      ferruleMaterial,
    );
    ring.renderOrder = 1;
    group.add(ring);
  }

  // --- Sleeve: the clear connector body with large digits ------------------
  const sleeveMaterial = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const sleeveUv = uv();
  // Same swap as the sheath, at roughly twice the glyph size. The sleeve is
  // short enough that texture-x never wraps, so no seam to worry about.
  const sleeveDigits = texture(
    sleeveTexture,
    vec2(
      sleeveUv.y.mul(0.55).add(scroll.mul(0.45).add(scrollOffset)),
      sleeveUv.x.oneMinus(),
    ),
  ).r;
  const sleeveRim = rimFactor().pow(1.9);

  sleeveMaterial.colorNode = sheathColor
    .mul(0.3)
    .add(digitColor.mul(sleeveDigits).mul(0.95))
    .add(rimColor.mul(sleeveRim).mul(1.0))
    .mul(dim);
  sleeveMaterial.opacityNode = float(1);

  const sleeve = new THREE.Mesh(
    axialCylinder(SLEEVE_RADIUS, SLEEVE_START, SLEEVE_END, 56),
    sleeveMaterial,
  );
  sleeve.renderOrder = 3;
  group.add(sleeve);

  return {
    group,
    setScroll: (value: number) => {
      scroll.value = value;
    },
  };
};
