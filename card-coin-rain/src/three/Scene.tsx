import { DepthOfField, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";
import { DepthOfFieldEffect, ToneMappingMode } from "postprocessing";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import {
  BufferGeometry,
  Color,
  Euler,
  Group,
  HalfFloatType,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLProgramParametersWithUniforms,
} from "three";
import {
  CAM_DIST,
  CARD_CORNER,
  CARD_H,
  CARD_T,
  CARD_W,
  cameraPose,
  cardPose,
  CameraPose,
  CardPose,
  trackY,
  tumble,
  VFOV,
} from "../lib/loop";
import { Look } from "../lib/looks";
import { Falling, OBJECTS } from "../lib/objects";
import { preTonemapColor } from "../lib/tonemap";
import { Assets } from "./assets";
import { makeBarGeometry, makeCardBodyGeometry, makeCoinGeometry, makeFaceGeometry } from "./geometry";
import { GrainDitherEffect } from "./GrainDitherEffect";
import { CHIP_CENTER, CHIP_H, CHIP_R, CHIP_W } from "./textures";

/** Groups that can be switched off (loop-check bisection). */
export type Disable = Partial<Record<"coins" | "bars" | "card" | "camera" | "grain" | "dof", boolean>>;

// ----------------------------------------------------------- materials

/** Per-instance roughness for InstancedMesh (attribute instRough). */
const withInstanceRoughness = (m: MeshPhysicalMaterial) => {
  m.onBeforeCompile = (s: WebGLProgramParametersWithUniforms) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float instRough;\nvarying float vInstRough;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvInstRough = instRough;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vInstRough;")
      .replace(
        "#include <roughnessmap_fragment>",
        `float roughnessFactor = vInstRough;
#ifdef USE_ROUGHNESSMAP
  roughnessFactor *= texture2D( roughnessMap, vRoughnessMapUv ).g;
#endif`,
      );
  };
  m.customProgramCacheKey = () => "instRough";
  return m;
};

const BACKDROP_DIST = 600;

const backdropMaterial = (look: Look) =>
  new ShaderMaterial({
    uniforms: {
      cCenter: { value: preTonemapColor(look.backdrop.center, look.light.exposure) },
      cEdge: { value: preTonemapColor(look.backdrop.edge, look.light.exposure) },
      cCorner: { value: preTonemapColor(look.backdrop.corner, look.light.exposure) },
      aspect: { value: 16 / 9 },
      oversize: { value: 1.3 },
      hotspot: { value: new Vector2(-0.05, 0.06) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 cCenter; uniform vec3 cEdge; uniform vec3 cCorner;
      uniform float aspect; uniform float oversize; uniform vec2 hotspot;
      varying vec2 vUv;
      void main() {
        // Frame-normalised coords: (-1..1) across the visible frame.
        vec2 f = (vUv - 0.5) * 2.0 * oversize;
        vec2 p = (f - hotspot) * vec2(aspect, 1.0);
        float r = length(p * vec2(0.8, 1.0));
        vec3 col = mix(cCenter, cEdge, smoothstep(0.0, 1.35, r));
        float c = smoothstep(0.75, 1.75, length(f * vec2(1.0, 0.92)));
        col = mix(col, cCorner, c);
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthWrite: true,
  });

// --------------------------------------------------------------- card

const Card: React.FC<{ look: Look; assets: Assets; groupRef: React.RefObject<Group | null> }> = ({
  look,
  assets,
  groupRef,
}) => {
  const parts = useMemo(() => {
    const gold = look.card.front !== "roseSatin";
    const plain = look.card.front === "goldPlain";
    const body = makeCardBodyGeometry(CARD_W, CARD_H, CARD_CORNER, CARD_T);
    const face = makeFaceGeometry(CARD_W, CARD_H, CARD_CORNER);
    const chipFace = makeFaceGeometry(CHIP_W, CHIP_H, CHIP_R, 12);
    const front = plain
      ? new MeshPhysicalMaterial({
          color: "#E8B84A",
          metalness: 1,
          roughness: 0.26,
          normalMap: assets.cardFront.normal,
          normalScale: new Vector2(1, 1),
          roughnessMap: assets.cardFront.roughness,
        })
      : gold
      ? new MeshPhysicalMaterial({
          color: "#E8B84A",
          metalness: 1,
          roughness: 0.36,
          normalMap: assets.cardFront.normal,
          normalScale: new Vector2(0.9, 0.9),
          roughnessMap: assets.cardFront.roughness,
        })
      : new MeshPhysicalMaterial({
          color: "#F7CCB0",
          metalness: 0.6,
          roughness: 0.45,
          normalMap: assets.cardFront.normal,
          normalScale: new Vector2(0.2, 0.2),
          roughnessMap: assets.cardFront.roughness,
          sheen: 0.25,
          sheenColor: new Color("#F6D3C2"),
          sheenRoughness: 0.6,
        });
    const back = gold
      ? new MeshPhysicalMaterial({
          color: "#EFD593",
          metalness: 1,
          roughness: 0.28,
          normalMap: plain ? null : assets.cardFront.normal,
          normalScale: new Vector2(0.25, 0.25),
        })
      : front.clone();
    const edge = new MeshPhysicalMaterial({
      color: gold ? "#E3B24A" : "#E6AE95",
      metalness: gold ? 1 : 0.7,
      roughness: 0.3,
    });
    const chip = new MeshPhysicalMaterial({
      color: "#ffffff",
      map: assets.chip.color,
      metalness: 1,
      roughness: 0.24,
      bumpMap: assets.chip.bump,
      bumpScale: 1.6,
    });
    const print = assets.print
      ? new MeshStandardMaterial({
          map: assets.print,
          transparent: true,
          metalness: 0.15,
          roughness: 0.55,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        })
      : null;
    return { body, face, chipFace, front, back, edge, chip, print };
  }, [look, assets]);

  const zf = CARD_T / 2 + 0.0006;
  return (
    <group ref={groupRef}>
      <mesh geometry={parts.body} material={parts.edge} />
      <mesh geometry={parts.face} material={parts.front} position={[0, 0, zf]} />
      <mesh geometry={parts.face} material={parts.back} position={[0, 0, -zf]} rotation={[0, Math.PI, 0]} />
      <mesh geometry={parts.chipFace} material={parts.chip} position={[CHIP_CENTER.x, CHIP_CENTER.y, zf + 0.004]} />
      {parts.print ? (
        <mesh geometry={parts.face} material={parts.print} position={[0, 0, zf + 0.0012]} renderOrder={2} />
      ) : null}
    </group>
  );
};

// ------------------------------------------------------ falling objects

const useInstanced = (
  items: Falling[],
  geometry: BufferGeometry,
  material: MeshPhysicalMaterial,
  roughnessOffset = 0,
) =>
  useMemo(() => {
    const mesh = new InstancedMesh(geometry, material, Math.max(1, items.length));
    mesh.count = items.length;
    mesh.frustumCulled = false;
    const rough = new Float32Array(Math.max(1, items.length));
    items.forEach((it, i) => {
      mesh.setColorAt(i, it.color);
      rough[i] = it.roughness + roughnessOffset;
    });
    geometry.setAttribute("instRough", new InstancedBufferAttribute(rough, 1));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }, [items, geometry, material, roughnessOffset]);

const _e = new Euler();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _m = new Matrix4();

const placeInstances = (mesh: InstancedMesh, items: Falling[], frame: number, hidden: boolean) => {
  items.forEach((it, i) => {
    if (hidden) {
      _m.makeScale(0, 0, 0);
    } else {
      _p.set(it.x, trackY(it.yTop, it.length, it.y0, it.k, frame), it.z);
      _q.setFromEuler(tumble(it.turns, it.phases, frame, _e));
      _s.setScalar(it.scale);
      _m.compose(_p, _q, _s);
    }
    mesh.setMatrixAt(i, _m);
  });
  mesh.instanceMatrix.needsUpdate = true;
};

// ------------------------------------------------------------- DoF rig

const COC_ORIGINAL =
  "float signedDistance=distance-focusDistance;float magnitude=smoothstep(0.0,focusRange,abs(signedDistance));gl_FragColor.rg=magnitude*vec2(step(signedDistance,0.0),step(0.0,signedDistance));";
const COC_LENS =
  "float rel=(distance-focusDistance)/max(distance,1e-3);float nearC=clamp((-rel-0.04)*nearGain,0.0,1.0);float farC=min(clamp((rel-0.04)*farGain,0.0,1.0),farMax);gl_FragColor.rg=vec2(nearC,farC);";

/**
 * postprocessing's second bokeh pass ("fill") takes the MAX of 16 taps, which
 * dilates highlights and washes near-lens objects out to pale blobs. For the
 * near field, make it a plain average: two stacked disc blurs = soft discs.
 */
const patchNearFill = (m: ShaderMaterial) => {
  const src = m.fragmentShader;
  const next = src
    .split("maxValue=max(texture2D(inputBuffer,uv),maxValue);")
    .join("maxValue+=texture2D(inputBuffer,uv);")
    .replace("gl_FragColor=maxValue;", "gl_FragColor=maxValue/17.0;");
  if (next === src || next.includes("max(texture2D")) {
    throw new Error("postprocessing bokeh shader changed; update patchNearFill");
  }
  m.fragmentShader = next;
};

/**
 * Far field, both passes: scatter-as-gather. A tap only counts if that
 * sample's own blur radius reaches this pixel, so a sharp coin is never
 * smeared into the blurred background around it (no dark outline / halo).
 */
const FAR_BOKEH = /* glsl */ `
#ifdef FRAMEBUFFER_PRECISION_HIGH
uniform mediump sampler2D inputBuffer;
#else
uniform lowp sampler2D inputBuffer;
#endif
#if PASS == 1
uniform vec4 kernel64[32];
#define TAPS 32
#define KERNEL kernel64
#else
uniform vec4 kernel16[8];
#define TAPS 8
#define KERNEL kernel16
#endif
uniform lowp sampler2D cocBuffer;
uniform vec2 texelSize;
uniform float scale;
varying vec2 vUv;
float reach(const in vec2 uv, const in float d) {
  return clamp(texture2D(cocBuffer, uv).g * scale - d + 1.0, 0.0, 1.0);
}
void main() {
  float coc = texture2D(cocBuffer, vUv).g * scale;
  vec4 c0 = texture2D(inputBuffer, vUv);
  if (coc < 0.5) { gl_FragColor = c0; return; }
  vec4 acc = c0;
  float wsum = 1.0;
  for (int i = 0; i < TAPS; ++i) {
    vec4 k = KERNEL[i];
    vec2 o1 = k.xy * coc;
    vec2 uv1 = vUv + o1 * texelSize;
    float w1 = reach(uv1, length(o1));
    acc += texture2D(inputBuffer, uv1) * w1;
    wsum += w1;
    vec2 o2 = k.zw * coc;
    vec2 uv2 = vUv + o2 * texelSize;
    float w2 = reach(uv2, length(o2));
    acc += texture2D(inputBuffer, uv2) * w2;
    wsum += w2;
  }
  gl_FragColor = acc / wsum;
}`;

const patchBokeh = (effect: DepthOfFieldEffect) => {
  const fx = effect as unknown as Record<string, { fullscreenMaterial: ShaderMaterial }>;
  const nearFill = fx.bokehNearFillPass.fullscreenMaterial;
  if (nearFill.userData.patched) return;
  patchNearFill(nearFill);
  for (const key of ["bokehFarBasePass", "bokehFarFillPass"]) {
    const m = fx[key].fullscreenMaterial;
    if (m.defines.FOREGROUND !== undefined) throw new Error("unexpected foreground far pass");
    m.fragmentShader = FAR_BOKEH;
    m.needsUpdate = true;
  }
  nearFill.needsUpdate = true;
  nearFill.userData.patched = true;
};

/**
 * Swap the CoC curve of postprocessing's DepthOfFieldEffect for a thin-lens
 * style |d - f| / d one with separate near / far gains: near-lens coins blur
 * hard, far ones stay recognisable. Same formula as lib/objects.ts.
 */
const patchCoC = (effect: DepthOfFieldEffect, look: Look) => {
  const m = effect.cocMaterial;
  if (m.userData.lensCoC) return;
  if (!m.fragmentShader.includes(COC_ORIGINAL)) {
    throw new Error("postprocessing CoC shader changed; update COC_ORIGINAL");
  }
  m.fragmentShader = m.fragmentShader
    .replace("uniform float focusRange;", "uniform float focusRange;uniform float nearGain;uniform float farGain;uniform float farMax;")
    .replace(COC_ORIGINAL, COC_LENS);
  m.uniforms.nearGain = { value: look.dof.nearGain };
  m.uniforms.farGain = { value: look.dof.farGain };
  m.uniforms.farMax = { value: look.dof.farMax };
  m.needsUpdate = true;
  m.userData.lensCoC = true;
};

// --------------------------------------------------------------- scene

const applyCamera = (camera: PerspectiveCamera, pose: CameraPose) => {
  camera.position.copy(pose.position);
  camera.up.set(0, 1, 0);
  camera.lookAt(pose.target);
  camera.updateMatrixWorld(true);
};

const applyCard = (g: Group, pose: CardPose) => {
  g.position.copy(pose.position);
  g.quaternion.copy(pose.quaternion);
  g.updateMatrixWorld(true);
};

export const Scene: React.FC<{ look: Look; assets: Assets; disable: Disable }> = ({ look, assets, disable }) => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);

  const objects = OBJECTS[look.id];
  const coins = useMemo(() => objects.filter((o) => o.kind === "coin"), [objects]);
  const bars = useMemo(() => objects.filter((o) => o.kind === "bar"), [objects]);

  const coinGeom = useMemo(() => makeCoinGeometry(), []);
  const barGeom = useMemo(() => makeBarGeometry(), []);
  const coinMat = useMemo(
    () =>
      withInstanceRoughness(
        new MeshPhysicalMaterial({
          color: "#ffffff",
          metalness: 1,
          roughness: 0.3,
          normalMap: assets.coin.normal,
          normalScale: new Vector2(1, 1),
          roughnessMap: assets.coin.roughness,
        }),
      ),
    [assets],
  );
  const barMat = useMemo(
    () =>
      withInstanceRoughness(
        new MeshPhysicalMaterial({
          color: "#ffffff",
          metalness: 1,
          roughness: 0.35,
          normalMap: assets.bar?.normal ?? null,
          normalScale: new Vector2(0.9, 0.9),
          roughnessMap: assets.bar?.roughness ?? null,
        }),
      ),
    [assets],
  );
  const coinMesh = useInstanced(coins, coinGeom, coinMat);
  // Ingots have big flat faces: rougher than coins so a mirrored softbox
  // rolls off instead of filling a face with flat white.
  const barMesh = useInstanced(bars, barGeom, barMat, 0.16);

  const backdrop = useMemo(() => {
    const m = new Mesh(new PlaneGeometry(1, 1), backdropMaterial(look));
    m.frustumCulled = false;
    m.renderOrder = -1;
    return m;
  }, [look]);

  const grain = useMemo(() => new GrainDitherEffect(look.grain), [look]);
  const cardRef = useRef<Group>(null);
  const dofRef = useRef<DepthOfFieldEffect>(null);

  // One-time scene setup.
  useLayoutEffect(() => {
    scene.environment = assets.hdri;
    scene.environmentIntensity = look.light.env;
    scene.environmentRotation.set(0, 1.02, 0);
    scene.background = null;
    camera.near = 2;
    camera.far = 1200;
    camera.fov = (VFOV * 180) / Math.PI;
    camera.updateProjectionMatrix();
  }, [scene, assets, look, camera]);

  // Everything per-frame is computed here, from `frame` only. Layout effect:
  // runs before @remotion/three's frame renderer advances R3F.
  useLayoutEffect(() => {
    const camFrame = disable.camera ? 0 : frame;
    const pose = cameraPose(camFrame);
    applyCamera(camera, pose);

    if (cardRef.current) applyCard(cardRef.current, cardPose(disable.card ? 0 : frame));

    placeInstances(coinMesh, coins, frame, !!disable.coins);
    placeInstances(barMesh, bars, frame, !!disable.bars);

    // Backdrop rides with the camera, far behind everything.
    const fwd = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    backdrop.position.copy(camera.position).addScaledVector(fwd, BACKDROP_DIST);
    backdrop.quaternion.copy(camera.quaternion);
    const h = 2 * BACKDROP_DIST * Math.tan(VFOV / 2) * 1.3;
    backdrop.scale.set(h * (16 / 9), h, 1);
    backdrop.updateMatrixWorld(true);

    const dof = dofRef.current;
    if (dof) {
      patchCoC(dof, look);
      patchBokeh(dof);
      const card = cardPose(disable.card ? 0 : frame);
      dof.cocMaterial.focusDistance = camera.position.distanceTo(card.position);
      const bufH = gl.getDrawingBufferSize(new Vector2()).y;
      const res = bufH / 1080;
      dof.bokehScale = disable.dof ? 0 : look.dof.bokehPx1080 * res;
      dof.blurPass.scale = res;
    }
    grain.frameIndex = frame % 600;
    grain.uniforms.get("amount")!.value = disable.grain ? 0 : look.grain;
  }, [frame, camera, coinMesh, barMesh, coins, bars, backdrop, look, grain, gl, disable]);

  const k = look.light;
  return (
    <>
      <primitive object={backdrop} />
      <Card look={look} assets={assets} groupRef={cardRef} />
      <primitive object={coinMesh} />
      {bars.length ? <primitive object={barMesh} /> : null}

      {/* Soft key, upper left */}
      <rectAreaLight position={[-40, 44, 52]} width={k.keySize} height={k.keySize} intensity={k.key} onUpdate={(l) => l.lookAt(0, 0, 0)} />
      {/* Soft fill, right and a little low */}
      <rectAreaLight position={[52, -6, 44]} width={26} height={18} intensity={k.fill} onUpdate={(l) => l.lookAt(0, 0, 0)} />
      {/* Big soft panel behind/above the camera: what the card mirrors as it tilts */}
      <rectAreaLight position={[-6, 30, 95]} width={70} height={36} intensity={k.front} onUpdate={(l) => l.lookAt(0, 0, 0)} />
      {/* Faint rim from behind */}
      <rectAreaLight position={[10, 30, -52]} width={40} height={10} intensity={k.rim} onUpdate={(l) => l.lookAt(0, 0, 0)} />

      <EffectComposer multisampling={4} frameBufferType={HalfFloatType} enableNormalPass={false}>
        <DepthOfField ref={dofRef} focusDistance={CAM_DIST} focusRange={10} bokehScale={1} resolutionScale={1} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <primitive object={grain} />
      </EffectComposer>
    </>
  );
};
