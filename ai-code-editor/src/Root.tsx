import React from "react";
import { Composition } from "remotion";

import { AiEditor } from "./AiEditor";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "./layout";

/**
 * Compositions are defined at 4K. Render the 1080p preview with `--scale=0.5`
 * and the delivery master with `--scale=1`; the layout is identical because
 * every measurement is authored in 1080p units and scaled once.
 */
const SHARED = {
  durationInFrames: 600,
  fps: 30,
  width: DESIGN_WIDTH * 2,
  height: DESIGN_HEIGHT * 2,
} as const;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-AIEditorDarkPython"
      component={AiEditor}
      {...SHARED}
      defaultProps={{ themeId: "dark", contentId: "python" } as const}
    />
    <Composition
      id="V2-AIEditorDarkTypeScript"
      component={AiEditor}
      {...SHARED}
      defaultProps={{ themeId: "dark", contentId: "typescript" } as const}
    />
    <Composition
      id="V3-AIEditorLightPython"
      component={AiEditor}
      {...SHARED}
      defaultProps={{ themeId: "light", contentId: "python" } as const}
    />
  </>
);
