// Matte standard material with the cube lattice drawn in the shader.
//
// Each column is ONE stretched box. The lines between the stacked cubes are a
// world-space grid on every face (cube edges at whole world units), so a column
// 12 cubes tall looks like 12 cubes. Line width is constant in world units and
// antialiased with fwidth, with a minimum footprint so it never thins below a
// pixel and shimmers.
//
// The same shader darkens faces by how far they sit below the surrounding tops
// (cheap, stable "gap AO" from height) and fades into the void colour with depth.

import * as THREE from "three";

export type VoxelMaterialOptions = {
  tint: string;
  deep: string;
  /** Floating cubes: draw the lattice in the cube's own space instead of world. */
  localGrid?: boolean;
  /** How strongly the gap darkens per cube of depth. */
  aoDepth: number;
  /** Darkest a gap gets (multiplier) before the void fade. */
  aoFloor: number;
  /** World y where the void fade starts and where it is complete. */
  voidStart: number;
  voidEnd: number;
  /** Depth below the rim where the fade starts / ends, and its strength. */
  rimStart: number;
  rimEnd: number;
  rimAmount: number;
};

export const LINE_WIDTH = 0.034; // world units (one cube = 1)

export const makeVoxelMaterial = (o: VoxelMaterialOptions) => {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0,
  });
  const deep = new THREE.Color(o.deep);
  const tint = new THREE.Color(o.tint);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDeep = { value: deep };
    shader.uniforms.uTint = { value: tint };
    shader.uniforms.uAoDepth = { value: o.aoDepth };
    shader.uniforms.uAoFloor = { value: o.aoFloor };
    shader.uniforms.uVoid = { value: new THREE.Vector2(o.voidStart, o.voidEnd) };
    shader.uniforms.uVoidRim = { value: new THREE.Vector3(o.rimStart, o.rimEnd, o.rimAmount) };
    shader.uniforms.uLineWidth = { value: LINE_WIDTH };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        ${o.localGrid ? "" : "attribute vec3 aInfo; // x: column top, y: rim (max top of 3x3), z: lowest top of 3x3"}
        varying vec3 vVfWorld;
        varying vec3 vVfLocal;
        varying vec3 vVfNormal;
        varying vec3 vVfInfo;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          vec4 vfW = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            vfW = instanceMatrix * vfW;
          #endif
          vVfWorld = (modelMatrix * vfW).xyz;
          vVfLocal = position;
          vVfNormal = normal;
          ${o.localGrid ? "vVfInfo = vec3(0.0);" : "vVfInfo = aInfo;"}
        }`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uDeep;
        uniform vec3 uTint;
        uniform float uAoDepth;
        uniform float uAoFloor;
        uniform vec2 uVoid;
        uniform vec3 uVoidRim;
        uniform float uLineWidth;
        varying vec3 vVfWorld;
        varying vec3 vVfLocal;
        varying vec3 vVfNormal;
        varying vec3 vVfInfo;

        // Coverage of a line of width w (world units) centred on whole values of x.
        float vfLine(float x, float w) {
          float fw = max(fwidth(x), 1e-5);
          float d = abs(fract(x - 0.5) - 0.5);
          float wp = max(w, fw * 0.75);          // never thinner than ~0.75 px
          float a = 1.0 - smoothstep(wp - fw * 0.5, wp + fw * 0.5, d);
          return a * (w / wp);                    // keep the same visual weight
        }
        float vfEdge(float d, float w) {          // line hugging a face edge at d = 0
          float fw = max(fwidth(d), 1e-5);
          float wp = max(w, fw * 0.75);
          return (1.0 - smoothstep(wp - fw * 0.5, wp + fw * 0.5, abs(d))) * (w / wp);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float vfTopMask;
        float vfDepth;
        {
          vec3 n = normalize(vVfNormal);
          vec3 an = abs(n);
          float w = uLineWidth;
          float line = 0.0;
          ${
            o.localGrid
              ? `
          vec3 p = vVfLocal + 0.5;  // cube spans 0..1 in its own space
          vec2 uv = an.y > 0.5 ? p.xz : (an.x > 0.5 ? p.zy : p.xy);
          line = max(vfLine(uv.x, w * 1.4), vfLine(uv.y, w * 1.4));
          vfDepth = max(0.0, -vVfWorld.y);
          `
              : `
          vec3 p = vVfWorld;        // cube edges sit on whole world units
          vec2 uv = an.y > 0.5 ? p.xz : (an.x > 0.5 ? p.zy : p.xy);
          line = max(vfLine(uv.x, w), vfLine(uv.y, w));
          if (an.y < 0.5) line = max(line, vfEdge(vVfInfo.x - p.y, w)); // top edge of a moving column
          vfDepth = max(0.0, vVfInfo.y - p.y);
          `
          }
          vfTopMask = step(0.5, n.y);
          // Lines: thin and slightly darker than the face.
          diffuseColor.rgb *= 1.0 - 0.3 * line;
          // Darker and more saturated toward the bottom of each gap.
          float ao = 1.0 - exp(-vfDepth / uAoDepth);
          diffuseColor.rgb = mix(diffuseColor.rgb, uTint, 0.7 * ao);
          diffuseColor.rgb *= mix(1.0, uAoFloor, ao * ao);
        }`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.42, vfTopMask); // faint sheen on tops`,
      )
      .replace(
        "#include <opaque_fragment>",
        `{
          // Fall into the void: fade to the deep colour with depth below the
          // rim (narrow holes go dark fast) and with absolute depth.
          float v = max(smoothstep(uVoid.x, uVoid.y, vVfWorld.y),
                        uVoidRim.z * smoothstep(uVoidRim.x, uVoidRim.y, vfDepth));
          // Walls of a hole into the void (a neighbour has fallen through): only
          // a few cubes of them are visible, so they go to black within ~6 cubes.
          ${
            o.localGrid
              ? ""
              : `float voidNear = smoothstep(uVoid.x, uVoid.x - 8.0, vVfInfo.z);
          v = max(v, uVoidRim.z * voidNear * smoothstep(0.5, 6.0, vfDepth));`
          }
          outgoingLight = mix(outgoingLight, uDeep * 0.25, v);
        }
        #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () =>
    `voxel:${o.localGrid ? 1 : 0}:${o.tint}:${o.deep}:${o.aoDepth}:${o.aoFloor}:${o.voidStart}:${o.voidEnd}:${o.rimStart}:${o.rimEnd}:${o.rimAmount}`;
  return mat;
};
