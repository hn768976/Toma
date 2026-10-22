import { Composition } from "remotion";
import { z } from "zod";
import { ChessKing, chessKingSchema } from "./ChessKing";
import { DURATION_IN_FRAMES, FPS } from "./sim";

// Compositions are authored at 4K UHD; final 1080p deliverables are rendered
// with `--scale=0.5` (see README).
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ChessKing-Reference"
        component={ChessKing}
        schema={chessKingSchema}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={3840}
        height={2160}
        defaultProps={{ palette: "goldNoir" } satisfies z.infer<typeof chessKingSchema>}
      />
      <Composition
        id="ChessKing-PlatinumCrimson"
        component={ChessKing}
        schema={chessKingSchema}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={3840}
        height={2160}
        defaultProps={{ palette: "platinumCrimson" } satisfies z.infer<typeof chessKingSchema>}
      />
    </>
  );
};
