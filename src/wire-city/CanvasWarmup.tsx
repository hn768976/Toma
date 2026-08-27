/**
 * CanvasWarmup.tsx — holds the frame until the post-processing composer is
 * actually able to draw.
 *
 * GOTCHA, and the one that costs the most time to find:
 * `@react-three/postprocessing`'s <EffectComposer> builds its composer inside
 * a *passive* effect and stores it with `setComposerState`, so it is null for
 * the whole first React commit. Its `useFrame` subscription is nevertheless
 * registered at renderPriority 1 straight away, and a non-zero render
 * priority switches OFF react-three-fiber's own automatic `gl.render()`.
 *
 * Under a normal r3f app nobody notices: the loop ticks again 16ms later and
 * the second tick draws. Under Remotion the loop ticks EXACTLY ONCE per
 * frame, so frame 0 is captured with nothing drawn at all — a completely
 * empty canvas that looks exactly like the "no lights / wrong material"
 * failure and sends you hunting in the wrong place.
 *
 * This component forces a few extra React commits with an `advance()` after
 * each, and holds a `delayRender()` handle until they are done, so Remotion
 * never screenshots a canvas whose composer has not been built. It only runs
 * on mount; every later frame is driven by <ThreeCanvas> as normal.
 *
 * `advance()` takes a wall-clock timestamp, which react-three-fiber turns
 * into the `delta` handed to useFrame. Nothing in this project reads that
 * delta — the composer's passes are all time-independent — so determinism is
 * unaffected.
 */

import {useThree} from '@react-three/fiber';
import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';

/** Two commits are enough in practice; three is cheap insurance. */
const WARMUP_COMMITS = 3;

export const CanvasWarmup: React.FC = () => {
	const advance = useThree((s) => s.advance);
	const [handle] = useState(() =>
		delayRender('Warming up the WebGL scene and post-processing composer'),
	);
	const [commits, setCommits] = useState(0);

	useEffect(() => {
		if (commits < WARMUP_COMMITS) {
			advance(performance.now());
			setCommits((c) => c + 1);
			return;
		}
		continueRender(handle);
	}, [commits, advance, handle]);

	return null;
};
