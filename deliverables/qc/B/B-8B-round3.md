### Step 8B round 3 for `city-growth` (third and last round; recorded, not acted on)

Two fresh sub-agents compared frames 45 / 225 / 449 of the final delivered videos with the reference. Three rounds is the limit set in the brief, so these notes were not followed by another fix pass and re-render.

**Version 1 (`03-V1-city-growth.mp4`), most important first**

1. Camera and framing at 225 / 449: the reference is closer and lower, with the city filling the frame to the left, right and bottom edges and towers about 50–70 px wide and up to 200 px tall (at 768×432). Ours is higher and further back: the whole island outline is visible, buildings are smaller (towers about 30–40 px wide, 150 px tall) and more numerous.
2. Saturation and contrast: reference towers are saturated, luminous cyan-blue glass with bright highlights and gradients; ours are pale, washed-out aqua with faint grid lines; pastel and flat overall.
3. Shading: the reference has deep shadows (dark street canyons, shaded building sides, dark grey roads, dark navy-teal water); ours has almost no shadowing and lighter, flatter grey-teal water.
4. Roads: reference has dark elevated curved highways with overlapping ramps and a wide dark bridge with piers; ours has a flat grid of wide grey-teal bands, a pale ring road and a thin white bridge strip, so roads read lighter than the buildings.
5. Shoreline: ours shows a broad white, then turquoise, crackled border around the island; the reference city runs straight to the water.
6. Timing: at 225 the reference is still building its top-right area; the reviewer read ours as fully built by 225.
7. Frame 45 composition: the reference cluster sits lower-centre under a tilted camera with roads spanning about x 90–620; ours has upright towers placed higher with a road network about half as wide.
8. Frame 45 features missing in ours: the solid shaded mid-rise block among the wireframes, crisp solid white ground slabs, dotted vertical streaks dissolving off the towers. Ours adds dashed lane markings and a soft white radial glow.
9. Fragments at frame 45: reference shards larger (10–20 px) and scattered in patches along the roads; ours smaller (5–10 px) in one compact blob.
10. Sharpness: reference slightly soft with richer roof detail; ours uniformly crisp, hard-edged and simpler.
11. Background at frame 45: reference cyan with darker corners; ours paler and greyer with less vignette.

**Version 2 (`04-V2-city-growth.mp4`)**

- Is the camera change clearly visible? **Yes** ("opens flat top-down and small in the centre, then sits wider at 225 and lower and more side-on at 449").
- Is everything else the same concept and quality? **No** ("the concept matches, but v2 looks flatter, emptier and less polished").

Other differences listed: (1) building density: at 225 roughly the right 40 % and the outer rim are empty road-grid blocks, at 449 the lower right is still sparse; (2) glass pale matte aqua and white, low contrast, no deep shadows; (3) a dense, warped dark-teal street grid and a near-white highway instead of a few broad dark-grey roads and grey curved highways; (4) opening frame: faint translucent wireframe cluster, short road stubs with dashed lines, small pebbles in a round blob; (5) no bloom, depth haze or bright foam edge; (6) water flatter and lighter; (7) bridge missing at 225 and a thin white viaduct at 449; (8) still filling in between 225 and 449; (9) simple stepped white roofs.

**Reading these against round 2.** Rounds 2 and 3 pull in opposite directions on three points, and the final render sits between them:

| Point | Round 2 said | Round 3 says |
|---|---|---|
| Scale | towers 200–300 px, camera too close: "toy block cluster" | towers ~150 px, camera too high and far |
| Saturation | too saturated (azure towers, strong turquoise ground) | too pale and pastel |
| Late build-out | fully built at 225 where the reference still has empty lots | V1 read as fully built at 225; V2 read as still filling in |

Consistent across all three rounds, and therefore the real remaining gaps: no deep contact shadows between buildings (no ambient-occlusion pass), glass without true reflections, simple box buildings with little roof detail, a straight-segment street grid instead of a few broad curving roads with layered elevated ramps, Voronoi fragments in a ring rather than patches along the roads, and no dotted "dissolve" streaks on the opening wireframes.
