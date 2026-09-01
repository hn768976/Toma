/**
 * JSON imports are bundled by Rspack. They are typed as `unknown` on purpose:
 * letting TypeScript infer the full shape of a 100 kB TopoJSON file makes
 * typechecking crawl, and `geo.ts` narrows it explicitly anyway.
 */
declare module "*.json" {
  const value: unknown;
  export default value;
}
