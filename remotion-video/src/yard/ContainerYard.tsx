import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  continueRender,
  delayRender,
  Img,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { loadContainerLods } from "./geometry";
import { createYardRenderer, type YardRenderer } from "./renderer";
import { buildShot, type BuiltShot } from "./scene";
import { SHOTS } from "./shots";
import { getStencilAtlas, stencilAtlasCanvas } from "./textures";

export const containerYardSchema = z.object({
  version: z.enum(["v1", "v2", "v3", "v4", "v5", "v6"]),
  /** Overlays backend, LOD split and triangle count. Off for deliverables. */
  diagnostics: z.boolean(),
  /**
   * Shadow map resolution. The 4K compositions raise this so shadow edges
   * hold up at the larger output size.
   */
  shadowMapSize: z.number(),
  /**
   * Whether to attempt the WebGPU backend before falling back to WebGL2.
   *
   * Shipped as false. This container exposes WebGPU through Dawn on top of
   * SwiftShader, and that stack hands back a device that drops as soon as a
   * real scene is submitted. Dawn reports the loss asynchronously, below the
   * level a page can trap, so the attempt takes the whole render down rather
   * than falling through. Turning it on where a real GPU is present gives
   * identical output: both backends compile the same TSL graph, one to WGSL
   * and one to GLSL, and nothing in the scene or materials changes.
   */
  preferWebGPU: z.boolean(),
});

export type ContainerYardProps = z.infer<typeof containerYardSchema>;

type Live = {
  renderer: YardRenderer;
  shot: BuiltShot;
  canvas: HTMLCanvasElement;
};

/**
 * Drives three.js directly from Remotion's frame clock.
 *
 * This deliberately does not use @remotion/three's ThreeCanvas. That component
 * advances react-three-fiber and immediately reports the frame as rendered,
 * which is correct for WebGLRenderer's synchronous draw but not for
 * WebGPURenderer, whose submission is asynchronous -- Remotion would screenshot
 * before the GPU had finished and the output would tear. Owning the loop lets
 * every frame await its own render before releasing the delayRender handle.
 */
export const ContainerYard: React.FC<ContainerYardProps> = ({
  version,
  diagnostics,
  shadowMapSize,
  preferWebGPU,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const hostRef = useRef<HTMLDivElement | null>(null);
  const liveRef = useRef<Live | null>(null);
  const [ready, setReady] = useState(false);
  const [info, setInfo] = useState<string[]>([]);
  const [atlas, setAtlas] = useState<string>("");
  const [setupHandle] = useState(() =>
    delayRender("Container yard: renderer and scene", {
      timeoutInMilliseconds: 600000,
    }),
  );

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    // The canvas is created imperatively rather than via JSX because the
    // renderer may swap the element when it falls back from WebGPU, and React
    // must not be tracking a node that gets replaced underneath it.
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.display = "block";
    host.appendChild(canvas);

    (async () => {
      const renderer = await createYardRenderer({
        canvas,
        width,
        height,
        antialias: true,
        preferWebGPU,
      });
      if (cancelled) {
        renderer.dispose();
        return;
      }

      const spec = SHOTS[version];
      const three = renderer.getRenderer();
      three.shadowMap.enabled = true;
      three.shadowMap.type = THREE.PCFSoftShadowMap;
      three.toneMappingExposure = spec.environment.exposure;

      const lods = await loadContainerLods();
      if (cancelled) {
        renderer.dispose();
        return;
      }

      const shot = buildShot(spec, lods, {
        aspect: width / height,
        tier: renderer.tier,
        shadowMapSize,
      });

      liveRef.current = {
        renderer,
        shot,
        canvas: three.domElement as HTMLCanvasElement,
      };
      setInfo([
        `tier ${renderer.tier}`,
        ...renderer.trace,
        `placed ${shot.stats.placed} -> drawn ${shot.stats.drawn}`,
        `lod split ${shot.stats.byLod.join(" / ")}`,
        `${(shot.stats.triangles / 1e6).toFixed(2)}M triangles`,
      ]);
      if (diagnostics) {
        // Surfacing the atlas makes it obvious whether the carrier marks are
        // being generated at all, which a black container face cannot show.
        getStencilAtlas();
        if (stencilAtlasCanvas) setAtlas(stencilAtlasCanvas.toDataURL("image/png"));
      }
      setReady(true);
      continueRender(setupHandle);
    })();

    return () => {
      cancelled = true;
      liveRef.current?.shot.dispose();
      liveRef.current?.renderer.dispose();
      liveRef.current = null;
      host.replaceChildren();
    };
  }, [version, width, height, shadowMapSize, preferWebGPU, diagnostics, setupHandle]);

  useEffect(() => {
    if (!ready || !liveRef.current) return;

    const handle = delayRender(`Container yard frame ${frame}`, {
      timeoutInMilliseconds: 600000,
    });
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      continueRender(handle);
    };

    (async () => {
      const live = liveRef.current;
      if (!live) return release();
      const progress =
        durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
      live.shot.update(progress);
      await live.renderer.render(live.shot.scene, live.shot.camera);
      release();
    })();

    return release;
  }, [frame, ready, durationInFrames]);

  return (
    <div style={{ width, height, background: "#000", position: "relative" }}>
      <div ref={hostRef} />
      {diagnostics && info.length > 0 ? (
        <pre
          style={{
            position: "absolute",
            left: 24,
            top: 24,
            margin: 0,
            padding: "12px 16px",
            background: "rgba(0,0,0,0.6)",
            color: "#8ef0b8",
            font: "500 20px ui-monospace, monospace",
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
          }}
        >
          {info.join("\n")}
        </pre>
      ) : null}
      {diagnostics && atlas ? (
        <Img
          src={atlas}
          alt=""
          style={{
            position: "absolute",
            right: 24,
            top: 24,
            width: 260,
            imageRendering: "pixelated",
            border: "1px solid #8ef0b8",
          }}
        />
      ) : null}
    </div>
  );
};

export const containerYardDefaults: ContainerYardProps = {
  version: "v1",
  diagnostics: false,
  shadowMapSize: 2048,
  // See the schema note: WebGPU is tier 1 in renderer.ts and is used whenever
  // this is true, but the software Dawn stack in this container cannot sustain
  // it, so the shipped compositions render on the WebGL2 backend.
  preferWebGPU: false,
};
