#!/usr/bin/env bash
# Builds one standalone zip per version. Each zip carries the whole project
# (src/, package.json, tsconfig.json, remotion.config.ts, public/) plus a
# README naming that version's composition. node_modules/, out/ and .git/ are
# excluded; there are no external library components to vendor beyond src/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist-zips"
rm -rf "$DIST"
mkdir -p "$DIST"

emit() {
  local slug="$1" comp="$2" title="$3" desc="$4"
  local stage="$DIST/$slug"
  mkdir -p "$stage"
  cp -R "$ROOT/src" "$stage/src"
  cp "$ROOT/package.json" "$ROOT/tsconfig.json" "$ROOT/remotion.config.ts" "$stage/"
  cp "$ROOT/.gitignore" "$stage/.gitignore"
  mkdir -p "$stage/public"
  cp -R "$ROOT/public/." "$stage/public/" 2>/dev/null || true

  cat > "$stage/README.md" <<EOF
# $title

$desc

| | |
|---|---|
| Composition id | \`$comp\` |
| Resolution | **4K — 3840 x 2160** |
| Duration | 450 frames |
| Frame rate | 30 fps |
| Length | 15.0 s |
| Loop | Seamless — frame 450 is pixel-identical to frame 0 |

Every drift path, brightness pulse, flash, label reroll and light cycle has a
period that divides 450 frames, so the clip loops with no cut.

## Render at 4K

\`\`\`
npm install
npx remotion render $comp out/$slug.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

Lower \`--concurrency\` if the machine has fewer cores than that; Remotion
rejects a value above the core count.

## 1080p preview

\`\`\`
npx remotion render $comp out/$slug-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=8
\`\`\`

## Studio

\`\`\`
npm run dev
\`\`\`

## What is in here

All four versions share one mesh implementation. Density, facet mode, label
set and light mode are config values in \`src/variants.ts\`, which is also the
only file in the project containing a colour literal.

\`\`\`
src/
  Root.tsx                    all four compositions
  NetworkMesh.tsx             the composition: one mesh, four variants
  variants.ts                 palettes + per-version configuration
  constants.ts                4K geometry and loop length
  mesh/geometry.ts            seeded node field, drift, spatial-grid edges, triangles
  lib/                        seeded random, colour and canvas helpers
  components/
    BackgroundWash.tsx        base fill and drifting soft washes
    NodeMesh.tsx              nodes + edges, three-buffer depth of field, bloom
    FacetLayer.tsx            low-alpha triangulated facets
    LabelField.tsx            edge-weighted drifting text field
    BokehLayer.tsx            defocused discs, behind and in front of the mesh
    AnamorphicFlare.tsx       travelling streak with chromatic fringing
    LightBloom.tsx            rising atmospheric glow
    DustMotes.tsx             upward-drifting motes
    PostFx.tsx                vignette and film grain
\`\`\`

All motion derives from \`useCurrentFrame()\` and all randomness from
Remotion's \`random()\` with fixed string seeds, so renders are deterministic
and frames can be produced in any order across workers.
EOF

  (cd "$DIST" && zip -qr "$ROOT/$slug.zip" "$slug" \
     -x "*/node_modules/*" "*/out/*" "*/.git/*")
  echo "built $slug.zip"
}

emit mesh-plexus-blue  MeshPlexusBlue  "Network Mesh — Plexus Blue (v1)" \
  "A dense, faceted node field in deep navy with numeric readouts scattered around the edges. No light element: the mesh and the bokeh carry the frame."
emit mesh-plexus-green MeshPlexusGreen "Network Mesh — Plexus Green (v2)" \
  "A finer-grained mesh — more nodes, shorter edges — in a near-black terminal green, with short uppercase words dominating the label field."
emit mesh-flare-blue   MeshFlareBlue   "Network Mesh — Flare Blue (v3)" \
  "A sparse mesh of long edges across a luminous, saturated blue field, crossed twice by a travelling anamorphic lens flare with cyan and magenta chromatic fringing."
emit mesh-flare-amber  MeshFlareAmber  "Network Mesh — Flare Amber (v4)" \
  "The same sparse mesh over a warm brown field, lit by a broad soft bloom rising from below the lower edge and receding, with fine dust motes drifting upward through it."

rm -rf "$DIST"
