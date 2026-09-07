import React, {createContext, useContext} from 'react';
import type {Bucket} from './plane';

export type DrawOp = {
  /** Which depth buffer this op belongs to. */
  bucket: Bucket;
  /** Paint order inside the buffer; lower draws first. */
  z: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
};

const OpsContext = createContext<DrawOp[] | null>(null);

export const OpsProvider: React.FC<{
  ops: DrawOp[];
  children: React.ReactNode;
}> = ({ops, children}) => (
  <OpsContext.Provider value={ops}>{children}</OpsContext.Provider>
);

/**
 * Content components render nothing to the DOM — they contribute a draw
 * operation to the depth buffer they belong to. `FocusPass` builds a fresh
 * array on every render before its children run, so a repeated render can
 * never duplicate ops.
 */
export const useDrawOp = (op: DrawOp): null => {
  const ops = useContext(OpsContext);
  if (!ops) {
    throw new Error('Content components must be rendered inside <FocusPass>.');
  }
  ops.push(op);
  return null;
};
