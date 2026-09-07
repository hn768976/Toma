import {existsSync, readdirSync} from 'node:fs';
import {join} from 'node:path';

/**
 * Remotion downloads its own Chrome Headless Shell on first render. If that
 * download is not possible (offline or restricted egress), point
 * REMOTION_BROWSER_EXECUTABLE at any Chromium build and both scripts will use
 * it. Returns undefined to let Remotion pick its own.
 */
export const resolveBrowser = (): string | undefined => {
  const fromEnv =
    process.env.REMOTION_BROWSER_EXECUTABLE ?? process.env.CHROME_EXECUTABLE;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const roots = ['/opt/pw-browsers', join(process.cwd(), 'node_modules', '.remotion')];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const stack = [root];
    let depth = 0;
    while (stack.length && depth < 4000) {
      depth += 1;
      const dir = stack.pop() as string;
      let entries;
      try {
        entries = readdirSync(dir, {withFileTypes: true});
      } catch {
        continue;
      }
      for (const e of entries) {
        const p = join(dir, e.name);
        if (e.isDirectory()) stack.push(p);
        else if (e.name === 'headless_shell' || e.name === 'chrome-headless-shell') return p;
      }
    }
  }
  return undefined;
};
