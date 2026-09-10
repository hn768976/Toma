/**
 * Single source of truth for all twelve signs.
 *
 * Everything a composition needs lives here: the glyph outline, the
 * constellation behind it, the date range and the per-sign framing tweak.
 * A labelled or alternate-colour variant is a prop on <ZodiacSymbol>, not a
 * code change in here.
 *
 * GLYPH ARTWORK
 * -------------
 * The glyphs are original SVG paths authored for this project, drawn on a
 * nominal 100x100 grid and stroked (never filled) so the metal gradient runs
 * along the stroke. They are deliberately NOT font characters: a missing or
 * substituted typeface on a render machine would silently change all twelve.
 * The zodiac glyphs themselves are ancient public-domain symbols; the pictorial
 * figures used by most stock clips are somebody's illustration and are not
 * reproduced here.
 *
 * CONSTELLATION DATA
 * ------------------
 * Star positions are derived from the published right ascension / declination
 * of each constellation's named stars, linearly projected into the same
 * 100x100 grid (right ascension increasing to the left, as on a sky chart).
 * `mag` is the star's apparent visual magnitude - lower is brighter - and
 * drives both dot size and opacity. Star positions and magnitudes are facts.
 */

export type Star = {
  /** x on the 0-100 grid, right ascension increasing leftwards. */
  x: number;
  /** y on the 0-100 grid, declination increasing upwards. */
  y: number;
  /** Apparent visual magnitude. Lower is brighter. */
  mag: number;
};

export type Constellation = {
  stars: Star[];
  /** Index pairs into `stars`, drawn as hairlines. */
  lines: [number, number][];
};

export type Sign = {
  /** Composition id suffix and output filename stem, e.g. "Aries". */
  name: string;
  /** The Unicode glyph. Reference only - never rendered as text. */
  char: string;
  /** Inclusive date range, for labelled variants. */
  dates: { from: string; to: string };
  /** Original stroked SVG paths on the nominal 100x100 grid. */
  paths: string[];
  constellation: Constellation;
  /**
   * Per-sign optical framing correction, applied on top of the shared
   * "fit the artwork to 0.45 x frame height" rule. 1 = no correction.
   * These are hand-set after looking at every composition; glyphs vary a lot
   * in proportion and a purely mechanical fit leaves some reading heavy and
   * some weightless.
   */
  opticalScale: number;
  /** Optical centring nudge, in grid units, applied after the fit. */
  opticalOffset?: { x?: number; y?: number };
};

export const SIGNS: Sign[] = [
  {
    name: 'Aries',
    char: '♈',
    dates: { from: 'Mar 21', to: 'Apr 19' },
    paths: [
      'M18 68 C8 46 14 24 31 24 C45 24 50 38 50 52 L50 82',
      'M82 68 C92 46 86 24 69 24 C55 24 50 38 50 52',
    ],
    constellation: {
      // 41 Ari, Hamal, Sheratan, Mesarthim
      stars: [
        { x: 20, y: 25, mag: 3.6 },
        { x: 73, y: 51, mag: 2.0 },
        { x: 88, y: 70, mag: 2.6 },
        { x: 90, y: 80, mag: 3.9 },
      ],
      lines: [
        [0, 1],
        [1, 2],
        [2, 3],
      ],
    },
    opticalScale: 1,
  },
  {
    name: 'Taurus',
    char: '♉',
    dates: { from: 'Apr 20', to: 'May 20' },
    paths: [
      // Disc.
      'M30 66 A20 20 0 1 1 70 66 A20 20 0 1 1 30 66 Z',
      // Horns, opening upwards, seated on the disc.
      'M24 22 C24 42 38 47 50 47 C62 47 76 42 76 22',
    ],
    constellation: {
      // zeta, beta (Elnath), epsilon, delta, Aldebaran, theta, gamma, lambda
      stars: [
        { x: 12, y: 49, mag: 3.0 },
        { x: 22, y: 20, mag: 1.65 },
        { x: 66, y: 56, mag: 3.53 },
        { x: 71, y: 63, mag: 3.76 },
        { x: 60, y: 67, mag: 0.85 },
        { x: 66, y: 69, mag: 3.4 },
        { x: 73, y: 70, mag: 3.65 },
        { x: 88, y: 82, mag: 3.4 },
      ],
      lines: [
        [1, 2],
        [2, 3],
        [3, 6],
        [6, 5],
        [5, 4],
        [4, 0],
        [6, 7],
      ],
    },
    // Narrow for its height, so it is given a little back.
    opticalScale: 1.04,
  },
  {
    name: 'Gemini',
    char: '♊',
    dates: { from: 'May 21', to: 'Jun 20' },
    paths: [
      'M36 24 L36 76',
      'M64 24 L64 76',
      'M26 31 C34 20 66 20 74 31',
      'M26 69 C34 80 66 80 74 69',
    ],
    constellation: {
      // Pollux, Castor, delta, epsilon, mu, eta, zeta, gamma (Alhena), xi
      stars: [
        { x: 14, y: 34, mag: 1.14 },
        { x: 23, y: 22, mag: 1.58 },
        { x: 35, y: 52, mag: 3.5 },
        { x: 66, y: 43, mag: 3.0 },
        { x: 83, y: 51, mag: 2.9 },
        { x: 90, y: 51, mag: 3.3 },
        { x: 49, y: 56, mag: 3.9 },
        { x: 71, y: 69, mag: 1.9 },
        { x: 65, y: 80, mag: 3.35 },
      ],
      lines: [
        [0, 1],
        [1, 3],
        [3, 4],
        [4, 5],
        [0, 2],
        [2, 6],
        [6, 7],
        [7, 8],
      ],
    },
    // Tall and narrow; a touch of size keeps it level with the set.
    opticalScale: 1.03,
  },
  {
    name: 'Cancer',
    char: '♋',
    dates: { from: 'Jun 21', to: 'Jul 22' },
    paths: [
      'M16 44 C18 28 42 20 70 26',
      'M85 34 A9 9 0 1 1 67 34 A9 9 0 1 1 85 34 Z',
      'M84 56 C82 72 58 80 30 74',
      'M15 66 A9 9 0 1 1 33 66 A9 9 0 1 1 15 66 Z',
    ],
    constellation: {
      // beta, delta, gamma, iota, alpha (Acubens)
      stars: [
        { x: 88, y: 80, mag: 3.5 },
        { x: 39, y: 52, mag: 3.9 },
        { x: 40, y: 42, mag: 4.66 },
        { x: 34, y: 20, mag: 4.0 },
        { x: 14, y: 72, mag: 4.25 },
      ],
      lines: [
        [0, 1],
        [1, 2],
        [2, 3],
        [1, 4],
      ],
    },
    opticalScale: 0.98,
  },
  {
    name: 'Leo',
    char: '♌',
    dates: { from: 'Jul 23', to: 'Aug 22' },
    paths: [
      'M45 66 A13 13 0 1 1 19 66 A13 13 0 1 1 45 66 Z',
      'M41 56 C48 38 54 24 68 24 C82 24 88 36 84 50 C81 58 78 63 74 67',
    ],
    constellation: {
      // Denebola, delta (Zosma), theta, Algieba, zeta, eta, Regulus, mu, epsilon
      stars: [
        { x: 12, y: 68, mag: 2.14 },
        { x: 33, y: 44, mag: 2.56 },
        { x: 33, y: 64, mag: 3.33 },
        { x: 67, y: 47, mag: 2.0 },
        { x: 69, y: 32, mag: 3.44 },
        { x: 75, y: 59, mag: 3.5 },
        { x: 74, y: 78, mag: 1.35 },
        { x: 84, y: 22, mag: 3.88 },
        { x: 88, y: 31, mag: 2.98 },
      ],
      lines: [
        [6, 5],
        [5, 3],
        [3, 4],
        [4, 7],
        [7, 8],
        [6, 2],
        [2, 1],
        [1, 0],
        [0, 2],
        [1, 3],
      ],
    },
    opticalScale: 1,
  },
  {
    name: 'Virgo',
    char: '♍',
    dates: { from: 'Aug 23', to: 'Sep 22' },
    paths: [
      'M16 74 L16 40 C16 26 34 26 34 40 L34 74',
      'M34 40 C34 26 52 26 52 40 L52 62 C52 74 60 82 70 80 C79 78 82 68 76 61 C70 54 56 56 46 70',
    ],
    constellation: {
      // beta, eta, Porrima, delta, Vindemiatrix, Spica, zeta, iota, mu
      stars: [
        { x: 90, y: 46, mag: 3.6 },
        { x: 77, y: 53, mag: 3.89 },
        { x: 67, y: 55, mag: 2.74 },
        { x: 61, y: 42, mag: 3.38 },
        { x: 58, y: 22, mag: 2.83 },
        { x: 47, y: 80, mag: 0.98 },
        { x: 43, y: 52, mag: 3.38 },
        { x: 24, y: 66, mag: 4.08 },
        { x: 12, y: 66, mag: 3.87 },
      ],
      lines: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [2, 5],
        [3, 6],
        [6, 5],
        [5, 7],
        [7, 8],
      ],
    },
    opticalScale: 1,
  },
  {
    name: 'Libra',
    char: '♎',
    dates: { from: 'Sep 23', to: 'Oct 22' },
    paths: [
      'M16 74 L84 74',
      'M16 54 L32 54 A18 18 0 0 1 68 54 L84 54',
    ],
    constellation: {
      // Zubenelgenubi, sigma, Zubeneschamali, gamma, upsilon, tau
      stars: [
        { x: 88, y: 39, mag: 2.75 },
        { x: 67, y: 65, mag: 3.29 },
        { x: 47, y: 20, mag: 2.61 },
        { x: 17, y: 36, mag: 3.91 },
        { x: 15, y: 73, mag: 3.6 },
        { x: 12, y: 78, mag: 3.66 },
      ],
      lines: [
        [0, 2],
        [2, 3],
        [3, 0],
        [0, 1],
        [1, 5],
        [3, 4],
      ],
    },
    // Very wide for its height: fitting the height alone lets it out-weigh
    // the compact signs, so it is held back slightly.
    opticalScale: 0.97,
  },
  {
    name: 'Scorpio',
    char: '♏',
    dates: { from: 'Oct 23', to: 'Nov 21' },
    paths: [
      'M16 74 L16 40 C16 26 34 26 34 40 L34 74',
      'M34 40 C34 26 52 26 52 40 L52 66 C52 76 60 82 70 78 L86 62',
      'M86 74 L86 62 L74 62',
    ],
    constellation: {
      // beta, delta, pi, sigma, Antares, tau, epsilon, mu, zeta, eta, theta,
      // iota, kappa, lambda (Shaula), upsilon
      stars: [
        { x: 86, y: 18, mag: 2.56 },
        { x: 89, y: 27, mag: 2.29 },
        { x: 90, y: 36, mag: 2.89 },
        { x: 74, y: 34, mag: 2.9 },
        { x: 68, y: 37, mag: 1.06 },
        { x: 63, y: 42, mag: 2.82 },
        { x: 53, y: 59, mag: 2.29 },
        { x: 52, y: 69, mag: 3.0 },
        { x: 50, y: 81, mag: 3.62 },
        { x: 37, y: 84, mag: 3.32 },
        { x: 20, y: 83, mag: 1.86 },
        { x: 12, y: 75, mag: 3.03 },
        { x: 16, y: 72, mag: 2.39 },
        { x: 22, y: 67, mag: 1.62 },
        { x: 24, y: 67, mag: 2.7 },
      ],
      lines: [
        [0, 1],
        [1, 2],
        [1, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 8],
        [8, 9],
        [9, 10],
        [10, 11],
        [11, 12],
        [12, 13],
        [13, 14],
      ],
    },
    opticalScale: 0.98,
  },
  {
    name: 'Sagittarius',
    char: '♐',
    dates: { from: 'Nov 22', to: 'Dec 21' },
    paths: [
      'M20 80 L78 22',
      'M56 22 L78 22 L78 44',
      'M31 51 L49 69',
    ],
    constellation: {
      // The Teapot: gamma, eta, delta, epsilon, lambda, phi, sigma, zeta,
      // tau, pi
      stars: [
        { x: 88, y: 55, mag: 2.98 },
        { x: 74, y: 78, mag: 3.11 },
        { x: 70, y: 52, mag: 2.7 },
        { x: 66, y: 69, mag: 1.85 },
        { x: 61, y: 36, mag: 2.81 },
        { x: 39, y: 42, mag: 3.17 },
        { x: 29, y: 39, mag: 2.05 },
        { x: 21, y: 53, mag: 2.6 },
        { x: 16, y: 45, mag: 3.32 },
        { x: 12, y: 20, mag: 2.89 },
      ],
      lines: [
        [0, 2],
        [2, 3],
        [3, 1],
        [2, 4],
        [4, 5],
        [5, 6],
        [6, 8],
        [8, 7],
        [7, 5],
        [7, 3],
        [6, 9],
      ],
    },
    // A square diagonal, which reads smaller than a square of the same
    // height.
    opticalScale: 1.02,
  },
  {
    name: 'Capricorn',
    char: '♑',
    dates: { from: 'Dec 22', to: 'Jan 19' },
    paths: [
      'M14 28 C19 34 22 43 25 53 L31 72 L41 32 C44 23 52 21 60 26 C70 32 74 45 71 56 C68 66 58 72 49 70 C42 68 39 62 42 56 C45 50 53 50 58 56',
    ],
    constellation: {
      // alpha (Algedi), beta (Dabih), psi, omega, theta, zeta, iota, gamma,
      // delta (Deneb Algedi)
      stars: [
        { x: 88, y: 22, mag: 3.57 },
        { x: 85, y: 31, mag: 3.05 },
        { x: 64, y: 72, mag: 4.13 },
        { x: 59, y: 78, mag: 4.11 },
        { x: 47, y: 41, mag: 4.07 },
        { x: 30, y: 60, mag: 3.74 },
        { x: 33, y: 39, mag: 4.27 },
        { x: 18, y: 38, mag: 3.68 },
        { x: 12, y: 36, mag: 2.85 },
      ],
      lines: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 5],
        [5, 8],
        [8, 7],
        [7, 6],
        [6, 4],
        [4, 0],
      ],
    },
    opticalScale: 1.02,
  },
  {
    name: 'Aquarius',
    char: '♒',
    dates: { from: 'Jan 20', to: 'Feb 18' },
    paths: [
      'M12 42 L24 32 L36 42 L48 32 L60 42 L72 32 L84 42',
      'M12 66 L24 56 L36 66 L48 56 L60 66 L72 56 L84 66',
    ],
    constellation: {
      // epsilon, Sadalsuud, Sadalmelik, Sadachbia, zeta, eta, lambda, tau,
      // Skat, phi
      stars: [
        { x: 88, y: 55, mag: 3.77 },
        { x: 65, y: 40, mag: 2.87 },
        { x: 47, y: 21, mag: 2.94 },
        { x: 39, y: 25, mag: 3.84 },
        { x: 36, y: 20, mag: 3.65 },
        { x: 32, y: 20, mag: 4.02 },
        { x: 24, y: 48, mag: 3.73 },
        { x: 25, y: 70, mag: 4.05 },
        { x: 25, y: 78, mag: 3.27 },
        { x: 12, y: 42, mag: 4.22 },
      ],
      lines: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [2, 6],
        [6, 7],
        [7, 8],
        [6, 9],
      ],
    },
    // Widest glyph in the set - the same correction as Libra, a little
    // stronger.
    opticalScale: 0.94,
  },
  {
    name: 'Pisces',
    char: '♓',
    dates: { from: 'Feb 19', to: 'Mar 20' },
    paths: [
      'M26 20 C40 30 40 70 26 80',
      'M74 20 C60 30 60 70 74 80',
      'M14 50 L86 50',
    ],
    constellation: {
      // The Circlet (gamma, theta, iota, lambda, kappa) and the two cords out
      // to Alrescha, then north to eta.
      stars: [
        { x: 88, y: 70, mag: 3.7 },
        { x: 83, y: 58, mag: 4.28 },
        { x: 78, y: 61, mag: 4.13 },
        { x: 76, y: 76, mag: 4.5 },
        { x: 83, y: 78, mag: 4.94 },
        { x: 68, y: 56, mag: 4.03 },
        { x: 46, y: 53, mag: 4.43 },
        { x: 40, y: 52, mag: 4.27 },
        { x: 27, y: 60, mag: 4.84 },
        { x: 22, y: 62, mag: 4.44 },
        { x: 16, y: 70, mag: 4.61 },
        { x: 12, y: 72, mag: 3.82 },
        { x: 20, y: 47, mag: 4.26 },
        { x: 27, y: 22, mag: 3.62 },
      ],
      lines: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 0],
        [0, 5],
        [5, 6],
        [6, 7],
        [7, 8],
        [8, 9],
        [9, 10],
        [10, 11],
        [11, 12],
        [12, 13],
      ],
    },
    opticalScale: 1,
  },
];

export const SIGN_BY_NAME: Record<string, Sign> = Object.fromEntries(
  SIGNS.map((s) => [s.name, s]),
);
