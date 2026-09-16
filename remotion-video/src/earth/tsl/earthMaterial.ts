import {
  cameraPosition,
  cross,
  dot,
  float,
  Fn,
  max,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  normalize,
  oneMinus,
  positionLocal,
  pow,
  saturate,
  smoothstep,
  texture,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { MeshBasicNodeMaterial, type Node, type Texture } from "three/webgpu";
import { CLOUD_RADIUS } from "../config";
import { directionToUv, NORTH } from "./common";
import type { EarthUniforms } from "./uniforms";

/** One texel of the 4096x2048 NASA maps, for the bump-derived normal. */
const TEXEL = 1 / 4096;

export type EarthMaps = {
  day: Texture;
  night: Texture;
  bump: Texture;
  water: Texture;
  clouds: Texture;
};

/**
 * The planet surface.
 *
 * Lighting is written out by hand on an unlit material rather than handed to
 * three's light system: at this range the interesting parts are all things a
 * standard material would not do anyway — a soft wide terminator, city lights
 * fading in behind it, cloud shadows cast from a separate shell, and haze that
 * thickens towards the limb.
 */
export const createEarthMaterial = (maps: EarthMaps, u: EarthUniforms) => {
  const material = new MeshBasicNodeMaterial();

  material.colorNode = Fn(() => {
    const vUv = uv();
    const surfacePoint = positionLocal;
    const geoNormal = normalize(surfacePoint);
    const east = normalize(cross(NORTH, geoNormal));
    const north = cross(geoNormal, east);

    // Relief from the NASA elevation/bathymetry map, differentiated in UV and
    // pushed into the sphere's own tangent frame.
    const h = texture(maps.bump, vUv).r;
    const hEast = texture(maps.bump, vUv.add(vec2(TEXEL, 0))).r;
    const hNorth = texture(maps.bump, vUv.add(vec2(0, TEXEL))).r;
    const relief = geoNormal
      .sub(east.mul(hEast.sub(h).mul(u.reliefStrength)))
      .sub(north.mul(hNorth.sub(h).mul(u.reliefStrength)));

    // A 4K map covers ~10 km per texel, which goes soft this close in, so a
    // high-frequency field adds micro relief and albedo break-up on top.
    const water = texture(maps.water, vUv).r;

    // Near the limb a screen pixel covers kilometres of ground, so any
    // procedural detail there is far below the sampling rate and moires.
    // Fading it with the facing angle keeps it where it is actually resolved.
    const facing = saturate(dot(geoNormal, normalize(cameraPosition.sub(surfacePoint))));
    const detailFade = pow(facing, 1.6);

    // Micro relief only belongs on land; open ocean at this range is smooth,
    // and perturbing it just aliases into a scale pattern.
    const micro = u.microStrength.mul(oneMinus(water.mul(0.9))).mul(detailFade);
    const q = surfacePoint.mul(380);
    const m0 = mx_noise_float(q);
    const mEast = mx_noise_float(q.add(vec3(0.7, 0, 0)));
    const mNorth = mx_noise_float(q.add(vec3(0, 0.7, 0)));
    const normal = normalize(
      relief
        .sub(east.mul(mEast.sub(m0).mul(micro)))
        .sub(north.mul(mNorth.sub(m0).mul(micro))),
    );

    const grain = mx_fractal_noise_float(surfacePoint.mul(320), 3, 2, 0.55);

    const sun = normalize(u.sunDirection);
    const view = normalize(cameraPosition.sub(surfacePoint));
    const ndlGeo = dot(geoNormal, sun);
    const ndl = dot(normal, sun);

    const dayMask = smoothstep(-0.1, 0.16, ndlGeo);
    const warm = smoothstep(0.3, -0.02, ndlGeo).mul(dayMask);
    const sunColor = mix(vec3(1.0, 0.985, 0.96), vec3(1.0, 0.56, 0.3), warm);

    // Blue Marble's ocean is a fairly light blue; deep water this close in
    // reads much darker, and the contrast is what the reference lives on.
    const basemap = texture(maps.day, vUv).rgb;
    const deepened = mix(basemap, basemap.mul(vec3(0.34, 0.55, 0.95)).mul(0.5), water.mul(0.92));
    const albedo = deepened.mul(grain.mul(u.grainAmount).mul(detailFade).add(1));

    // Clouds sit on their own shell, so their shadow is the cloud alpha
    // sampled where the sun ray leaves that shell.
    const climb = float(CLOUD_RADIUS - 1).div(max(ndlGeo, float(0.22)));
    const shadowDir = normalize(surfacePoint.add(sun.mul(climb)));
    const shadowUv = directionToUv(shadowDir).add(vec2(u.cloudDrift, 0));
    const cloudShadow = oneMinus(texture(maps.clouds, shadowUv).a.mul(0.5));

    const lit = saturate(ndl).mul(cloudShadow).mul(u.sunIntensity);
    const diffuse = albedo.mul(lit).mul(sunColor);

    // Sun glint off the oceans, which is what sells the scale of the shot.
    const half = normalize(sun.add(view));
    const glint = pow(saturate(dot(normal, half)), 110)
      .mul(water)
      .mul(dayMask)
      .mul(cloudShadow)
      .mul(0.85);

    // Aerial perspective: the more grazing the view, the more air in the way.
    const grazing = oneMinus(saturate(dot(geoNormal, view)));
    const haze = pow(grazing, 5.0).mul(dayMask).mul(saturate(ndlGeo.add(0.3)));

    // NASA Black Marble. Only its luminance is used: the map's dark blue
    // ocean floor and its JPEG chroma noise both turn into coloured confetti
    // as soon as the lights are amplified, so the hue is supplied here.
    const nightSample = texture(maps.night, vUv).rgb;
    const nightLevel = max(
      dot(nightSample, vec3(0.2126, 0.7152, 0.0722)).sub(0.075),
      float(0),
    );
    const cityGlow = pow(nightLevel.mul(1.6), 1.45)
      .mul(vec3(1.0, 0.78, 0.46))
      .mul(u.nightIntensity)
      .mul(oneMinus(dayMask));

    const color = diffuse
      .add(sunColor.mul(glint))
      .add(vec3(0.24, 0.45, 0.85).mul(haze.mul(0.14)))
      .add(cityGlow)
      .add(albedo.mul(0.014));

    return vec4(color, 1);
  })() as unknown as Node;

  return material;
};
