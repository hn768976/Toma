// One motion cycle, in frames. 600 frames = 20s at 30fps.
//
// Kept separate from the composition's `durationInFrames` on purpose. The
// loop-closure check in the README temporarily extends the composition to 601
// frames and compares frame 0 against frame 600; that comparison is only
// meaningful while the motion period stays pinned at 600.
export const LOOP_FRAMES = 600;
