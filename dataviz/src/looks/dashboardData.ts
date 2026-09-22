import { mulberry32, range } from "../lib/random";
import { seededSeries } from "../lib/series";

/** One shared cycle length for the whole dashboard, so every widget moves together. */
export const N3 = 60;

export const S_BAR_A = seededSeries(101, N3, [1, 2, 3, 6], [1, 0.5, 0.28, 0.14]);
export const S_BAR_B = seededSeries(202, N3, [1, 2, 4, 7], [1, 0.46, 0.3, 0.16]);
export const S_LINE = seededSeries(303, N3, [1, 3, 5], [1, 0.4, 0.2]);
export const S_AREA_A = seededSeries(404, N3, [1, 2, 5, 9], [1, 0.55, 0.3, 0.18]);
export const S_AREA_B = seededSeries(505, N3, [1, 3, 6, 11], [1, 0.48, 0.26, 0.15]);
export const S_GAUGE = [
  seededSeries(606, N3, [1, 2], [1, 0.35]),
  seededSeries(707, N3, [1, 3], [1, 0.3]),
  seededSeries(808, N3, [1, 2, 4], [1, 0.4, 0.2]),
];
export const S_METER = [
  seededSeries(909, N3, [1, 2], [1, 0.4]),
  seededSeries(1010, N3, [1, 3], [1, 0.35]),
  seededSeries(1111, N3, [1, 2, 5], [1, 0.4, 0.2]),
  seededSeries(1212, N3, [1, 4], [1, 0.3]),
];
export const S_DONUT = [
  seededSeries(1313, N3, [1], [1]),
  seededSeries(1414, N3, [1], [1]),
  seededSeries(1515, N3, [2], [1]),
  seededSeries(1616, N3, [1], [1]),
];

/** Binary block: fixed rows, scrolled by an integer number of lines. */
export const BIN_ROWS = (() => {
  const rnd = mulberry32(240001);
  return Array.from({ length: 72 }, () =>
    Array.from({ length: 11 }, () => (rnd() > 0.5 ? "1" : "0")).join(""),
  );
})();

/**
 * Placeholder log lines for the monospace panel. Deliberately generic —
 * no product, company, language or domain that would tie the clip to a market.
 */
export const CODE_ROWS = (() => {
  const rnd = mulberry32(777001);
  const heads = [
    "series.load(range)",
    "window.advance(1)",
    "metric.a = sample()",
    "metric.b = sample()",
    "buffer.flush()",
    "node.sync(group)",
    "index.rebuild()",
    "batch.commit()",
    "queue.drain(n)",
    "cache.warm(key)",
  ];
  return Array.from({ length: 40 }, (_, i) => ({
    head: heads[i % heads.length],
    val: Math.floor(range(rnd, 1000, 9999)),
    ok: rnd() > 0.22,
  }));
})();

/** Placeholder ticker digits used in look 5. */
export const numberColumn = (seed: number, rows: number, digits: number) => {
  const rnd = mulberry32(seed);
  return Array.from({ length: rows }, () =>
    String(Math.floor(range(rnd, Math.pow(10, digits - 1), Math.pow(10, digits) - 1))),
  );
};
