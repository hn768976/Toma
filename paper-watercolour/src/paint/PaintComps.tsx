import React from "react";
import { Still } from "remotion";
import { P5Brush } from "./P5Brush";
import { PAINT_LAYERS, rngFor, seedFor } from "./layers";

// Build-time only: `npm run paint` renders each of these once to
// public/layers/<id>.png. They are not part of the delivered clips.
export const PaintComps: React.FC = () => (
  <>
    {PAINT_LAYERS.map((layer) => (
      <Still
        key={layer.id}
        id={`Paint-${layer.id.replace(/_/g, "-")}`}
        width={layer.width}
        height={layer.height}
        component={() => (
          <P5Brush
            width={layer.width}
            height={layer.height}
            seed={seedFor(layer.id)}
            draw={(p, b) => layer.paint(p, b, rngFor(layer.id))}
          />
        )}
      />
    ))}
  </>
);
