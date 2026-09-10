// Prism is loaded through its "core" entry point so that the automatic
// highlight-on-DOMContentLoaded plugin never runs — we tokenize once
// ourselves. These subpaths ship no types of their own.
declare module "prismjs/components/prism-core" {
  const Prism: typeof import("prismjs");
  export default Prism;
}
declare module "prismjs/components/prism-clike";
declare module "prismjs/components/prism-python";
