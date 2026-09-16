#!/usr/bin/env node
/**
 * Pulls the native-resolution NASA source imagery into public/textures/.
 *
 * The maps checked into this repo are 4096x2048 mirrors of the same NASA
 * products, which is what was reachable from the sandbox the shot was built
 * in. They are fine for 1080p and hold up at 4K, but NASA publishes Blue
 * Marble at 21600x10800 (and as 21600x21600 tiles), and at that resolution
 * the close-up passes get genuinely sharper. Run this on an unrestricted
 * network and drop the results in place — nothing in the scene code needs to
 * change, the loader just gets a bigger image.
 *
 *   node scripts/fetch-nasa-textures.mjs            # the 21600x10800 set
 *   node scripts/fetch-nasa-textures.mjs --tiles    # also the 21600x21600 tiles
 *
 * All of it is NASA imagery and public domain; credit NASA Earth Observatory
 * (Blue Marble Next Generation — Reto Stöckli; Black Marble — NASA Earth
 * Observatory / Suomi NPP VIIRS).
 */

import { createWriteStream } from "node:fs";
import { mkdir, rename, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "textures");
const EO = "https://eoimages.gsfc.nasa.gov/images/imagerecords";

/**
 * `as` is the filename the scene loads. Where a download replaces one of the
 * committed maps, keep the same name and the composition picks it up.
 */
const ASSETS = [
  {
    as: "earth_daymap_21k.jpg",
    url: `${EO}/73000/73909/world.topo.bathy.200412.3x21600x10800.jpg`,
    page: "https://visibleearth.nasa.gov/images/73909",
    what: "Blue Marble Next Generation, December 2004, topography + bathymetry",
  },
  {
    as: "earth_daymap_8k.jpg",
    url: `${EO}/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg`,
    page: "https://visibleearth.nasa.gov/images/73909",
    what: "Same, 5400x2700 — a smaller fallback if the 21600 file is too heavy",
  },
  {
    as: "earth_clouds_8k.jpg",
    url: `${EO}/57000/57747/cloud_combined_8192.jpg`,
    page: "https://visibleearth.nasa.gov/images/57747",
    what: "Blue Marble cloud composite (no alpha — see the note below)",
  },
  {
    as: "earth_night_13k.jpg",
    url: `${EO}/79000/79765/dnb_land_ocean_ice.2012.13500x6750.jpg`,
    page: "https://visibleearth.nasa.gov/images/79765",
    what: "Earth at Night 2012, Suomi NPP VIIRS day/night band",
  },
  {
    as: "earth_bump_21k.jpg",
    url: `${EO}/73000/73934/gebco_08_rev_elev_21600x10800.png`,
    page: "https://visibleearth.nasa.gov/images/73934",
    what: "GEBCO elevation and bathymetry, used as the relief map",
  },
];

const TILES = ["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2"].map((tile) => ({
  as: `earth_daymap_tile_${tile}.jpg`,
  url: `${EO}/73000/73909/world.topo.bathy.200412.3x21600x21600.${tile}.jpg`,
  page: "https://visibleearth.nasa.gov/images/73909",
  what: `Blue Marble 21600x21600 tile ${tile}`,
}));

const human = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const download = async (asset) => {
  const target = join(OUT, asset.as);
  try {
    const existing = await stat(target);
    console.log(`  skip  ${asset.as} (already here, ${human(existing.size)})`);
    return "skipped";
  } catch {
    // Not downloaded yet.
  }

  const response = await fetch(asset.url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    console.error(`  FAIL  ${asset.as} — HTTP ${response.status} from ${asset.url}`);
    console.error(`        check ${asset.page} for the current filename`);
    return "failed";
  }

  const temp = `${target}.part`;
  await pipeline(response.body, createWriteStream(temp));
  await rename(temp, target);
  const written = await stat(target);
  console.log(`  ok    ${asset.as} (${human(written.size)})`);
  return "downloaded";
};

const main = async () => {
  await mkdir(OUT, { recursive: true });
  const assets = process.argv.includes("--tiles") ? [...ASSETS, ...TILES] : ASSETS;

  console.log(`Fetching ${assets.length} NASA source images into ${OUT}\n`);
  const results = [];
  for (const asset of assets) {
    console.log(`- ${asset.what}`);
    results.push(await download(asset));
  }

  const count = (kind) => results.filter((r) => r === kind).length;
  console.log(
    `\n${count("downloaded")} downloaded, ${count("skipped")} already present, ${count("failed")} failed.`,
  );
  console.log(
    [
      "",
      "Next steps:",
      "  1. Point src/earth/EarthCanvas.tsx's TEXTURE_URLS at the files you want.",
      "  2. The cloud map NASA publishes has no alpha channel — the scene reads",
      "     cloud cover from alpha. Convert it once with any image tool:",
      "     white stays white, alpha = luminance.",
      "  3. Textures above about 16384px need downsizing for WebGPU, whose",
      "     guaranteed maximum texture dimension is 8192.",
    ].join("\n"),
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
