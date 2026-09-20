import {
  AdditiveBlending,
  Color,
  Matrix3,
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
  Vector2,
  type Texture,
  type Vector3,
} from "three/webgpu";
import {
  Fn,
  cameraPosition,
  equirectUV,
  float,
  mix,
  normalWorld,
  oneMinus,
  positionWorld,
  reflect,
  refract,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import type { GlassVariant } from "./variants";

/** The vec3 node type TSL's direction-taking helpers accept. */
type Vec3Node = Exclude<NonNullable<Parameters<typeof equirectUV>[0]>, Vector3>;

export type BackdropMaterial = {
  material: MeshBasicNodeMaterial;
  setGlow: (x: number, y: number) => void;
};

/**
 * The field behind the glass: a vertical gradient, a soft light pool that
 * drifts across it, a broad side wash and a gentle vignette.
 *
 * It is a real opaque mesh rather than a scene background because the glass
 * uses transmission -- it can only refract what is rendered into the opaque
 * pass, and refracting this gradient is what gives the discs their interior
 * tone.
 */
export const createBackdropMaterial = (
  variant: GlassVariant,
  planeWidth: number,
  planeHeight: number,
): BackdropMaterial => {
  const cfg = variant.backdrop;
  const halfW = planeWidth / 2;
  const halfH = planeHeight / 2;

  const topColor = uniform(new Color(cfg.top));
  const bottomColor = uniform(new Color(cfg.bottom));
  const glowColor = uniform(new Color(cfg.glowColor));
  const washColor = uniform(new Color(cfg.washColor));
  const glowPosition = uniform(new Vector2(0, 0));

  const material = new MeshBasicNodeMaterial();
  material.colorNode = Fn(() => {
    // Plane-local coordinates in world units, so the animated glow position
    // can be authored in the same space as the discs.
    const p = uv().sub(0.5).mul(vec2(planeWidth, planeHeight));

    const base = mix(
      bottomColor,
      topColor,
      smoothstep(float(-halfH), float(halfH), p.y),
    );

    const d = p.sub(glowPosition).length().div(float(cfg.glowRadius));
    const glow = oneMinus(smoothstep(float(0), float(1), d)).pow(float(2));

    const wash = oneMinus(smoothstep(float(-halfW), float(halfW * 0.6), p.x));

    const radial = p.div(vec2(halfW, halfH)).length();
    const vignette = mix(
      float(1 - cfg.vignette),
      float(1),
      oneMinus(smoothstep(float(0.35), float(1.4), radial)),
    );

    return base
      .add(glowColor.mul(glow).mul(float(cfg.glowIntensity)))
      .add(washColor.mul(wash).mul(float(cfg.washIntensity)))
      .mul(vignette);
  })();

  return {
    material,
    setGlow: (x: number, y: number) => {
      glowPosition.value.set(x, y);
    },
  };
};

/**
 * The glass body: physically based transmission so the backdrop is genuinely
 * refracted through the disc, with volumetric dispersion splitting wavelengths
 * inside the material.
 */
export const createGlassMaterial = (
  variant: GlassVariant,
): MeshPhysicalNodeMaterial => {
  const g = variant.glass;
  const material = new MeshPhysicalNodeMaterial();
  material.color = new Color(0xffffff);
  material.metalness = 0;
  material.roughness = g.roughness;
  material.transmission = 1;
  material.thickness = g.thickness;
  material.ior = g.ior;
  material.dispersion = g.dispersion;
  material.attenuationColor = new Color(g.attenuationColor);
  material.attenuationDistance = g.attenuationDistance;
  material.envMapIntensity = g.envMapIntensity;
  material.clearcoat = 0.12;
  material.clearcoatRoughness = 0.08;
  return material;
};

export type RimMaterial = {
  material: MeshBasicNodeMaterial;
  setEnvironmentRotation: (m: Matrix3) => void;
};

/**
 * The rim highlight.
 *
 * Both references get their signature from the rounded edge of the glass: a
 * thin blown-out arc where the edge catches a light, with a rainbow fringe just
 * inside it. That is reproduced here by sampling the environment three times
 * through slightly different refraction indices -- red bends least, blue most --
 * and cross-fading to a reflection at grazing angles.
 *
 * It renders additively with depth testing off so that, as in the references,
 * every circle's edge stays readable through the circles in front of it.
 */
export const createRimMaterial = (
  variant: GlassVariant,
  envTexture: Texture,
): RimMaterial => {
  const cfg = variant.rim;
  const tint = uniform(new Color(cfg.tint));
  const envRotation = uniform(new Matrix3());
  const baseEta = 1 / variant.glass.ior;

  const material = new MeshBasicNodeMaterial();
  material.colorNode = Fn(() => {
    const n = normalWorld.normalize();
    const viewDir = cameraPosition.sub(positionWorld).normalize();
    const incident = viewDir.negate();

    const sampleEnv = (direction: Vec3Node) =>
      texture(envTexture, equirectUV(envRotation.mul(direction).normalize()));

    // 0 where the rim faces the camera, 1 at the silhouette.
    const edge = oneMinus(n.dot(viewDir).abs().clamp(0, 1));

    // Outer lobe: a hard specular line right on the silhouette.
    const specular = edge.pow(float(cfg.edgePower));
    const reflection = sampleEnv(reflect(incident, n)).rgb;

    // Inner lobe: light refracted through the bevel, split by wavelength.
    // Suppressing the outermost sliver sets it just inside the specular line,
    // which is the gap-then-rainbow structure both references show.
    const crescent = edge
      .pow(float(cfg.bandPower))
      .mul(oneMinus(edge.pow(float(cfg.innerFalloff))));
    const spread = float(cfg.iorSpread);
    const red = sampleEnv(refract(incident, n, float(baseEta).add(spread))).r;
    const green = sampleEnv(refract(incident, n, float(baseEta))).g;
    const blue = sampleEnv(refract(incident, n, float(baseEta).sub(spread))).b;
    const dispersed = vec3(red, green, blue);

    return reflection
      .mul(specular)
      .mul(float(cfg.specularGain))
      .add(dispersed.mul(crescent).mul(float(cfg.dispersionGain)))
      .mul(tint);
  })();

  material.transparent = true;
  material.blending = AdditiveBlending;
  material.depthWrite = false;
  material.depthTest = false;

  return {
    material,
    setEnvironmentRotation: (m: Matrix3) => {
      envRotation.value.copy(m);
    },
  };
};
