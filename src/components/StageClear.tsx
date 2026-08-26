import {useLayoutEffect} from 'react';
import {HEIGHT, WIDTH} from '../config';
import {resetCtx, type LayersRef} from '../layers';

/**
 * Rendered first, so its layout effect runs before every other element's and
 * each buffer starts the frame empty.
 */
export const StageClear: React.FC<{layers: LayersRef}> = ({layers}) => {
  // No dependency array: the draw must run on EVERY render so that the layer
  // order described in layers.ts holds. See ChipDashboard for the full pass.
  useLayoutEffect(() => {
    const L = layers.current;
    if (!L) return;
    for (const ctx of [L.main, ...L.dof, L.top]) {
      resetCtx(ctx);
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
    }
  });

  return null;
};
