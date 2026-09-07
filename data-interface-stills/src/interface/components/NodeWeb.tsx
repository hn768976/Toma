import React from 'react';
import {useDrawOp} from '../ops';
import {alpha, shade, type Palette} from '../palettes';
import {bucketForDepth, depthAt, type Bucket} from '../plane';
import type {Rng} from '../rng';
import type {Tilt, WebSpec} from '../types';

type Node = {x: number; y: number; t: number; bright: boolean; r: number};
type Edge = {a: Node; b: Node; bucket: Bucket};

/**
 * The irregular mesh that links a layout's regions. Nodes are clustered rather
 * than evenly spaced, and lines cross the gap between panel groups.
 */
export const NodeWeb: React.FC<{
  spec: WebSpec;
  palette: Palette;
  rng: Rng;
  tilt: Tilt;
  z: number;
}> = ({spec, palette, rng, tilt, z}) => {
  const {ax, ay, bx, by, spread, nodes} = spec;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;

  const makeGroup = (cx: number, cy: number, count: number): Node[] => {
    // Clusters, not an even ladder: a handful of centres, some nodes isolated.
    const clusters = Math.max(2, Math.round(count / rng.range(2.2, 4)));
    const centres: number[] = [];
    for (let i = 0; i < clusters; i++) centres.push(rng.range(-0.5, 0.5));
    const out: Node[] = [];
    for (let i = 0; i < count; i++) {
      const isolated = rng.next() < 0.22;
      const t = isolated
        ? rng.range(-0.5, 0.5)
        : rng.pick(centres) + rng.range(-0.055, 0.055);
      const along = rng.range(-0.09, 0.09) * len;
      out.push({
        x: cx + px * t * spread + (dx / len) * along,
        y: cy + py * t * spread + (dy / len) * along,
        t,
        bright: rng.next() < 0.2,
        r: rng.range(4, 9),
      });
    }
    return out.sort((m, n) => m.t - n.t);
  };

  const groupA = makeGroup(ax, ay, nodes);
  const groupB = makeGroup(bx, by, nodes);

  const edges: Edge[] = [];
  const pushEdge = (a: Node, b: Node) => {
    const d = depthAt((a.x + b.x) / 2, tilt);
    edges.push({a, b, bucket: bucketForDepth(d)});
  };
  // Lines cross the gap and each other, but each one links roughly opposite
  // partners — an unbiased pick reads as a scribble rather than as a mesh.
  groupA.forEach((a, i) => {
    const links = rng.weighted([0.3, 0.48, 0.19, 0.03]);
    const base = Math.round((i / Math.max(1, groupA.length - 1)) * (groupB.length - 1));
    for (let k = 0; k <= links; k++) {
      const j = Math.max(0, Math.min(groupB.length - 1, base + rng.int(-2, 2)));
      pushEdge(a, groupB[j]);
    }
  });
  for (let i = 0; i < Math.round(nodes * 0.2); i++) {
    const g = rng.bool() ? groupA : groupB;
    const j = rng.int(0, g.length - 2);
    pushEdge(g[j], g[j + 1]);
  }

  const all = [...groupA, ...groupB];
  const drawFor = (bucket: Bucket) => (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.lineWidth = 1.9;
    ctx.strokeStyle = alpha(palette.tones[1], 0.52);
    ctx.beginPath();
    for (const e of edges) {
      if (e.bucket !== bucket) continue;
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.b.x, e.b.y);
    }
    ctx.stroke();

    for (const n of all) {
      if (bucketForDepth(depthAt(n.x, tilt)) !== bucket) continue;
      if (n.bright) {
        const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 5.5);
        halo.addColorStop(0, alpha(palette.tones[2], 0.5));
        halo.addColorStop(1, shade(palette.tones[2], 1, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = alpha(palette.tones[n.bright ? 2 : 1], n.bright ? 0.98 : 0.7);
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  useDrawOp({bucket: 0, z, draw: drawFor(0)});
  useDrawOp({bucket: 1, z, draw: drawFor(1)});
  return useDrawOp({bucket: 2, z, draw: drawFor(2)});
};
