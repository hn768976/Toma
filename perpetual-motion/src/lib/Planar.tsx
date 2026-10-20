import React from "react";
import { faceAffine, matrixText, screenVector, type Face, type Projection } from "./iso.ts";

// A flat part with thickness, turning in its own plane. It is drawn as copies
// stepped along the plane's normal from back to front: the back copy carries
// the far outline, the middle copies fill the side band in a side tone, the
// front copy is the face with its lines. Every copy gets the same transform,
// `isoFace(along) · local`, where local is e.g. rotate(θ) — so the part turns
// in its own plane and its ellipses stay ellipses on that face.

export interface PlanarItem {
  html: string;
  /** SVG transform applied in the plane's flat coordinates, e.g. "rotate(30)" */
  local: string;
  key: string;
}

const STEP_PX = 3;

export function copiesFor(P: Projection, face: Face, along: [number, number]) {
  const v = screenVector(P, face.axis);
  const len = Math.hypot(v[0], v[1]) * Math.abs(along[1] - along[0]);
  return Math.max(2, Math.ceil(len / STEP_PX) + 1);
}

export const Planar: React.FC<{ P: Projection; face: Face; along: [number, number]; items: PlanarItem[]; copies?: number; part?: "all" | "body" | "front" }> = ({ P, face, along, items, copies, part = "all" }) => {
  const n = copies ?? copiesFor(P, face, along);
  const layers: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    // part lets something sit inside the part: draw the body, then it, then the front face
    if ((part === "body" && i === n - 1) || (part === "front" && i !== n - 1)) continue;
    const at = along[0] + ((along[1] - along[0]) * i) / (n - 1);
    const cls = i === 0 ? "back" : i === n - 1 ? "front" : "side";
    const m = matrixText(faceAffine(P, face, at));
    layers.push(
      <g key={i} className={cls}>
        {items.map((it) => (
          <g key={it.key} transform={`${m} ${it.local}`} dangerouslySetInnerHTML={{ __html: it.html }} />
        ))}
      </g>,
    );
  }
  return <>{layers}</>;
};

export const Static: React.FC<{ html: string; id?: string }> = ({ html, id }) => <g id={id} dangerouslySetInnerHTML={{ __html: html }} />;
