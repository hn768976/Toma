/**
 * Lets `node --experimental-strip-types` follow the project's extensionless
 * relative imports (`./color` -> `./color.ts`). Used only by the verify script.
 */
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context);
      } catch {
        // fall through to the default resolution below
      }
    }
    return nextResolve(specifier, context);
  },
});
