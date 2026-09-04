/**
 * react-three-fiber v9 no longer augments the global JSX namespace on import;
 * with React 19's own JSX types the host elements have to be declared here.
 */
import type { ThreeElements } from "@react-three/fiber";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
