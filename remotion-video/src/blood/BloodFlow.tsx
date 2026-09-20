import { useCallback, useState } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { z } from "zod";
import { AdaptiveThreeCanvas, type Backend, type BackendPreference } from "./AdaptiveThreeCanvas";
import { Grade } from "./Grade";
import { LOOKS, LOOKS_BY_ID } from "./looks";
import { Scene } from "./Scene";

export const bloodFlowSchema = z.object({
  lookId: z.enum(LOOKS.map((look) => look.id) as [string, ...string[]]),
  /** "auto" negotiates WebGPU first and drops to WebGL2; pin it to compare. */
  backend: z.enum(["auto", "webgpu", "webgl2"]).default("auto"),
  /** White-on-black cell matte for compositing, as the stock references ship. */
  matte: z.boolean().default(false),
  /** Prints the backend actually in use into the corner of frame. */
  showBackend: z.boolean().default(false),
});

export type BloodFlowProps = z.infer<typeof bloodFlowSchema>;

/** Resolution at which the look presets were dialled in. */
const DESIGN_WIDTH = 1920;

/**
 * One bloodstream version.
 *
 * A single sharp 3D pass. An earlier version composited a second, deliberately
 * defocused foreground layer to fake a shallow depth of field; that is gone,
 * because every cell in every version is now meant to be in focus.
 */
export const BloodFlow: React.FC<BloodFlowProps> = ({
  lookId,
  backend = "auto",
  matte = false,
  showBackend = false,
}) => {
  const { width, height } = useVideoConfig();
  const [activeBackend, setActiveBackend] = useState<Backend | null>(null);
  const onBackend = useCallback((value: Backend) => setActiveBackend(value), []);

  const look = LOOKS_BY_ID[lookId];
  if (!look) {
    throw new Error(`Unknown look "${lookId}". Known looks: ${LOOKS.map((l) => l.id).join(", ")}`);
  }

  // Every pixel dimension below was chosen at 1080p; scaling them keeps the 4K
  // composition looking like the same shot rather than a sharper, thinner one.
  const scale = width / DESIGN_WIDTH;
  const preference = backend as BackendPreference;

  return (
    <AbsoluteFill style={{ backgroundColor: matte ? "#000000" : look.background }}>
      <AdaptiveThreeCanvas
        width={width}
        height={height}
        preference={preference}
        onBackend={onBackend}
        camera={{ fov: look.fov, near: 0.05, far: look.depth * 3, position: [0, 0, 0] }}
      >
        <Scene look={look} matte={matte} />
      </AdaptiveThreeCanvas>

      {matte ? null : <Grade spec={look.grade} />}

      {showBackend && activeBackend ? (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <div
            style={{
              position: "absolute",
              left: 24 * scale,
              bottom: 20 * scale,
              color: "rgba(255,255,255,0.72)",
              fontFamily: "monospace",
              fontSize: 22 * scale,
              letterSpacing: 1,
            }}
          >
            {`${look.id} · ${activeBackend} · ${width}×${height}`}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
