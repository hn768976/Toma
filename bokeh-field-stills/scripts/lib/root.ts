import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Walks up from the working directory to the project root. Resolved at
 * runtime rather than from `import.meta.dirname`, which is undefined when the
 * scripts are transpiled to CommonJS by tsx.
 */
export const findRoot = (): string => {
  let directory = process.cwd();
  for (let depth = 0; depth < 8; depth++) {
    if (existsSync(path.join(directory, "remotion.config.ts"))) return directory;
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error("Could not find the project root (no remotion.config.ts above the working directory).");
};
