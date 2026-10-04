declare module "polylabel" {
  export default function polylabel(polygon: number[][][], precision?: number, debug?: boolean): number[] & { distance: number };
}
interface FontFaceSet {
  add(font: FontFace): FontFaceSet;
}
