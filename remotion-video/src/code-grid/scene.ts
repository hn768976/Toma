// The three.js / WebGPU scene: an endless field of code-etched blocks the
// camera flies over, with depth of field, bloom and fog.
//
// Two things about this module are driven by Remotion rather than by
// three.js, and both are load-bearing:
//
//  * Nothing animates itself. `update(frame)` sets the whole scene from a
//    frame number and nothing else, so frames can be rendered in any order
//    and in parallel across browser tabs, which is how Remotion works.
//
//  * The frame is rendered into an offscreen RenderTarget, read back and
//    blitted onto a 2D canvas, instead of being presented on a WebGPU
//    canvas. Headless Chrome on a GPU-less machine cannot allocate a
//    WebGPU swap chain ("Unable to create shared image"), and the readback
//    path also removes any question of whether the canvas has been
//    presented at the moment Remotion screenshots the page.

import * as THREE from "three/webgpu";
import {
  abs,
  attribute,
  float,
  max,
  min,
  mix,
  normalGeometry,
  normalView,
  positionGeometry,
  positionView,
  positionViewDirection,
  positionWorld,
  smoothstep,
  texture,
  uniform,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { gaussianBlur } from "three/addons/tsl/display/GaussianBlurNode.js";

import {
  BLOOM_RADIUS,
  BLOOM_STRENGTH,
  BLOOM_THRESHOLD,
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_NEAR,
  CODE_SHEET_SIZE,
  DOF_BLUR_RESOLUTION,
  DOF_BLUR_SIGMA_FAR,
  DOF_BLUR_SIGMA_NEAR,
  DOF_FAR_RANGE,
  DOF_NEAR_RANGE,
  DURATION_IN_FRAMES,
  EMISSIVE_CEILING,
  FOG_DENSITY,
  LOOP_CELLS,
  RANDOM_SEED,
  RIPPLE_AMOUNT,
  RIPPLE_SPACE_CYCLES,
  RIPPLE_TIME_CYCLES,
} from "./constants";
import { cameraPose } from "./camera-path";
import { buildField } from "./field";
import { createCodeSheet } from "./code-sheet";
import { COLORWAYS, type ColorwayName } from "./colorways";

const TAU = Math.PI * 2;

export type SceneOptions = {
  width: number;
  height: number;
  /** 1 for the 1080p composition, 2 for the 4K one. */
  resolutionScale: number;
  colorway: ColorwayName;
  /** MSAA sample count on the scene pass. 0 disables it. */
  samples: number;
};

export type CodeGridScene = {
  update: (frame: number) => void;
  /** Renders the current frame and blits it onto the given 2D context. */
  renderTo: (ctx: CanvasRenderingContext2D) => Promise<void>;
  dispose: () => void;
  isWebGPU: boolean;
};

const linear = (rgb: [number, number, number]) =>
  new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.LinearSRGBColorSpace);

export const createScene = async (
  options: SceneOptions,
): Promise<CodeGridScene> => {
  const { width, height, resolutionScale, samples } = options;
  const palette = COLORWAYS[options.colorway];

  // --- Renderer ----------------------------------------------------------

  const renderer = new THREE.WebGPURenderer({ antialias: false });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Hue-preserving highlight rolloff. The glyph cores are pushed well past
  // 1 so that they burn out to white the way the reference's do, and ACES
  // would swing those blues towards cyan on the way.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;

  await renderer.init();

  // Declared linear: the sRGB encode is baked into the post chain's output
  // node, so a second transform here would wash the blacks out.
  const outputTarget = new THREE.RenderTarget(width, height, {
    depthBuffer: false,
    colorSpace: THREE.LinearSRGBColorSpace,
  });
  renderer.setOutputRenderTarget(outputTarget);

  // --- Code texture ------------------------------------------------------

  const sheetSize = CODE_SHEET_SIZE * resolutionScale;
  const sheet = createCodeSheet(sheetSize, resolutionScale, RANDOM_SEED ^ 0x21);

  const codeTexture = new THREE.CanvasTexture(sheet.canvas);
  codeTexture.wrapS = THREE.RepeatWrapping;
  codeTexture.wrapT = THREE.RepeatWrapping;
  codeTexture.minFilter = THREE.LinearMipmapLinearFilter;
  codeTexture.magFilter = THREE.LinearFilter;
  codeTexture.generateMipmaps = true;
  // Without anisotropy the code on the receding top faces aliases into
  // moire long before the fog has a chance to hide it.
  codeTexture.anisotropy = 8;
  codeTexture.colorSpace = THREE.NoColorSpace;
  codeTexture.needsUpdate = true;

  // --- Field geometry ----------------------------------------------------

  const blocks = buildField(RANDOM_SEED);
  const count = blocks.length;

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  // Origin at the base, not the centre. This is what makes the height
  // animation grow the block up out of the floor instead of expanding it
  // about its middle, which would push it through the floor.
  geometry.translate(0, 0.5, 0);

  const sizes = new Float32Array(count * 3);
  const uvOffsets = new Float32Array(count * 2);
  const params = new Float32Array(count * 4);

  const material = new THREE.MeshBasicNodeMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  blocks.forEach((block, i) => {
    position.set(block.x, 0, block.z);
    scale.set(block.sx, block.sy, block.sz);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);

    sizes[i * 3 + 0] = block.sx;
    sizes[i * 3 + 1] = block.sy;
    sizes[i * 3 + 2] = block.sz;
    uvOffsets[i * 2 + 0] = block.uvOffsetX;
    uvOffsets[i * 2 + 1] = block.uvOffsetY;
    params[i * 4 + 0] = block.brightness;
    params[i * 4 + 1] = block.pulsePhase;
    params[i * 4 + 2] = block.heightRatio;
    params[i * 4 + 3] = block.heightCycles;
  });
  mesh.instanceMatrix.needsUpdate = true;

  geometry.setAttribute("aSize", new THREE.InstancedBufferAttribute(sizes, 3));
  geometry.setAttribute("aUv", new THREE.InstancedBufferAttribute(uvOffsets, 2));
  geometry.setAttribute("aParams", new THREE.InstancedBufferAttribute(params, 4));

  // --- Material ----------------------------------------------------------

  const uLoop = uniform(0); // position in the loop, in turns

  const aSize = attribute<"vec3">("aSize", "vec3");
  const aUv = attribute<"vec2">("aUv", "vec2");
  // x: emissive gain, y: phase, z: the height this block morphs to as a
  // multiple of its base height, w: whole height cycles per loop.
  const aParams = attribute<"vec4">("aParams", "vec4");

  // Blocks extrude up and retract down. This scales the block about its
  // base rather than translating it, so every base stays welded to y = 0:
  // nothing lifts off the floor and nothing sinks through it.
  const heightPhase = uLoop
    .mul(aParams.w)
    .add(aParams.y)
    .mul(TAU)
    .sin()
    .mul(0.5)
    .add(0.5);
  const grow = mix(float(1), aParams.z, heightPhase);

  const localPos = vec3(
    positionGeometry.x,
    positionGeometry.y.mul(grow),
    positionGeometry.z,
  );

  material.positionNode = localPos;

  const vLocal = varying(localPos, "vCodeGridLocal");
  const n = varying(normalGeometry, "vCodeGridNormal");

  // Offsets of this fragment from the block centre, in world units. Using
  // world units rather than the unit cube is what keeps the text the same
  // size and the edge highlight the same thickness on every block,
  // however tall or wide it is.
  const worldOffset = vLocal.mul(aSize);
  const absN = abs(n);

  // Box-planar mapping: each face reads the two axes it spans. The sign
  // flips keep the code reading left-to-right on whichever side faces the
  // camera instead of mirroring on half the blocks.
  // On the top face, "down the page" for the reader is +Z (towards the
  // camera) while the texture's V axis runs the other way, so V is
  // negated. U already runs with +X.
  const uvTop = vec2(worldOffset.x, worldOffset.z.negate());
  const uvSideX = vec2(worldOffset.z.mul(n.x.negate()), worldOffset.y);
  const uvSideZ = vec2(worldOffset.x.mul(n.z), worldOffset.y);
  const planarUv = mix(mix(uvSideZ, uvSideX, absN.x), uvTop, absN.y);

  const sheetUv = planarUv.mul(sheet.uvPerUnit).add(aUv);
  const glyph = texture(codeTexture, sheetUv).r;

  // Distance to the nearest edge of this face, in world units. The face's
  // own axis is pushed out of contention by adding a large number to it.
  const edgeDistances = vec3(
    float(0.5).sub(abs(vLocal.x)).mul(aSize.x),
    min(vLocal.y, grow.sub(vLocal.y)).mul(aSize.y),
    float(0.5).sub(abs(vLocal.z)).mul(aSize.z),
  ).add(absN.mul(100));
  const edgeDistance = min(
    min(edgeDistances.x, edgeDistances.y),
    edgeDistances.z,
  );

  const edgeCore = float(1).sub(smoothstep(0, 0.011, edgeDistance));
  const edgeHalo = float(1).sub(smoothstep(0, 0.085, edgeDistance));

  // Grazing-angle sheen, which reads as the glassy surface on the blocks.
  const fresnel = float(1)
    .sub(normalView.dot(positionViewDirection).clamp(0, 1))
    .pow(2.6);

  const topFacing = max(n.y, 0);

  // A brightness wave rolling down the field. Both its spatial and its
  // temporal frequency are whole numbers over the loop period, so it
  // survives the wrap along with everything else.
  const ripple = positionWorld.z
    .div(LOOP_CELLS)
    .mul(RIPPLE_SPACE_CYCLES)
    .sub(uLoop.mul(RIPPLE_TIME_CYCLES))
    .mul(TAU)
    .sin();
  const blockBrightness = aParams.x.mul(float(1).add(ripple.mul(RIPPLE_AMOUNT)));

  const faceColor = vec3(...palette.face)
    .mul(topFacing.mul(0.6).add(0.55))
    .mul(blockBrightness.mul(0.6).add(0.4));

  const glyphColor = vec3(...palette.glyph)
    .mul(glyph)
    .mul(palette.glyphGain)
    .mul(blockBrightness)
    .mul(topFacing.mul(0.22).add(0.88));

  const edgeColor = vec3(...palette.edge)
    .mul(edgeCore)
    .mul(blockBrightness.mul(0.8).add(0.35))
    .add(
      vec3(...palette.edgeHalo)
        .mul(edgeHalo)
        .mul(0.3)
        .mul(blockBrightness.add(0.2)),
    );

  const rimColor = vec3(...palette.rim)
    .mul(fresnel)
    .mul(0.16)
    .mul(blockBrightness.add(0.15));

  const lit = faceColor
    .add(glyphColor)
    .add(edgeColor)
    .add(rimColor)
    .min(vec3(EMISSIVE_CEILING, EMISSIVE_CEILING, EMISSIVE_CEILING));

  // Exponential fog, dissolving the field into the background well before
  // the far plane so the horizon is never a visible edge.
  const viewDistance = positionView.z.negate();
  const fogAmount = float(1).sub(viewDistance.mul(-FOG_DENSITY).exp());
  material.colorNode = mix(lit, vec3(...palette.background), fogAmount);

  // --- Scene and camera --------------------------------------------------

  const scene = new THREE.Scene();
  scene.background = linear(palette.background);
  scene.add(mesh);

  const camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    width / height,
    CAMERA_NEAR,
    CAMERA_FAR,
  );
  camera.rotation.order = "YXZ";

  // --- Post processing ---------------------------------------------------

  const pipeline = new THREE.PostProcessing(renderer);

  const scenePass = THREE.TSL.pass(scene, camera, { samples });
  const sceneColor = scenePass.getTextureNode();
  const viewZ = scenePass.getViewZNode();

  const uFocus = uniform(0);

  // Circle of confusion: how far this pixel is from the focal plane, with
  // a tighter ramp in front of it than behind, matching how a real lens at
  // this focal length falls off.
  const depth = viewZ.negate();
  const nearCoc = uFocus.sub(depth).max(0).div(DOF_NEAR_RANGE);
  const farCoc = depth.sub(uFocus).max(0).div(DOF_FAR_RANGE);
  const coc = nearCoc.add(farCoc).clamp(0, 1);

  // Two cascaded blurs rather than one wide bokeh kernel: it gives the
  // smooth, creamy falloff the reference has, and a separable gaussian at
  // half resolution is something a software rasteriser can actually
  // afford at 4K.
  const blurOptions = { resolutionScale: DOF_BLUR_RESOLUTION };
  const blurNear = gaussianBlur(
    sceneColor,
    null,
    DOF_BLUR_SIGMA_NEAR * resolutionScale,
    blurOptions,
  );
  const blurFar = gaussianBlur(
    blurNear,
    null,
    DOF_BLUR_SIGMA_FAR * resolutionScale,
    blurOptions,
  );

  const softened = mix(sceneColor, blurNear, smoothstep(0, 0.5, coc));
  const defocused = mix(softened, blurFar, smoothstep(0.45, 1, coc));

  pipeline.outputNode = defocused.add(
    bloom(defocused, BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD),
  );

  // --- Frame driving -----------------------------------------------------

  const update = (frame: number) => {
    // Divide by the duration, not duration - 1: frame 450 would be frame 0
    // of the next loop, so the last rendered frame lands just short of the
    // start pose and the clip joins cleanly to itself.
    const progress = frame / DURATION_IN_FRAMES;
    const pose = cameraPose(progress);

    camera.position.set(pose.x, pose.y, pose.z);
    camera.rotation.set(pose.pitch, pose.yaw, pose.roll);
    camera.updateMatrixWorld(true);

    uLoop.value = progress;
    uFocus.value = pose.focusDistance;
  };

  const rowBytes = width * 4;
  const frameBytes = new Uint8ClampedArray(rowBytes * height);
  const imageData = new ImageData(frameBytes, width, height);

  const renderTo = async (ctx: CanvasRenderingContext2D) => {
    await pipeline.renderAsync();

    const pixels = (await renderer.readRenderTargetPixelsAsync(
      outputTarget,
      0,
      0,
      width,
      height,
    )) as Uint8Array;

    frameBytes.set(pixels.subarray(0, rowBytes * height));
    ctx.putImageData(imageData, 0, 0);
  };

  return {
    update,
    renderTo,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      codeTexture.dispose();
      outputTarget.dispose();
      renderer.dispose();
    },
    isWebGPU: Boolean(
      (renderer.backend as unknown as { isWebGPUBackend?: boolean })
        .isWebGPUBackend,
    ),
  };
};
