# Model sources

All 3D assets in this folder came from **Meshy** (meshy.ai) and were prepared
once with the scripts in `scripts/`. Nothing calls Meshy at render time.

| File | What it is | Made by |
|------|------------|---------|
| `colon.glb` | Cut-open colon (front half removed, wall modelled), remeshed + classified | **User-supplied Meshy GLB** → `scripts/prepare_precut_colon.py` |
| `centreline.json` | Centreline (24 stations), radii, wall data | `scripts/prepare_precut_colon.py` |
| `clump.glb` | Stool clump, 4,600 triangles | Meshy text-to-3D task `01a0fc99-e124-7416-ba1f-090e4a72ad34` → `scripts/prepare_meshy_clump.py` |

## Colon — the model used

**Source file:** `Meshy_AI_full_colon_tube_100k_1002130711_texture.glb`, supplied
by the project owner during the build (generated on their own Meshy account;
task ID and prompt not included in the file — please fill in from the Meshy
dashboard if needed: _task ID: ______ , prompt: ______ , plan: ______ _).

It is already cut open (front half removed, wall thickness modelled, closed
caecum bulb, open rectal end), so the renderer shades it directly instead of
cutting it with the clipping-plane + stencil-cap path (which stays in the code
for closed-shell models; see README).

Prep (`python3 scripts/prepare_precut_colon.py <glb>`):
1. weld, keep the main piece (5 stray fragments of 4–8 triangles dropped),
   drop Meshy's baked texture;
2. keep Meshy's orientation (open side faces +z, caecum on the left), centre,
   scale so the largest dimension is 10 units;
3. isotropic remesh to ~120k triangles (pymeshlab) — removes Meshy's thin,
   folded triangle strips that showed as white seams — light Taubin smoothing,
   smooth normals;
4. centreline: medial axis of the front-view silhouette (caecum → rectum),
   depth from the back wall, then **24 plane slices** each circle-fitted to
   refine the centre and measure outer / inner radius;
5. surface classes baked as vertex colours (R: smooth field −1 lining … 0 cut
   rim … +1 outer wall; G: distance across the rim) — from local concavity and
   region growing, smoothed so the lining edge and cream line are clean curves.

## Colon — our own Meshy text-to-3D runs (not used in the end)

Three rounds, 12 candidates, `ai_model: latest`, `art_style: realistic`,
`topology: triangle`, `target_polycount: 100000`. Turntables:
`deliverables/colon-cutaway/meshy-turntables/round{1,2,3}_turntables.png`.

**Round 1** — prompt (as given in the brief):
> Anatomical model of the human large intestine (colon) only, isolated, no other
> organs. Smooth tube of even thickness following the classic path: caecum
> bottom-left, ascending colon up the left, transverse colon across the top with
> a gentle downward sag, descending colon down the right, sigmoid colon looping
> toward the bottom centre. Soft rounded pouches (haustra) along the tube. Smooth
> clean surface, salmon-pink, stylised medical-illustration look, not gory, no
> blood, no veins, no fat. Ends open.

`01a0fc90-4b84-716d-a3b7-a2ed5daf306f` (seed 11, fused figure-8),
`01a0fc90-5372-7599-8d03-1186a1af5155` (22, loop), `01a0fc90-5464-7147-b4c2-733f2865aa77`
(33, extra organs), `01a0fc90-555c-77ae-b8fc-6213d53b89fd` (44, extra tube) — all rejected.

**Round 2** — two refined prompts:
- A: "Stylised anatomical model of the human large intestine only, front view, laid
  out flat in a single plane like a picture frame: one single continuous smooth tube
  of even thickness, no branches, no small intestine, no stomach, no oesophagus, no
  appendix. Rounded caecum pouch at bottom-left, … Loops never touch or cross. …"
  → `01a0fc99-bfd0-7766-80fd-e59ac641aad0`, `01a0fc99-cbdb-763b-a3f8-490e10a9de4f`
  (both include small intestine — rejected)
- B: "A single smooth pink tube bent into the shape of a large intestine (colon),
  lying flat in one plane: up the left side from a rounded closed bulb at
  bottom-left, across the top with a slight dip, down the right side, then curving
  left in a gentle S to end at the bottom middle. Even tube thickness, shallow
  rounded segment bulges like a caterpillar, no branches, the tube never touches or
  crosses itself, nothing else in the scene. …"
  → `01a0fc99-cd0e-7085-897c-c934cd415b9a` (partial — rejected),
  **`01a0fc99-d6c4-72e4-bc43-d870cb382ba9` (seed 404) — accepted**: one
  continuous, even tube, readable colon path (sigmoid end tapers). PBR refine:
  `01a0fca3-b986-70e1-8c94-a9eadfb16e7a` (normal map nearly flat with UV-seam
  blotches → not used). This was prepared with `scripts/prepare_meshy_colon.py`
  (closed-shell cutaway path) and was the working model until the supplied GLB
  replaced it.

**Round 3** — prompt B with "rounded bulb pouch … constant tube thickness, no
taper": `01a0fca0-4470-7247-9f8f-00941748db80`, `01a0fca0-4d93-7101-afeb-9898e91cc82e`,
`01a0fca0-4e7b-76e5-a360-232eddd1961c`, `01a0fca0-4f5c-732b-8a35-c0ed20f63efa` —
all partial shapes, rejected.

## Clump

Round 1: "A single lumpy knobbly cluster of several small rounded lumps fused
together, dark brown, rough matte surface, compact roughly spherical blob,
stylised medical illustration, no base, no stand." → `01a0fc90-7069-72fc-83de-e1ad17b5a299`
(faceted sphere — rejected).

Round 2: "A single small irregular cluster of 7 rounded knobbly blobs of dark
brown clay fused together, organic bumpy lumps, no sharp edges, no flat facets,
rough matte surface, isolated object, no base, no stand." →
`01a0fc99-d7b6-7410-bf61-62b1acf409f8` (seed 505), **`01a0fc99-e124-7416-ba1f-090e4a72ad34`
(seed 606) — used** (5,229 → 4,600 triangles, watertight). PBR refine
`01a0fca3-c141-718e-becd-263a452c9082` (texture not used: materials are ours).

## Plan / licence — please check

- Our runs above were made through the Meshy API key connected to this build
  environment. The API does not report which **plan** that account is on, so
  it is recorded here as **unknown** — please confirm in the Meshy dashboard.
- The supplied colon GLB came from the owner's own Meshy account; its plan is
  likewise not recorded in the file.
- Meshy's terms differ by plan: assets made on the **free plan** are, per
  Meshy's terms, published under a Creative Commons Attribution licence and
  may be publicly visible; **commercial / stock use needs a paid plan's
  terms**. Check the plan for both accounts before selling or licensing
  footage made with these models.
