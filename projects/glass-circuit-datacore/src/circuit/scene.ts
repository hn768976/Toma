import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { cameraAt } from "./camera";
import { createGlyphTexture } from "./glyphs";
import { CircuitLook, Variant } from "./palette";
import { gradeShader, LayeredDofPass } from "./post";
import {
  CELL,
  CELLS,
  cellHeight,
  PANELS,
  panelPose,
  PLATE_DEPTH,
  PLATE_SPACING,
  PLATE_THICKNESS,
  PLATES_PER_CELL,
  plateGlow,
} from "./timeline";

const WORLD_LAYER = 0;
const PANEL_TURN = THREE.MathUtils.degToRad(8);
const GLASS_LAYER = 1;

/** Thin heat-sink / memory plate with a stepped "tab" profile. */
const createPlateGeometry = () => {
  const D = PLATE_DEPTH;
  const s = new THREE.Shape();
  s.moveTo(-D / 2, 0);
  s.lineTo(D / 2, 0);
  s.lineTo(D / 2, 0.36);
  s.lineTo(D / 2 - 0.05, 0.41);
  s.lineTo(D / 2 - 0.05, 0.53);
  s.lineTo(D / 2, 0.58);
  s.lineTo(D / 2, 0.86);
  s.lineTo(0.2, 0.86);
  s.lineTo(0.15, 1.0);
  s.lineTo(-D / 2 + 0.05, 1.0);
  s.lineTo(-D / 2, 0.95);
  s.lineTo(-D / 2, 0);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: PLATE_THICKNESS,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -PLATE_THICKNESS / 2);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
};

const glassVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vViewW;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewW = cameraPosition - w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const glassFragment = /* glsl */ `
uniform sampler2D uGlyph;
uniform sampler2D uWorldDepth;
uniform vec2 uRes;
uniform vec2 uSize;
uniform float uOpacity;
uniform float uPass;
uniform vec3 uTint;
uniform vec3 uEdge;
uniform vec3 uGlyphCol;
uniform float uFlicker;
uniform float uBack;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vViewW;

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
// chip-like outline: chamfered corners, side tabs and a stepped top
float shapeSD(vec2 p) {
  vec2 b = uSize * 0.5 - 0.012;
  float d = sdBox(p, b);
  float ch = (abs(p.x) + abs(p.y)) - (b.x + b.y - 0.07);
  d = max(d, ch * 0.7071);
  vec2 q = vec2(abs(p.x) - b.x, abs(p.y) - b.y * 0.56);
  d = max(d, -sdBox(q, vec2(0.024, 0.075)));
  vec2 r = vec2(abs(p.x) - b.x * 0.52, p.y - b.y);
  d = max(d, -sdBox(r, vec2(0.09, 0.02)));
  return d;
}

void main() {
  vec2 p = (vUv - 0.5) * uSize;
  float d = shapeSD(p);
  float aa = max(fwidth(d), 1e-5);
  float inside = smoothstep(aa, -aa, d);
  if (inside < 0.002) discard;
  // manual occlusion against the opaque landscape
  float wz = texture2D(uWorldDepth, gl_FragCoord.xy / uRes).x;
  if (gl_FragCoord.z > wz + 2e-6) discard;
  if (uPass < 0.5) {
    gl_FragColor = vec4(0.0);
    return;
  }
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(vViewW);
  float fres = pow(1.0 - abs(dot(n, v)), 3.0);

  // single thin specular rim (bevelled glass edge)
  float rim = smoothstep(0.005 + aa, 0.005 - aa, abs(d + 0.004));
  float bevel = 0.0;
  // bright glints where the bevelled edge turns the corners
  vec2 hb = uSize * 0.5;
  float corner = smoothstep(0.2, 0.0, length(abs(p) - hb + 0.07));
  float glint = corner * (rim * 1.6 + smoothstep(-0.05, 0.0, d) * 0.35);
  // glass thickness: brighter band just inside the rim
  float band = smoothstep(-0.03, -0.004, d) * 0.22;

  vec2 guv = p / (uSize - vec2(0.16, 0.14)) + 0.5;
  float inGlyph = step(0.0, guv.x) * step(guv.x, 1.0) * step(0.0, guv.y) * step(guv.y, 1.0);
  float g = texture2D(uGlyph, guv).a * inGlyph * uFlicker * (1.0 - uBack);

  // faint diagonal sheen
  float sheen = smoothstep(0.25, 0.0, abs(p.x * 0.6 + p.y - 0.15)) * 0.16;

  // clear glass: mostly transparent body, thin unlit edges that catch a
  // little specular, a second (back) face gives the slab visible thickness
  // grey-blue glass body with a Fresnel reflection, so the slab reads as glass
  float aBase = (0.13 + 0.45 * fres + band + sheen) * mix(1.0, 0.6, uBack);
  vec3 col = uTint * aBase + uEdge * (rim * 0.6 + band * 0.35 + sheen * 0.8 + fres * 0.25 + glint) + uGlyphCol * g * 1.25;
  float a = clamp(aBase + rim * 0.5 + glint * 0.5 + g * 0.8, 0.0, 1.0);
  a *= inside * uOpacity;
  gl_FragColor = vec4(col * inside * uOpacity, a);
}
`;

export type CircuitScene = {
  render: (t: number, frame: number) => void;
  dispose: () => void;
};

export const createCircuitScene = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  look: CircuitLook,
  variant: Variant,
): CircuitScene => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = look.exposure;
  renderer.setClearColor(new THREE.Color(look.background), 1);

  const res = Math.min(width / 3840, height / 2160); // resolution scale vs 4K
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environment = envTex;
  scene.environmentIntensity = look.envIntensity;

  const camera = new THREE.PerspectiveCamera(21, width / height, 0.5, 80);
  // V2's lower crane angle sees further: fade the far rows into the haze
  if (variant === "v2") scene.fog = new THREE.Fog(new THREE.Color(look.background), 9, 17);

  // ---------------------------------------------------------- landscape
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#07090c"),
      metalness: 0.6,
      roughness: 0.55,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  scene.add(new THREE.HemisphereLight("#9fb4d6", "#020305", 0.35));
  const key = new THREE.DirectionalLight(look.keyColor, look.keyIntensity);
  key.position.set(-6, 9, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(look.rimColor, look.rimIntensity);
  rim.position.set(8, 6, -4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight("#7f9cc8", 0.6);
  fill.position.set(-3, 2, -8);
  scene.add(fill);

  const plateGeo = createPlateGeometry();
  const count = CELLS.cells.length * PLATES_PER_CELL;
  const glowAttr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  plateGeo.setAttribute("aGlow", glowAttr);
  const finMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(look.fin),
    metalness: look.finMetalness,
    roughness: look.finRoughness,
  });
  const glowColor = new THREE.Color(look.glowColor);
  finMat.onBeforeCompile = (shader) => {
    shader.uniforms.uGlowColor = { value: glowColor };
    shader.uniforms.uGlowIntensity = { value: look.glowIntensity };
    shader.uniforms.uTipGlow = { value: look.tipGlow };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aGlow;\nvarying float vGlow;\nvarying float vUp;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = aGlow;\nvUp = normal.y;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vGlow;\nvarying float vUp;\nuniform vec3 uGlowColor;\nuniform float uGlowIntensity;\nuniform float uTipGlow;",
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85), clamp(vGlow, 0.0, 1.0));",
      )
      .replace(
        "#include <emissivemap_fragment>",
        // bright fin tips: the up-facing top edges catch light (sparkle of the rows)
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlowColor * (vGlow * uGlowIntensity + uTipGlow * smoothstep(0.6, 0.95, vUp) * (1.0 - clamp(vGlow, 0.0, 1.0)));",
      )
      .replace(
        "#include <metalnessmap_fragment>",
        "#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.0, clamp(vGlow, 0.0, 1.0));",
      );
  };
  const fins = new THREE.InstancedMesh(plateGeo, finMat, count);
  fins.renderOrder = -1; // landscape first, so the ground plane is depth-rejected
  fins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fins.frustumCulled = false;
  scene.add(fins);

  // ------------------------------------------------------------- glass
  const glyphs = [0, 1, 2, 3].map((i) => createGlyphTexture(4000 + i * 17));
  const glassMats: THREE.ShaderMaterial[] = [];
  const glassMeshes = PANELS.map((p, i) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uGlyph: { value: glyphs[p.glyph] },
        uWorldDepth: { value: null },
        uRes: { value: new THREE.Vector2(width, height) },
        uSize: { value: new THREE.Vector2(p.w, p.h) },
        uOpacity: { value: p.opacity },
        uPass: { value: 1 },
        uTint: { value: new THREE.Color(look.glassTint) },
        uEdge: { value: new THREE.Color(look.glassEdge) },
        uGlyphCol: { value: new THREE.Color(look.glyphColor) },
        uFlicker: { value: 1 },
        uBack: { value: 0 },
      },
      vertexShader: glassVertex,
      fragmentShader: glassFragment,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    glassMats.push(mat);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), mat);
    // panels stand on the rows, turned to face the lens ~25° off-axis
    m.rotation.y = -Math.PI / 2 + PANEL_TURN;
    m.layers.set(GLASS_LAYER);
    m.userData.index = i;
    scene.add(m);
    return m;
  });

  // ------------------------------------------------------------ post
  const dof = new LayeredDofPass(width, height, {
    near: camera.near,
    far: camera.far,
    focus: 10,
    blurScale: 540 * res,
    maxCoc: 64 * res,
  });
  glassMats.forEach((m) => (m.uniforms.uWorldDepth.value = dof.world.depthTexture));

  dof.renderLayers = (r) => {
    const prevAutoClear = r.autoClear;
    r.autoClear = false; // we clear explicitly; the glass needs two passes
    // opaque landscape
    camera.layers.set(WORLD_LAYER);
    r.setRenderTarget(dof.world);
    r.setClearColor(new THREE.Color(look.background), 1);
    r.clear(true, true, true);
    r.render(scene, camera);
    // glass: depth pre-pass (front-most panel), then premultiplied colour
    camera.layers.set(GLASS_LAYER);
    r.setRenderTarget(dof.glass);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, true);
    for (const m of glassMats) {
      m.colorWrite = false;
      m.depthWrite = true;
      m.depthTest = true;
      m.uniforms.uPass.value = 0;
    }
    r.render(scene, camera);
    for (const m of glassMats) {
      m.colorWrite = true;
      m.depthWrite = false;
      m.depthTest = false;
      m.uniforms.uPass.value = 1;
    }
    r.render(scene, camera);
    r.setClearColor(new THREE.Color(look.background), 1);
    camera.layers.set(WORLD_LAYER);
    r.autoClear = prevAutoClear;
  };

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);
  composer.setSize(width, height);
  composer.addPass(dof);
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    look.bloomStrength,
    look.bloomRadius,
    look.bloomThreshold,
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(gradeShader);
  grade.uniforms.uShadows.value.set(...look.gradeShadows);
  grade.uniforms.uHighlights.value.set(...look.gradeHighlights);
  grade.uniforms.uSaturation.value = look.gradeSaturation;
  grade.uniforms.uLift.value = look.gradeLift;
  grade.uniforms.uGamma.value = look.gradeGamma;
  grade.uniforms.uVignette.value = look.vignette;
  grade.uniforms.uGrain.value = look.grain;
  grade.uniforms.uRes.value.set(width, height);
  composer.addPass(grade);

  // ---------------------------------------------------------- per frame
  const mtx = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();

  const render = (t: number, frame: number) => {
    // camera
    const pose = cameraAt(variant, t);
    camera.fov = pose.fov;
    camera.aspect = width / height;
    camera.position.copy(pose.position);
    camera.lookAt(pose.target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    dof.params.focus = pose.focus;

    // plates – drawn front-to-back so early depth rejection skips hidden fins
    const cx = camera.position.x;
    const cz = camera.position.z;
    const order = CELLS.cells
      .map((c) => ({ c, d: (c.ix * CELL - cx) ** 2 + (c.iz * CELL - cz) ** 2 }))
      .sort((a, b) => a.d - b.d);
    let idx = 0;
    for (const { c } of order) {
      const h = cellHeight(c, t);
      const raised = Math.min(1, Math.max(0, (h - c.base) / 0.25));
      for (let p = 0; p < PLATES_PER_CELL; p++) {
        const jitter = 1 + (0.025 + 0.05 * raised) * Math.sin(p * 0.9 + c.phase);
        pos.set(
          c.ix * CELL + (p - (PLATES_PER_CELL - 1) / 2) * PLATE_SPACING,
          0,
          c.iz * CELL,
        );
        scl.set(1, h * jitter, 1);
        mtx.compose(pos, quat, scl);
        fins.setMatrixAt(idx, mtx);
        glowAttr.setX(idx, plateGlow(c, p, t));
        idx++;
      }
    }
    fins.instanceMatrix.needsUpdate = true;
    glowAttr.needsUpdate = true;

    // panels
    PANELS.forEach((p, i) => {
      const pp = panelPose(p, t);
      const m = glassMeshes[i];
      m.position.set(pp.x, pp.y + p.h / 2, pp.z);
      m.updateMatrixWorld();
    });

    grade.uniforms.uSeed.value = frame;
    composer.render();
  };

  const dispose = () => {
    composer.dispose();
    dof.dispose();
    bloom.dispose();
    plateGeo.dispose();
    finMat.dispose();
    glassMats.forEach((m) => m.dispose());
    glassMeshes.forEach((m) => m.geometry.dispose());
    glyphs.forEach((g) => g.dispose());
    envTex.dispose();
    pmrem.dispose();
    renderer.dispose();
  };

  return { render, dispose };
};
