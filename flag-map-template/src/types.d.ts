declare module 'polylabel' {
  const polylabel: (polygon: number[][][], precision?: number) => number[] & {distance: number};
  export default polylabel;
}
