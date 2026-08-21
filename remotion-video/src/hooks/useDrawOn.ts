import { useLayoutEffect, useRef, useState } from "react";

// Measures an SVG path's length so it can be revealed with a
// stroke-dasharray "drawn by hand" animation. Pass the returned `ref` to
// the <path>, then drive the reveal with `dashProps(progress)`.
export const useDrawOn = () => {
  const ref = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);

  useLayoutEffect(() => {
    if (ref.current) {
      setLength(ref.current.getTotalLength());
    }
  }, []);

  const dashProps = (progress: number) => {
    const clamped = Math.max(0, Math.min(1, progress));
    return {
      strokeDasharray: length,
      strokeDashoffset: length * (1 - clamped),
    };
  };

  return { ref, length, dashProps };
};
