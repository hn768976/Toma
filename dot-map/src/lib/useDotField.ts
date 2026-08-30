import {useEffect, useMemo, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import {buildDotField} from './dots';
import type {DotField} from './dots';

/** Natural Earth 110m country polygons, merged to land at generation time. */
export const MAP_DATA = 'countries-110m.json';

/**
 * Loads the map once and builds the dot set once. Remotion keeps the tree
 * mounted across frames, so this runs a single time per render worker.
 */
export const useDotField = (width: number, height: number): DotField | null => {
  const [handle] = useState(() => delayRender('Building the dot field'));
  const [topology, setTopology] = useState<unknown>(null);

  useEffect(() => {
    let live = true;
    fetch(staticFile(MAP_DATA))
      .then((res) => res.json())
      .then((json) => {
        if (live) {
          setTopology(json);
        }
      })
      .catch((err) => cancelRender(err));
    return () => {
      live = false;
    };
  }, []);

  const field = useMemo(
    () =>
      topology
        ? buildDotField(topology as Parameters<typeof buildDotField>[0], width, height)
        : null,
    [topology, width, height],
  );

  useEffect(() => {
    if (field) {
      continueRender(handle);
    }
  }, [field, handle]);

  return field;
};
