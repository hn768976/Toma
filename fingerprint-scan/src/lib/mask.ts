/**
 * The print mask, built once from public/fingerprint.png.
 *
 * The source PNG is a black-on-white fingerprint. The shared library turns its
 * pixels into an alpha channel — dark ridge pixels opaque, white background
 * transparent — and everything downstream draws the ridges in the palette's
 * colour through that mask. The source image's own black is never shown.
 */
import { staticFile } from "remotion";
import { useBitmapMask, type BitmapMask } from "../shared/bitmapMask";
import { PRINT_HEIGHT, PRINT_WIDTH } from "../layout";

export type PrintMask = BitmapMask;

export const usePrintMask = (): PrintMask | null =>
  useBitmapMask(staticFile("fingerprint.png"), PRINT_WIDTH, PRINT_HEIGHT);
