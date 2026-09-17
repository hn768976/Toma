/**
 * Builds waving-flag-project.zip — the 4K-render-ready project.
 * Excludes node_modules, rendered output and caches; includes the generated
 * textures so a clean copy renders without a network round trip.
 */
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {existsSync, rmSync} from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '..', 'waving-flag-project.zip');
if (existsSync(out)) rmSync(out);

execFileSync(
  'zip',
  [
    '-r', '-q', out, 'waving-flag',
    '-x', 'waving-flag/node_modules/*',
    '-x', 'waving-flag/out/*',
    '-x', 'waving-flag/.remotion/*',
    '-x', 'waving-flag/**/.DS_Store',
  ],
  {cwd: join(root, '..'), stdio: 'inherit'},
);
console.log(`wrote ${out}`);
