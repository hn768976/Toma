import { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender } from "remotion";

export const GpuProbe: React.FC = () => {
  const [handle] = useState(() => delayRender("gpu-probe"));
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const run = async () => {
      const out: string[] = [];
      out.push(`navigator.gpu: ${typeof navigator.gpu}`);
      try {
        const adapter = await navigator.gpu?.requestAdapter();
        out.push(`adapter: ${adapter ? "OK" : "null"}`);
        if (adapter) {
          const info = adapter.info as unknown as Record<string, string>;
          out.push(`vendor=${info?.vendor} arch=${info?.architecture}`);
          out.push(`desc=${info?.description ?? ""}`);
        }
      } catch (err) {
        out.push(`adapter error: ${(err as Error).message}`);
      }
      try {
        const THREE = await import("three/webgpu");
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const renderer = new THREE.WebGPURenderer({ canvas, antialias: false });
        await renderer.init();
        out.push(`three backend: ${(renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? "WebGPU" : "WebGL2"}`);
        renderer.dispose();
      } catch (err) {
        out.push(`three error: ${(err as Error).message}`);
      }
      const gl = document.createElement("canvas").getContext("webgl2");
      const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
      out.push(`webgl2: ${gl ? "yes" : "no"} ${dbg ? gl!.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ""}`);
      setLines(out);
      continueRender(handle);
    };
    run();
  }, [handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "white", padding: 40, fontFamily: "monospace", fontSize: 28 }}>
      {lines.map((l) => (
        <div key={l}>{l}</div>
      ))}
    </AbsoluteFill>
  );
};
