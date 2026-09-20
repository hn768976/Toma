/**
 * Parametric plinth geometry.
 *
 * The plinth is lathed from a generated 2D profile rather than hand-modelled,
 * which is what lets a new stage be a data row: change `tiers`, `bevel` or
 * `tierInset` in the look definition and the geometry follows.
 *
 * Normals: LatheGeometry derives normals analytically from the profile tangent
 * and averages them at interior points, so it smooths every corner. Rather
 * than fight that, the profile gives each corner a real fillet - a convex
 * quarter-circle at the top edge, tangent to both the top face and the side
 * wall, and a concave one at the tier step. Smooth normals are then physically
 * correct everywhere and the edges read as machined.
 *
 * Do not call computeVertexNormals() on the result: it would replace the
 * analytic normals with face-averaged ones and facet the curve.
 */

import * as THREE from "three";
import type { PlinthSpec } from "../looks/types";

/** Total height of the stack - where a composited product would sit. */
export const plinthTopY = (spec: PlinthSpec): number => spec.tierHeight * spec.tiers;

/** Radius of tier `index`, counting 0 as the widest bottom tier. */
export const tierRadius = (spec: PlinthSpec, index: number): number =>
  spec.radius * (1 - spec.tierInset * index);

/** Y of the top face of tier `index`. */
export const tierTopY = (spec: PlinthSpec, index: number): number =>
  spec.tierHeight * (index + 1);

/**
 * Builds the lathe profile, running from the centre of the top face outward
 * and down to the centre of the base. Points are (radius, height).
 */
export const buildPlinthProfile = (spec: PlinthSpec): THREE.Vector2[] => {
  const points: THREE.Vector2[] = [];
  const topIndex = spec.tiers - 1;
  const stepSegments = Math.max(3, Math.round(spec.bevelSegments * 0.6));

  // Centre of the top face. Flat and completely clear - this is the surface
  // the buyer composites onto.
  points.push(new THREE.Vector2(0, tierTopY(spec, topIndex)));

  for (let index = topIndex; index >= 0; index--) {
    const radius = tierRadius(spec, index);
    const faceY = tierTopY(spec, index);
    const wallBottom = spec.tierHeight * index;
    // Clamp so a large bevel on a shallow or narrow tier cannot invert the
    // profile and turn the lathe inside out.
    const bevel = Math.min(spec.bevel, spec.tierHeight * 0.4, radius * 0.4);

    // Across the top face to where the fillet begins. For tiers below the top
    // one the concave step fillet has already placed us on this face, so we
    // only need the outboard end of the run.
    points.push(new THREE.Vector2(radius - bevel, faceY));

    // Convex quarter-circle fillet: tangent to the top face at its start and
    // to the side wall at its end.
    for (let s = 1; s <= spec.bevelSegments; s++) {
      const angle = (s / spec.bevelSegments) * (Math.PI / 2);
      points.push(
        new THREE.Vector2(
          radius - bevel + Math.sin(angle) * bevel,
          faceY - bevel + Math.cos(angle) * bevel,
        ),
      );
    }

    if (index > 0) {
      // Concave fillet tucking this tier's wall into the top face of the tier
      // below. Centre sits inboard and above the corner.
      const stepFillet = Math.min(
        spec.bevel * 0.8,
        spec.tierHeight * 0.25,
        (tierRadius(spec, index - 1) - radius) * 0.4,
      );
      points.push(new THREE.Vector2(radius, wallBottom + stepFillet));
      for (let s = 1; s <= stepSegments; s++) {
        const angle = Math.PI + (s / stepSegments) * (Math.PI / 2);
        points.push(
          new THREE.Vector2(
            radius + stepFillet + Math.cos(angle) * stepFillet,
            wallBottom + stepFillet + Math.sin(angle) * stepFillet,
          ),
        );
      }
    } else {
      // Bottom tier: straight down to the floor. The base corner is inside the
      // contact shadow, so it needs no fillet.
      points.push(new THREE.Vector2(radius, wallBottom));
    }
  }

  // Underside back to the axis, closing the lathe.
  points.push(new THREE.Vector2(0, 0));

  // LatheGeometry derives each normal as (dy, -dx) from the step between
  // consecutive profile points, so a profile running downward produces
  // inward-facing normals and the top cap gets back-face culled. The profile
  // is built top-down because that is the order the tiers stack in; reversing
  // it here gives the ascending order the lathe expects.
  points.reverse();
  return points;
};

export const buildPlinthGeometry = (spec: PlinthSpec): THREE.LatheGeometry =>
  new THREE.LatheGeometry(buildPlinthProfile(spec), spec.radialSegments);
