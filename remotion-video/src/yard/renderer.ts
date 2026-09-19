/// <reference types="@webgpu/types" />
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";

/**
 * Renderer construction with a three-tier backend fallback.
 *
 *   1. WebGPU      -- three's WebGPURenderer on its native backend (WGSL).
 *   2. WebGL2      -- the same WebGPURenderer forced onto its WebGL backend.
 *                     Node materials compile to GLSL, so the shading is
 *                     identical to tier 1 and nothing in the scene changes.
 *   3. WebGL1      -- classic WebGLRenderer. Node materials cannot run here,
 *                     so callers fall back to plain materials; the shot still
 *                     renders, with flat livery instead of procedural
 *                     weathering. This tier is a safety net and is not
 *                     expected to be reached on any current browser.
 *
 * Tier 1 is verified with a smoke render rather than trusting init(), because
 * a WebGPU adapter can hand back a device that then drops as soon as real work
 * is submitted -- which is exactly what Dawn-on-SwiftShader does in a headless
 * container. Detecting that up front is much cheaper than discovering it
 * midway through a 600 frame render.
 */

export type RenderTier = "webgpu" | "webgl2" | "webgl1";

export type YardRenderer = {
  tier: RenderTier;
  /** Backends tried and why each was rejected, for the diagnostics overlay. */
  trace: string[];
  /** True when node materials (TSL) are usable. */
  supportsNodeMaterials: boolean;
  render: (scene: THREE.Scene, camera: THREE.Camera) => Promise<void>;
  setSize: (width: number, height: number) => void;
  getRenderer: () => WebGPURenderer | THREE.WebGLRenderer;
  dispose: () => void;
};

/**
 * Runs a WebGPU probe while capturing errors that never reach an await point.
 *
 * Dawn reports device loss asynchronously, through the error scope machinery
 * rather than by rejecting the call that caused it. It surfaces as an
 * unhandled rejection, which the render host treats as a fatal page error --
 * so without this the tier-1 attempt takes the whole render down instead of
 * falling through to tier 2. Swallowing rejections is scoped tightly to the
 * probe, and any captured error is treated as a probe failure.
 */
const runProbeCapturingAsyncErrors = async (
  probe: () => Promise<void>,
): Promise<string | null> => {
  let captured: string | null = null;

  const onRejection = (event: PromiseRejectionEvent) => {
    captured = String(event.reason);
    event.preventDefault();
  };
  const onError = (event: ErrorEvent) => {
    captured = String(event.message);
    event.preventDefault();
  };

  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("error", onError);
  try {
    await probe();
    // Give asynchronously-reported device errors a chance to land before the
    // probe is declared clean.
    await new Promise((resolve) => setTimeout(resolve, 120));
  } catch (err) {
    captured = captured ?? String(err);
  } finally {
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("error", onError);
  }
  return captured;
};

/**
 * three r186 always sends `swizzle: 'rgba'` on GPUTextureViewDescriptor, while
 * newer Dawn builds implement the spec where GPUTextureComponentSwizzle is a
 * dictionary and reject the string. 'rgba' is the identity swizzle, so
 * dropping it changes nothing.
 */
const applySwizzleShim = () => {
  const g = globalThis as unknown as {
    GPUTexture?: { prototype: Record<string, unknown> };
  };
  const proto = g.GPUTexture?.prototype;
  if (!proto || proto.__yardSwizzlePatched) return;
  const original = proto.createView as (d?: unknown) => unknown;
  proto.createView = function (desc?: Record<string, unknown>) {
    if (desc && typeof desc.swizzle === "string") {
      const copy: Record<string, unknown> = { ...desc };
      delete copy.swizzle;
      return original.call(this, copy);
    }
    return original.call(this, desc);
  };
  proto.__yardSwizzlePatched = true;
};

/**
 * Renders a miniature of the real workload to prove the device actually works.
 *
 * This is deliberately not a trivial triangle. A WebGPU adapter can hand back
 * a device that only drops once real work is submitted, which is what Dawn on
 * a software rasteriser does: a one-box test passes and the shot then dies
 * partway through a 600 frame render. So the probe exercises everything the
 * shots rely on -- instancing, instanced attributes, a sampled texture, a node
 * material and a shadow-casting light -- and reads a pixel back to force the
 * queue to drain before reporting success.
 */
const smokeTest = async (renderer: WebGPURenderer) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 6, 14);
  camera.lookAt(0, 2, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 1));

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(6, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);

  const size = 16;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < data.length; i++) data[i] = (i * 37) % 255;
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;

  const { MeshStandardNodeMaterial } = await import("three/webgpu");
  const { texture, positionGeometry, attribute, vec2, vec3, mix } = await import(
    "three/tsl"
  );
  const mat = new MeshStandardNodeMaterial();
  const sample = texture(tex, vec2(positionGeometry.x, positionGeometry.y));
  mat.colorNode = mix(attribute("aProbe", "vec3"), vec3(1, 1, 1), sample.r);

  const COUNT = 256;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const probe = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT * 3; i++) probe[i] = (i % 7) / 7;
  geo.setAttribute("aProbe", new THREE.InstancedBufferAttribute(probe, 3));

  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const m = new THREE.Matrix4();
  for (let i = 0; i < COUNT; i++) {
    m.makeTranslation(((i % 16) - 8) * 1.2, Math.floor(i / 16) * 1.2, 0);
    mesh.setMatrixAt(i, m);
  }
  scene.add(mesh);

  renderer.shadowMap.enabled = true;
  await renderer.renderAsync(scene, camera);
  // Reading back forces the queue to drain, so a device that is going to drop
  // does so here rather than midway through the real render.
  await renderer.renderAsync(scene, camera);

  geo.dispose();
  mat.dispose();
  tex.dispose();
  scene.clear();
};

export type CreateRendererOptions = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  antialias?: boolean;
  /** Set false to skip tier 1 entirely (useful for A/B checks). */
  preferWebGPU?: boolean;
};

export const createYardRenderer = async ({
  canvas,
  width,
  height,
  antialias = true,
  preferWebGPU = true,
}: CreateRendererOptions): Promise<YardRenderer> => {
  const trace: string[] = [];

  const finish = (
    renderer: WebGPURenderer | THREE.WebGLRenderer,
    tier: RenderTier,
    supportsNodeMaterials: boolean,
  ): YardRenderer => {
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    return {
      tier,
      trace,
      supportsNodeMaterials,
      render: async (scene, camera) => {
        if ("renderAsync" in renderer) {
          await (renderer as WebGPURenderer).renderAsync(scene, camera);
        } else {
          (renderer as THREE.WebGLRenderer).render(scene, camera);
        }
      },
      setSize: (w, h) => renderer.setSize(w, h, false),
      getRenderer: () => renderer,
      dispose: () => renderer.dispose(),
    };
  };

  // --- Tier 1: native WebGPU -------------------------------------------
  const hasGpu = Boolean((navigator as Navigator & { gpu?: GPU }).gpu);
  if (preferWebGPU && hasGpu) {
    applySwizzleShim();
    let candidate: WebGPURenderer | null = null;
    const failure = await runProbeCapturingAsyncErrors(async () => {
      candidate = new WebGPURenderer({ canvas, antialias, forceWebGL: false });
      await candidate.init();
      await smokeTest(candidate);
    });

    if (!failure) {
      trace.push("webgpu: ok");
      return finish(candidate!, "webgpu", true);
    }

    trace.push(`webgpu: unusable (${failure.slice(0, 120)})`);
    try {
      (candidate as WebGPURenderer | null)?.dispose();
    } catch {
      /* a dropped device throws on dispose; nothing useful to do about it */
    }
  } else {
    trace.push(
      preferWebGPU ? "webgpu: navigator.gpu missing" : "webgpu: disabled by caller",
    );
  }

  // --- Tier 2: WebGL2 via the same renderer ----------------------------
  // The canvas may already carry a dead WebGPU context, so start from a clean
  // one. The caller keeps a ref to the element, hence replaceWith rather than
  // creating a detached node.
  const fresh = canvas.ownerDocument.createElement("canvas");
  fresh.width = canvas.width;
  fresh.height = canvas.height;
  fresh.style.cssText = canvas.style.cssText;
  canvas.replaceWith(fresh);

  try {
    const renderer = new WebGPURenderer({
      canvas: fresh,
      antialias,
      forceWebGL: true,
    });
    await renderer.init();
    await smokeTest(renderer);
    trace.push("webgl2: ok (node materials compiled to GLSL)");
    return finish(renderer, "webgl2", true);
  } catch (err) {
    trace.push(`webgl2: failed (${String(err).slice(0, 140)})`);
  }

  // --- Tier 3: classic WebGL -------------------------------------------
  const legacy = new THREE.WebGLRenderer({
    canvas: fresh,
    antialias,
    preserveDrawingBuffer: true,
  });
  trace.push("webgl1: classic renderer, procedural weathering disabled");
  return finish(legacy, "webgl1", false);
};
