/**
 * Writes the resolved per-country values back into src/countries.ts.
 *
 *   npx tsx scripts/sync-country-data.ts
 *
 * The builder can derive a city list and a name position for a country that
 * does not specify them. This makes those choices explicit and reviewable in the
 * data file, so what ships is something somebody can read and edit rather than
 * the output of a ranking function — and so no entry is left relying on a
 * default nobody looked at.
 *
 * Run it after `build:assets`, then build again: the result is identical,
 * because the values resolve to what the builder already chose.
 */

import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGIONS = path.join(ROOT, 'src', 'data', 'regions');
const COUNTRIES_TS = path.join(ROOT, 'src', 'countries.ts');

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** Wrap the name list at ~76 columns, indented to sit inside the entry. */
const formatCities = (names: string[]): string => {
  const lines: string[] = [];
  let line = '';
  for (const n of names) {
    const piece = `${quote(n)}, `;
    if (line.length + piece.length > 68) {
      lines.push(line.trimEnd());
      line = '';
    }
    line += piece;
  }
  if (line.trim()) lines.push(line.trimEnd().replace(/,$/, ','));
  return `    cities: [\n${lines.map((l) => `      ${l}`).join('\n')}\n    ],`;
};

const main = () => {
  const byCode = new Map<string, {cities: string[]; namePosition: [number, number]}>();
  for (const f of readdirSync(REGIONS).filter((x) => x.endsWith('.json'))) {
    const region = JSON.parse(readFileSync(path.join(REGIONS, f), 'utf8'));
    // The candidate shortlist, not the placed subset: a city crowded out by one
    // layout should still be a candidate for the next one.
    const names: string[] =
      (region.cityCandidates as string[] | undefined) ??
      (region.cities as {name: string}[]).map((c) => c.name);
    byCode.set(region.code, {
      cities: names,
      namePosition: region.namePosition as [number, number],
    });
  }

  let src = readFileSync(COUNTRIES_TS, 'utf8');
  let updated = 0;

  for (const [code, resolved] of byCode) {
    const names = resolved.cities;
    if (!names.length) continue;
    const anchor = `    code: '${code}',`;
    const start = src.indexOf(anchor);
    if (start === -1) {
      console.warn(`  ${code}: no entry in countries.ts`);
      continue;
    }
    const entryEnd = src.indexOf('\n  },', start);
    const entry = src.slice(start, entryEnd);
    const block = formatCities(names);

    const existing = entry.match(/\n {4}cities: \[[\s\S]*?\n {4}\],/);
    let next: string;
    if (existing) {
      next = entry.replace(existing[0], `\n${block}`);
    } else {
      // Insert after displayName when there is one, otherwise after code.
      const afterName = entry.match(/\n {4}displayName: '[^']*',/);
      const insertAfter = afterName ? afterName[0] : anchor;
      next = entry.replace(insertAfter, `${insertAfter}\n${block}`);
    }

    // The name position, normalised within the framed body's bounding box.
    const np = resolved.namePosition;
    if (np) {
      const npLine = `    namePosition: [${np[0]}, ${np[1]}],`;
      const hasNp = next.match(/\n {4}namePosition: \[[^\]]*\],/);
      if (hasNp) {
        next = next.replace(hasNp[0], `\n${npLine}`);
      } else {
        const afterCities = next.match(/\n {4}cities: \[[\s\S]*?\n {4}\],/);
        const at = afterCities ? afterCities[0] : anchor;
        next = next.replace(at, `${at}\n${npLine}`);
      }
    }
    if (next !== entry) {
      src = src.slice(0, start) + next + src.slice(entryEnd);
      updated++;
    }
  }

  writeFileSync(COUNTRIES_TS, src);
  console.log(`Wrote city lists and name positions for ${updated} countries into src/countries.ts.`);
};

main();
