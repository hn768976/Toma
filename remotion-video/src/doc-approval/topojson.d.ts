// Typed as `unknown` on purpose: letting `resolveJsonModule` infer a
// structural type for a 55 KB coordinate array makes typechecking crawl.
// `geo.ts` casts it to the topojson Topology type it actually is.
declare module "*.topo.json" {
  const value: unknown;
  export default value;
}
