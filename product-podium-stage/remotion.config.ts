/**
 * Project-wide render defaults.
 *
 * Note: when rendering through the Node APIs this file does not apply -
 * pass the same options directly to the API instead.
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames, not JPEG.
//
// Remotion writes each video frame to disk before handing it to the encoder,
// and the default is JPEG. That is a lossy step, and it lands on this
// project's output before H.264 ever sees it: measured on look 4's lilac
// field, the JPEG intermediate already shows a 200px flat run with 4% of
// adjacent pixels differing - identical to the final mp4, and unchanged by
// CRF. The in-shader dither that keeps the big gradients from banding does
// not survive it.
//
// Same frame, same measurement, through each pipeline:
//
//     rendered frame (what the post chain produces)    9px   57%
//     JPEG intermediate, any CRF                     200px    4%
//     PNG intermediate, crf 18                       502px    3%
//     PNG intermediate, crf 12                        68px   21%
//
// So both stages matter and neither fix works on its own. PNG costs a little
// more disk and write time per frame; this project is CPU-bound on
// rasterisation, so it is close to free.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);

// WebGL needs a real GL backend in headless Chromium. "angle" picks the
// platform default (a GPU where one exists); "swiftshader" is the CPU
// fallback and is much slower but works on a headless box with no GPU.
Config.setChromiumOpenGlRenderer("angle");

Config.setCodec("h264");

// CRF 12, not the more usual 16.
//
// The post chain dithers every gradient before it is written, which is what
// keeps the large smooth backdrops from banding. H.264 then throws that away:
// x264 quantises low-amplitude noise in flat areas to nothing, and the
// banding the dither existed to prevent comes back in the encode.
//
// Measured on look 4's lilac field - the worst case in the set - as the
// longest run of identical pixel values down a 900px slice, and the
// percentage of adjacent pixels that differ at all:
//
//     source frame (lossless PNG)   9px   57%     <- dither intact
//     h264 crf 18                 506px    3%     <- dither gone, visible bands
//     h264 crf 16                 506px    3%     <- no better than 18
//     h264 crf 16 -tune grain     426px    3%     <- tune=grain does not help
//     h264 crf 12                  43px   27%     <- dither largely survives
//
// 16 is indistinguishable from 18 here, so the usual "16 is the archival
// setting" reasoning does not apply to this content. The dark looks band far
// less (look 3 measures 46px / 45% at crf 18) because there is enough detail
// for the encoder to keep, but the set is delivered at one setting.
Config.setCrf(12);

// Broadcast-range BT.709.
//
// Remotion's frames are full-range RGB, and left alone the encoder tags the
// output yuvj420p / color_range=pc. That is self-consistent, but any tool
// that ignores the range flag - and plenty of players and NLEs do - reads it
// as limited range, crushing the blacks and clipping the highlights. Setting
// the colour space makes the encoder do the range conversion properly and
// emit yuv420p with color_range=tv.
//
// setPixelFormat("yuv420p") alone does NOT achieve this - it leaves the
// full-range tag in place, which is why it is not used here.
Config.setColorSpace("bt709");

// These compositions have no audio by design. Without this, Remotion still
// muxes a silent AAC track into the output.
Config.setMuted(true);

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Reuse it when it is present; on a
// normal machine this path does not exist and Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
