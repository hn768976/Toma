/**
 * The film over the packed tissue.
 *
 * Built from the same field at a slightly larger isosurface, but drawn as
 * light only: additive, with no diffuse term and no alpha silhouette. A
 * semi-transparent solid at this scale reads as shrink-wrap around the mass —
 * a visible outer shell with its own outline. What the reference actually
 * shows is a sheen that crosses several cells and softens the creases beneath
 * it, which is a highlight, not a surface.
 *
 * Absent on looks 1 and 3, prominent on look 2, barely there on look 4.
 */

import * as THREE from "three";
import { SIMPLEX3D } from "./glsl";
import { Lighting } from "./CellMaterial";

const vertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewPos;
uniform float uMottleAmp;
uniform float uMottleFreq;
${SIMPLEX3D}
void main(){
  vec3 p = position + normal * uMottleAmp * snoise(position * uMottleFreq);
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uSheenColor;
uniform float uStrength;
uniform vec3 uKeyDir;
varying vec3 vNormal;
varying vec3 vViewPos;

void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(-vViewPos);
  vec3 L = normalize(uKeyDir);

  // A broad, soft specular lobe plus a grazing-angle term. Both are wide
  // enough to run across several cells rather than outline each one.
  vec3 H = normalize(L + V);
  float broad = pow(max(0.0, dot(N, H)), 10.0);
  float graze = pow(1.0 - max(0.0, dot(N, V)), 4.0);
  float lit = max(0.0, dot(N, L) * 0.5 + 0.5);

  // Weighted toward the broad lobe: the grazing term alone picks out every
  // crease in the film and turns it into webbing between the cells.
  float amount = (broad * 0.9 + graze * 0.12) * lit * uStrength;
  gl_FragColor = vec4(uSheenColor * amount, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const createMembraneMaterial = (
  sheenColor: THREE.ColorRepresentation,
  strength: number,
  light: Lighting,
): THREE.ShaderMaterial => {
  const l = light.keyDirection;
  const len = Math.hypot(l[0], l[1], l[2]) || 1;
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uSheenColor: { value: new THREE.Color(sheenColor) },
      uStrength: { value: strength },
      uMottleAmp: { value: 0.03 },
      uMottleFreq: { value: 0.9 },
      uKeyDir: {
        value: new THREE.Vector3(l[0] / len, l[1] / len, l[2] / len),
      },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
};
