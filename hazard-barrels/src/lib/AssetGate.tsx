import React, { Suspense, use, useLayoutEffect } from "react";
import { useDelayRender } from "remotion";

/** Holds the render (delayRender) for as long as the tree below is suspended. */
const Hold: React.FC<{ label: string }> = ({ label }) => {
  const { delayRender, continueRender } = useDelayRender();
  useLayoutEffect(() => {
    const handle = delayRender(label);
    return () => continueRender(handle);
  }, [delayRender, continueRender, label]);
  return null;
};

const Await: React.FC<{ promise: Promise<unknown>; children: React.ReactNode }> = ({
  promise,
  children,
}) => {
  use(promise);
  return <>{children}</>;
};

/**
 * Renders children only once `promise` (fonts, textures, models) has resolved.
 * Until then the frame is held back with delayRender, so no frame is ever
 * captured with assets missing.
 */
export const AssetGate: React.FC<{
  promise: Promise<unknown>;
  label: string;
  children: React.ReactNode;
}> = ({ promise, label, children }) => (
  <Suspense fallback={<Hold label={label} />}>
    <Await promise={promise}>{children}</Await>
  </Suspense>
);
