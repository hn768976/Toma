import { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { mulberry32 } from "./random";

type Speck = {
  x: number;
  y: number;
  size: number;
  stretch: number;
  alpha: number;
  vx: number;
  vy: number;
  twinkle: number;
  phase: number;
};
type Cloud = { x: number; y: number; rx: number; ry: number; a: number; vx: number };

// Dark navy "deep space" backdrop with softly blurred drifting specks.
export const Background: React.FC<{ drift?: number }> = ({ drift = 0 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const k = width / 3840;

  const { specks, clouds, sprite } = useMemo(() => {
    const rnd = mulberry32(20240611);
    const specks: Speck[] = [];
    for (let i = 0; i < 3600; i++) {
      const depth = rnd();
      specks.push({
        x: rnd(),
        y: rnd(),
        size: 8 + depth * depth * 24,
        stretch: 1.5 + rnd() * 1.6,
        alpha: 0.28 + rnd() * 0.65,
        vx: 0.0011 + depth * 0.0034,
        vy: (rnd() - 0.5) * 0.0012,
        twinkle: 0.05 + rnd() * 0.12,
        phase: rnd() * Math.PI * 2,
      });
    }
    const clouds: Cloud[] = [];
    for (let i = 0; i < 70; i++) {
      clouds.push({
        x: rnd(),
        y: rnd(),
        rx: 0.06 + rnd() * 0.12,
        ry: 0.04 + rnd() * 0.08,
        a: 0.18 + rnd() * 0.3,
        vx: 0.0008 + rnd() * 0.0014,
      });
    }
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 64;
    const sc = sprite.getContext("2d")!;
    const g = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(214,222,236,0.9)");
    g.addColorStop(0.45, "rgba(190,202,222,0.5)");
    g.addColorStop(1, "rgba(160,176,205,0)");
    sc.fillStyle = g;
    sc.fillRect(0, 0, 64, 64);
    return { specks, clouds, sprite };
  }, []);

  useLayoutEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#0b1219";
    ctx.fillRect(0, 0, width, height);

    const wrap = (v: number) => ((v % 1.2) + 1.2) % 1.2 - 0.1;
    ctx.globalCompositeOperation = "lighter";
    for (const c of clouds) {
      const cx = wrap(c.x + c.vx * frame + drift * 0.5) * width;
      const cy = c.y * height;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(c.rx * width, c.ry * height);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, `rgba(34,50,66,${c.a})`);
      g.addColorStop(1, "rgba(34,50,66,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
    for (const s of specks) {
      const x = wrap(s.x + s.vx * frame + drift * (0.3 + s.size * 0.06)) * width;
      const y = wrap(s.y + s.vy * frame) * height;
      const w = s.size * s.stretch * k;
      const h = s.size * k;
      ctx.globalAlpha =
        s.alpha * (0.75 + 0.25 * Math.sin(s.phase + frame * s.twinkle));
      ctx.drawImage(sprite, x - w / 2, y - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    // darker horizontal bands + vignette, as in the reference backdrop
    const v = ctx.createLinearGradient(0, 0, 0, height);
    v.addColorStop(0, "rgba(0,0,0,0.25)");
    v.addColorStop(0.2, "rgba(0,0,0,0)");
    v.addColorStop(0.8, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.3)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, width, height);
  });

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
};
