import React from 'react';
import type {Rect} from '../lib/layout';
import type {Palette} from '../variants';
import {ReadoutBlock} from './ReadoutBlock';
import type {Block} from './ReadoutBlock';

export type PanelEntry = {block: Block; rect: Rect; delay: number; key: string};

/**
 * A region of the HUD (a column or a strip). It owns nothing but layout: each
 * child block renders into its own canvas and caches its own chrome.
 */
export const SidePanel: React.FC<{
  entries: PanelEntry[];
  palette: Palette;
  frame: number;
  seed: string;
  flashSet: Set<string>;
  flash: number;
  reroll: number;
  activity: number;
}> = ({entries, palette, frame, seed, flashSet, flash, reroll, activity}) => (
  <>
    {entries.map((e) => {
      const lit = flashSet.has(e.key);
      return (
        <ReadoutBlock
          key={e.key}
          block={e.block}
          rect={e.rect}
          palette={palette}
          frame={frame}
          seed={`${seed}/${e.key}`}
          delay={e.delay}
          flash={lit ? flash : 0}
          reroll={lit ? reroll : 0}
          activity={activity}
        />
      );
    })}
  </>
);
