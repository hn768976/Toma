import React, { useRef } from "react";
import { drawMotifInstance, type MotifEnv, type MotifInstance } from "../render/motif";
import { paintFill } from "../fills/treatments";
import { useStageLayer } from "./CanvasStage";
import { FillTreatment, PainterSlotContext, type PainterSlot } from "./FillTreatment";

/**
 * One motif instance — circle, ring, chrysanthemum, sakura, seigaiha cluster,
 * ring flower, kumo or dot cluster — placed, scaled, rotated and inked.
 *
 * The shape owns its geometry (lattice outlines, centre dots, sakura stamens);
 * the area fill is delegated to the <FillTreatment> it renders.
 */
export const MotifShape: React.FC<{
  idPrefix?: string;
  order: number;
  instance: MotifInstance;
  env: MotifEnv;
}> = ({ idPrefix = "motif", order, instance, env }) => {
  const slot = useRef<PainterSlot["current"]>(null);

  useStageLayer(`${idPrefix}-${instance.index}`, order, (ctx) => {
    const paint = slot.current ?? ((options) => paintFill(instance.spec.fill, options));
    drawMotifInstance(ctx, instance, env, paint);
  });

  return (
    <PainterSlotContext.Provider value={slot}>
      <FillTreatment kind={instance.spec.fill} />
    </PainterSlotContext.Provider>
  );
};
