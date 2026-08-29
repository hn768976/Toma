import React, { createContext, useContext } from "react";
import type { Bucket } from "./variants";

/**
 * A single drawing instruction, aimed at one depth-of-field buffer.
 * Components register these during render; the composition executes them in a
 * layout effect, once all children have registered, in a stable order.
 */
export type DrawOp = {
  /** Painter's order. Lower draws first. */
  order: number;
  /** Which buffer to draw into. */
  bucket: string;
  /** Multiplied into the buffer context's globalAlpha. */
  alpha: number;
  /** `res` is the buffer's backing-store scale; multiply any transform by it. */
  fn: (ctx: CanvasRenderingContext2D, res: number) => void;
};

export type SceneBuffer = Bucket & {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

export type SceneApi = {
  /** Idempotent: registering the same id twice replaces, never duplicates. */
  register: (id: string, ops: DrawOp[]) => void;
};

const SceneContext = createContext<SceneApi | null>(null);

export const SceneProvider = SceneContext.Provider;

export const useScene = (): SceneApi => {
  const api = useContext(SceneContext);
  if (!api) {
    throw new Error("Scene components must be rendered inside <GridCorridor>");
  }
  return api;
};

/** Painter's order for the layers of the scene. */
export const LAYER = {
  wall: 5,
  grid: 10,
  connector: 20,
  text: 30,
  glyph: 40,
  dot: 50,
  flare: 60,
} as const;

export const createBuffer = (
  bucket: Bucket,
  width: number,
  height: number,
): SceneBuffer => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * bucket.res);
  canvas.height = Math.round(height * bucket.res);
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("2d context unavailable");
  return { ...bucket, canvas, ctx };
};

/** Runs every registered op against its buffer, in painter's order. */
export const paintOps = (
  ops: Map<string, DrawOp[]>,
  buffers: Map<string, SceneBuffer>,
): void => {
  const flat: { id: string; op: DrawOp }[] = [];
  ops.forEach((list, id) => {
    for (let i = 0; i < list.length; i++) {
      flat.push({ id: `${id}#${i}`, op: list[i] });
    }
  });
  flat.sort((a, b) => a.op.order - b.op.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const { op } of flat) {
    if (op.alpha <= 0.002) continue;
    const buffer = buffers.get(op.bucket);
    if (!buffer) continue;
    const { ctx } = buffer;
    ctx.save();
    ctx.globalAlpha = op.alpha;
    op.fn(ctx, buffer.res);
    ctx.restore();
  }
};

/** Convenience wrapper so components stay declarative. */
export const useRegister = (id: string, ops: DrawOp[]): null => {
  const scene = useScene();
  scene.register(id, ops);
  return null;
};

export const Noop: React.FC = () => null;
