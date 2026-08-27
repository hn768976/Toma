/** Prints the resolved VARIANTS config as JSON, for the packaging script. */
import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'variants-'));
const out = join(tmp, 'variants.mjs');
execFileSync(
	join(root, 'node_modules', '.bin', 'esbuild'),
	[join(root, 'src', 'variants.ts'), '--bundle', '--format=esm', `--outfile=${out}`, '--log-level=error'],
	{stdio: 'inherit'},
);
const {VARIANTS} = await import(`file://${out}`);
process.stdout.write(JSON.stringify(VARIANTS));
rmSync(tmp, {recursive: true, force: true});
