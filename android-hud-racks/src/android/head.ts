import { staticFile } from "remotion";
import * as THREE from "three";

export type WireEdge = { a: number; b: number; pts: number[][] };
export type HeadHeader = {
  vertexCount: number;
  indexCount: number;
  eyes: { x: number; y: number; z: number }[];
  wireframe: { points: number[][]; edges: WireEdge[] };
};
export type HeadAsset = { geometry: THREE.BufferGeometry; header: HeadHeader };

// Parses head.bin written by scripts/build-android.mjs.
export const loadHead = async (): Promise<HeadAsset> => {
  const res = await fetch(staticFile("models/android/head.bin"));
  if (!res.ok) throw new Error(`head.bin: ${res.status}`);
  const buf = await res.arrayBuffer();
  const hb = new DataView(buf).getUint32(0, true);
  const header = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buf, 4, hb)),
  ) as HeadHeader;
  const v = header.vertexCount;
  let o = 4 + hb;
  const pos = new Float32Array(buf, o, v * 3);
  o += v * 12;
  const nrm = new Float32Array(buf, o, v * 3);
  o += v * 12;
  const seam = new Float32Array(buf, o, v);
  o += v * 4;
  const idx = new Uint32Array(buf, o, header.indexCount);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setAttribute("seam", new THREE.BufferAttribute(seam, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return { geometry: g, header };
};

// Glossy white plastic with dark seams and wrap diffuse.
export const makeHeadMaterial = (envMap: THREE.Texture | null) => {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#E8ECF0"),
    roughness: 0.28,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.12,
    envMap,
    envMapIntensity: 0.6,
  });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float seam;\nvarying float vSeam;\nvarying float vLow;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvSeam = seam;\n// Neck and shoulders: a slightly greyer plastic than the face.\nvLow = smoothstep(-0.45, -0.62, position.y);",
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vSeam;\nvarying float vLow;",
      )
      .replace(
        "#include <color_fragment>",
        // Seams darken toward #4A5058.
        "#include <color_fragment>\ndiffuseColor.rgb *= mix(vec3(1.0), vec3(0.5, 0.53, 0.58), vLow);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.0685, 0.0802, 0.0976), smoothstep(0.35, 0.95, vSeam));",
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.6, smoothstep(0.35, 0.95, vSeam));",
      );
    // Wrap diffuse: light reaches a little past the terminator, like
    // slightly translucent plastic.
    sh.fragmentShader = sh.fragmentShader.replace(
      "#include <lights_physical_pars_fragment>",
      THREE.ShaderChunk.lights_physical_pars_fragment.replace(
        "float dotNL = saturate( dot( geometryNormal, directLight.direction ) );",
        "float dotNL = saturate( ( dot( geometryNormal, directLight.direction ) + 0.3 ) / 1.3 );",
      ),
    );
  };
  return m;
};

// A procedural studio for reflections: a dark room with large soft boxes,
// prefiltered once with PMREM.
export const makeStudioEnv = (
  renderer: THREE.WebGLRenderer,
  panels: {
    pos: [number, number, number];
    size: [number, number];
    color: THREE.ColorRepresentation;
    intensity: number;
  }[],
  ambient: THREE.ColorRepresentation = 0x05070a,
) => {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(20, 20, 20),
    new THREE.MeshBasicMaterial({ color: ambient, side: THREE.BackSide }),
  );
  scene.add(room);
  for (const p of panels) {
    const c = new THREE.Color(p.color).multiplyScalar(p.intensity);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(p.size[0], p.size[1]),
      new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }),
    );
    m.position.set(...p.pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  return rt.texture;
};
