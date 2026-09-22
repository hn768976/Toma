/**
 * Exactly-one-occurrence string replacement for three's shader chunks.
 *
 * Silent misses are the failure mode that matters: half a patch leaves a
 * reference to an undeclared variable, the program fails to link, and the
 * object renders black with nothing in the console. Two things cause them —
 * a needle spanning a blank line (three ships a readable source tree and a
 * build with blank lines stripped, and they do not match the same needle),
 * and a needle that appears twice. Both throw here instead.
 */
export const replaceOnce = (
  source: string,
  find: string,
  replacement: string,
  label: string,
): string => {
  if (find.includes("\n\n")) {
    throw new Error(
      `shader patch (${label}): needles must not span a blank line — ` +
        `three's build strips them and the match would depend on which copy is bundled.`,
    );
  }
  const first = source.indexOf(find);
  if (first === -1) {
    throw new Error(
      `shader patch (${label}): needle not found in three's shader source. ` +
        `Check the pinned three version.`,
    );
  }
  if (source.indexOf(find, first + find.length) !== -1) {
    throw new Error(`shader patch (${label}): needle matched more than once; the patch is ambiguous.`);
  }
  return source.slice(0, first) + replacement + source.slice(first + find.length);
};
