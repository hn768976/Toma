import { ThreeCanvas } from "@remotion/three";
import { useCallback, useEffect, useState } from "react";
import { useDelayRender } from "remotion";
import * as THREE from "three";

export type Backend = "webgpu" | "webgl2" | "webgl";

/**
 * Minimal shape of the bits of the WebGPU API used for detection. Declared
 * locally because the project's DOM typings predate navigator.gpu, and pulling
 * in @webgpu/types would only be for these two lines.
 */
type NavigatorGpu = {
  requestAdapter: (options?: { powerPreference?: "low-power" | "high-performance" }) => Promise<unknown>;
};
export type BackendPreference = Backend | "auto";

type CanvasComponent = React.ComponentType<{
  width: number;
  height: number;
  style?: React.CSSProperties;
  camera?: Record<string, unknown>;
  gl?: unknown;
  onCreated?: (state: unknown) => void;
  linear?: boolean;
  flat?: boolean;
  dpr?: number;
  children: React.ReactNode;
}>;

/**
 * Renders a textured quad through a throwaway WebGPU renderer.
 *
 * `requestAdapter()` succeeding is not the same as WebGPU working: this
 * project's own render container hands back a software adapter whose
 * `createView` then rejects the texture descriptors three.js r186 emits, and
 * that failure surfaces deep inside the first real frame. Rather than discover
 * that halfway through a render, the exact operation that breaks — binding a
 * texture — is exercised up front on an 8×8 canvas, and any throw simply
 * elects WebGL2 instead.
 */
const webGpuActuallyWorks = async (): Promise<boolean> => {
  type WebGPURendererInstance = InstanceType<typeof import("three/webgpu").WebGPURenderer>;
  let renderer: WebGPURendererInstance | null = null;
  try {
    const { WebGPURenderer } = await import("three/webgpu");
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;

    renderer = new WebGPURenderer({ canvas, antialias: false });
    await renderer.init();

    const probeCanvas = document.createElement("canvas");
    probeCanvas.width = 2;
    probeCanvas.height = 2;
    const ctx = probeCanvas.getContext("2d") as CanvasRenderingContext2D;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 2, 2);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    camera.position.z = 2;
    const material = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(probeCanvas),
      transparent: true,
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material));

    await renderer.renderAsync(scene, camera);
    return true;
  } catch {
    return false;
  } finally {
    try {
      renderer?.dispose();
    } catch {
      // A renderer that failed to initialise may also fail to dispose.
    }
  }
};

/**
 * Picks the best available backend.
 *
 * WebGPU is preferred where it demonstrably works — `navigator.gpu` being
 * defined is not enough, since Chrome exposes the namespace on machines where
 * `requestAdapter()` then resolves to null, and resolves an adapter on machines
 * where rendering then fails outright.
 */
export const detectBackend = async (preference: BackendPreference): Promise<Backend> => {
  if (preference !== "auto") {
    return preference;
  }

  const gpu = (navigator as Navigator & { gpu?: NavigatorGpu }).gpu;
  if (gpu) {
    try {
      const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
      if (adapter && (await webGpuActuallyWorks())) {
        return "webgpu";
      }
    } catch {
      // Fall through to WebGL — a throwing requestAdapter is just a "no".
    }
  }

  const probe = document.createElement("canvas");
  if (probe.getContext("webgl2")) {
    return "webgl2";
  }
  if (probe.getContext("webgl") ?? probe.getContext("experimental-webgl")) {
    return "webgl";
  }
  throw new Error("No WebGPU or WebGL support available in this browser");
};

const glFactory = (props: THREE.WebGLRendererParameters) => {
  const renderer = new THREE.WebGLRenderer({
    ...props,
    antialias: true,
    powerPreference: "high-performance",
    // Remotion screenshots the canvas after the draw call returns, so the
    // buffer has to survive past the end of the frame.
    preserveDrawingBuffer: true,
  });
  return renderer;
};

/**
 * A three.js canvas that renders through WebGPU when the host can, and falls
 * back to WebGL2 when it can't.
 *
 * Note on the third tier: three.js removed its WebGL1 renderer in r163, so on a
 * WebGL1-only host there is no renderer left to construct. Rather than pretend
 * otherwise, that case is detected and reported with an actionable message —
 * pin three to r162 or run somewhere with WebGL2. Every browser that can run a
 * Remotion render today has WebGL2.
 */
export const AdaptiveThreeCanvas: React.FC<{
  width: number;
  height: number;
  preference?: BackendPreference;
  style?: React.CSSProperties;
  camera?: Record<string, unknown>;
  onBackend?: (backend: Backend) => void;
  children: React.ReactNode;
}> = ({ width, height, preference = "auto", style, camera, onBackend, children }) => {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Initialising 3D backend"));
  const [resolved, setResolved] = useState<{ backend: Backend; Canvas: CanvasComponent } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const backend = await detectBackend(preference);

      if (backend === "webgl") {
        throw new Error(
          "This host only exposes WebGL1. three.js r163+ ships no WebGL1 renderer, " +
            "so there is nothing to fall back to: pin three to 0.162.x or render on a WebGL2/WebGPU host.",
        );
      }

      // Loaded on demand: three/webgpu pulls in the whole node material system,
      // which WebGL renders never touch.
      const Canvas: CanvasComponent =
        backend === "webgpu"
          ? ((await import("@remotion/three/webgpu")).ThreeWebGPUCanvas as CanvasComponent)
          : (ThreeCanvas as unknown as CanvasComponent);

      if (!cancelled) {
        setResolved({ backend, Canvas });
        onBackend?.(backend);
      }
    })().catch((error) => {
      if (!cancelled) {
        cancelRender(error as Error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [preference, cancelRender, onBackend]);

  // Held open from mount until the canvas reports itself created, so no frame
  // can be captured while the backend is still being negotiated.
  const onCreated = useCallback(
    (state: unknown) => {
      // Exposure is set here rather than in the WebGL factory because the
      // WebGPU canvas builds its own renderer: this is the one place both
      // backends pass through, which is what keeps them matching.
      const renderer = (state as { gl?: { toneMappingExposure?: number } }).gl;
      if (renderer) {
        renderer.toneMappingExposure = 1.05;
      }
      continueRender(handle);
    },
    [continueRender, handle],
  );

  if (!resolved) {
    return null;
  }

  const { backend, Canvas } = resolved;

  return (
    <Canvas
      width={width}
      height={height}
      style={style}
      camera={camera}
      onCreated={onCreated}
      // The WebGPU canvas builds its own renderer and rejects a gl factory.
      {...(backend === "webgpu" ? {} : { gl: glFactory })}
    >
      {children}
    </Canvas>
  );
};
