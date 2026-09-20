#!/usr/bin/env node
/**
 * Builds the deliverable project archive.
 *
 * Ships the source, config and docs — everything needed to re-render the 4K
 * masters — and deliberately leaves out node_modules and out/, which are
 * reproducible from package-lock.json and the render scripts.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const name = path.basename(root);
const outDir = path.join(root, 'out');
const zipPath = path.join(outDir, `${name}.zip`);

const INCLUDE = [
  'src',
  'scripts',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'remotion.config.ts',
  'remotion.config.ts',
  'README.md',
  '.gitignore',
];

fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(zipPath, { force: true });

const entries = [...new Set(INCLUDE)].filter((p) => fs.existsSync(path.join(root, p)));

execFileSync(
  'zip',
  ['-r', '-q', '-X', zipPath, ...entries, '-x', '*/out/*', '*/node_modules/*', '*.log'],
  { cwd: root, stdio: 'inherit' },
);

const size = fs.statSync(zipPath).size;
console.log(`[package] ${zipPath} (${(size / 1024).toFixed(0)} KB)`);
