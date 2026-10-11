import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";

// A scene app owns its own three.js objects and post chain. It is built
// once, then asked to draw a given frame number. It may not keep any state
// that changes from one frame to the next.
export type SceneApp = {
  render: (frame: number) => void;
  dispose: () => void;
};

export type SceneFactory<A> = (args: {
  renderer: THREE.WebGLRenderer;
  width: number; // drawing-buffer pixels
  height: number;
  assets: A;
}) => SceneApp;

const Driver = <A,>({
  factory,
  assets,
}: {
  factory: SceneFactory<A>;
  assets: A;
}) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const [app] = useState(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    gl.autoClear = false;
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    return factory({
      renderer: gl,
      width: size.x,
      height: size.y,
      assets,
    });
  });
  useEffect(() => () => app.dispose(), [app]);
  // Priority 1 takes over rendering from R3F. The frame number comes from
  // Remotion, never from R3F's clock.
  useFrame(() => {
    app.render(frameRef.current);
  }, 1);
  return null;
};

// Loads assets (head mesh, fonts, procedural textures) behind delayRender,
// then mounts a WebGL2 canvas sized to the composition. The buffer follows
// the render scale: --scale=0.333 renders a 1280x720 buffer, not 4K.
export const GLStage = <A,>({
  load,
  factory,
  background = "#000",
}: {
  load: () => Promise<A>;
  factory: SceneFactory<A>;
  background?: string;
}) => {
  const { width, height } = useVideoConfig();
  const [loaded, setLoaded] = useState<{ assets: A } | null>(null);
  const [handle] = useState(() => delayRender("Loading scene assets"));
  useEffect(() => {
    let alive = true;
    load()
      .then((a) => {
        if (alive) setLoaded({ assets: a });
      })
      .catch((err) => {
        console.error(err);
        throw err;
      });
    return () => {
      alive = false;
    };
  }, [load, handle]);
  // Release only after the canvas has mounted and registered its own
  // delayRender, so no frame is captured before the first WebGL draw.
  useEffect(() => {
    if (loaded) continueRender(handle);
  }, [loaded, handle]);
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  return (
    <AbsoluteFill style={{ background }}>
      {loaded ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          linear
          flat
          gl={{
            antialias: false,
            alpha: false,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
            stencil: false,
            depth: false,
          }}
        >
          <Driver factory={factory} assets={loaded.assets} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};

// Fonts for Canvas-2D textures: Orbitron for big readouts, Inter for small
// HUD text. Both OFL, served from public/fonts.
let fontPromise: Promise<void> | null = null;
export const loadFonts = (staticFile: (p: string) => string) => {
  if (!fontPromise) {
    const faces: [string, string, string][] = [
      ["Orbitron", "fonts/orbitron-latin-500-normal.woff2", "500"],
      ["Orbitron", "fonts/orbitron-latin-700-normal.woff2", "700"],
      ["Inter", "fonts/inter-latin-400-normal.woff2", "400"],
      ["Inter", "fonts/inter-latin-500-normal.woff2", "500"],
      ["Inter", "fonts/inter-latin-600-normal.woff2", "600"],
    ];
    fontPromise = Promise.all(
      faces.map(async ([family, path, weight]) => {
        const face = new FontFace(family, `url(${staticFile(path)})`, {
          weight,
        });
        await face.load();
        (document.fonts as unknown as Set<FontFace>).add(face);
      }),
    ).then(() => undefined);
  }
  return fontPromise;
};
