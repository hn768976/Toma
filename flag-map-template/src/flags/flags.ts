// Flags drawn in code from their official construction sheets, plus the few
// flags with complex emblems that are taken from public-domain Wikimedia
// Commons SVGs (see FLAG_SOURCES.md). Every flag is an SVG string with its
// official proportions; nothing is cropped here. Cropping happens only when
// the flag is mapped onto a shape (see scene/topTexture.ts).

export type FlagDef = {
  /** Official proportions, width : height. */
  w: number;
  h: number;
  /** Main colour, used (darkened) for the side walls of the extrusion. */
  main: string;
  source: 'code' | 'wikimedia';
  /** Inline SVG for code-drawn flags. */
  svg?: string;
  /** File under public/ for Wikimedia flags. */
  file?: string;
};

const f = (n: number) => +n.toFixed(4);

/** Regular star polygon with `n` points, first point straight up, rotated `rot` degrees clockwise. */
export const starPoints = (cx: number, cy: number, R: number, r: number, n: number, rot = 0) => {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    pts.push(`${f(cx + rad * Math.sin(a))},${f(cy - rad * Math.cos(a))}`);
  }
  return pts.join(' ');
};
const star = (cx: number, cy: number, R: number, r: number, n: number, fill: string, rot = 0) =>
  `<polygon fill="${fill}" points="${starPoints(cx, cy, R, r, n, rot)}"/>`;
/** Inner radius of a regular five-pointed star (pentagram outline). */
const PENTA = 0.381966;

const svg = (vbW: number, vbH: number, body: string, vbX = 0, vbY = 0) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${vbW}" height="${vbH}">${body}</svg>`;

const hBands = (w: number, h: number, colors: string[]) =>
  svg(w, h, colors.map((c, i) => `<rect x="0" y="${f((i * h) / colors.length)}" width="${w}" height="${f(h / colors.length + 0.01)}" fill="${c}"/>`).join(''));
const vBands = (w: number, h: number, colors: string[]) =>
  svg(w, h, colors.map((c, i) => `<rect y="0" x="${f((i * w) / colors.length)}" height="${h}" width="${f(w / colors.length + 0.01)}" fill="${c}"/>`).join(''));

// ---------------------------------------------------------------- EU
// Council of Europe / EU graphic specification: 3:2, 12 stars on a circle of
// radius 1/3 of the hoist, each star's outer radius 1/18 of the hoist, upright.
const euFlag = () => {
  const H = 540;
  const W = 810;
  let stars = '';
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6;
    stars += star(W / 2 + (H / 3) * Math.sin(a), H / 2 - (H / 3) * Math.cos(a), H / 18, (H / 18) * PENTA, 5, '#FFCC00');
  }
  return svg(W, H, `<rect width="${W}" height="${H}" fill="#003399"/>${stars}`);
};

// ---------------------------------------------------------------- USA
// Executive Order 10834: A=1 (hoist), B=1.9, C=7/13, D=0.76, E=F=0.054,
// G=H=0.063, K=0.0616, L=1/13. Units of 1/1000 hoist.
const usaFlag = () => {
  const A = 1000;
  const B = 1900;
  const L = A / 13;
  let body = `<rect width="${B}" height="${A}" fill="#FFFFFF"/>`;
  for (let i = 0; i < 13; i += 2) body += `<rect x="0" y="${f(i * L)}" width="${B}" height="${f(L)}" fill="#B22234"/>`;
  body += `<rect x="0" y="0" width="760" height="${f(7 * L)}" fill="#3C3B6E"/>`;
  const R = 61.6 / 2;
  for (let row = 0; row < 9; row++) {
    const y = 54 + row * 54;
    const count = row % 2 === 0 ? 6 : 5;
    const x0 = row % 2 === 0 ? 63 : 126;
    for (let c = 0; c < count; c++) body += star(x0 + c * 126, y, R, R * PENTA, 5, '#FFFFFF');
  }
  return svg(B, A, body);
};

// ---------------------------------------------------------------- China
// GB 12982-2004: 30x20 grid; large star r=3 at (5,5); small stars r=1 at
// (10,2) (12,4) (12,7) (10,9), each with one point aimed at the large star's centre.
const chinaFlag = () => {
  let body = `<rect width="30" height="20" fill="#EE1C25"/>` + star(5, 5, 3, 3 * PENTA, 5, '#FFFF00');
  for (const [x, y] of [
    [10, 2],
    [12, 4],
    [12, 7],
    [10, 9],
  ]) {
    const rot = (Math.atan2(5 - y, 5 - x) * 180) / Math.PI + 90;
    body += star(x, y, 1, PENTA, 5, '#FFFF00', rot);
  }
  return svg(30, 20, body);
};

// ---------------------------------------------------------------- Japan
// Act on National Flag and Anthem (1999): 2:3, disc diameter 3/5 of hoist, centred.
const japanFlag = () => svg(3, 2, `<rect width="3" height="2" fill="#FFFFFF"/><circle cx="1.5" cy="1" r="0.6" fill="#BC002D"/>`);

// ---------------------------------------------------------------- United Kingdom
// Union Flag 1:2 (the standard counterchanged construction on a 60x30 grid).
const unionJack = (red: string, id: string) =>
  `<clipPath id="s${id}"><path d="M0,0 v30 h60 v-30 z"/></clipPath>` +
  `<clipPath id="t${id}"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>` +
  `<g clip-path="url(#s${id})"><path d="M0,0 v30 h60 v-30 z" fill="#012169"/>` +
  `<path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" stroke-width="6"/>` +
  `<path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#t${id})" stroke="${red}" stroke-width="4"/>` +
  `<path d="M30,0 v30 M0,15 h60" stroke="#FFFFFF" stroke-width="10"/>` +
  `<path d="M30,0 v30 M0,15 h60" stroke="${red}" stroke-width="6"/></g>`;
const ukFlag = () => svg(60, 30, unionJack('#C8102E', 'uk'));

// ---------------------------------------------------------------- India
// IS 1:1968 / Flag Code of India: 3:2, three equal bands; Ashoka Chakra in
// navy, 24 spokes, centred in the white band.
const indiaFlag = () => {
  let chakra = `<circle r="20" fill="#000080"/><circle r="17.5" fill="#FFFFFF"/><circle r="3.5" fill="#000080"/>`;
  for (let k = 0; k < 24; k++) {
    chakra += `<path d="M0,17.5 L0.6,7 L0,2 L-0.6,7 Z" fill="#000080" transform="rotate(${k * 15})"/>`;
    chakra += `<circle cx="0" cy="17.5" r="0.875" fill="#000080" transform="rotate(${k * 15 + 7.5})"/>`;
  }
  return svg(
    225,
    150,
    `<rect width="225" height="50" fill="#FF9933"/><rect y="50" width="225" height="50" fill="#FFFFFF"/>` +
      `<rect y="100" width="225" height="50" fill="#138808"/><g transform="translate(112.5,75)">${chakra}</g>`,
  );
};

// ---------------------------------------------------------------- South Korea
// Flag Act of the Republic of Korea: 3:2; taegeuk diameter 1/2 of hoist;
// trigrams 1/2 diameter long, bars 1/12 diameter thick, gaps 1/24 diameter,
// 1/4 diameter from the circle, on the diagonals.
const koreaFlag = () =>
  svg(
    72,
    48,
    `<rect x="-36" y="-24" width="72" height="48" fill="#FFFFFF"/>` +
      `<g transform="rotate(-56.3099325)">` +
      `<path d="M-6,-26h12v2h-12zM-6,-23h12v2h-12zM-6,-20h12v2h-12zM-6,18h12v2h-12zM-6,21h12v2h-12zM-6,24h12v2h-12z" fill="#000000"/>` +
      `<path d="M0,17v10" stroke="#FFFFFF" stroke-width="1"/>` +
      `<path d="M0,-12A12,12 0 0 1 0,12z" fill="#CD2E3A"/>` +
      `<path d="M0,-12A12,12 0 0 0 0,12A6,6 0 0 0 0,0z" fill="#0047A0"/>` +
      `<circle cx="0" cy="-6" r="6" fill="#CD2E3A"/></g>` +
      `<g transform="rotate(-123.6900675)">` +
      `<path d="M-6,-26h12v2h-12zM-6,-23h12v2h-12zM-6,-20h12v2h-12zM-6,18h12v2h-12zM-6,21h12v2h-12zM-6,24h12v2h-12z" fill="#000000"/>` +
      `<path d="M0,-23.5v3M0,17v3.5M0,23.5v3" stroke="#FFFFFF" stroke-width="1"/></g>`,
    -36,
    -24,
  );

// ---------------------------------------------------------------- Australia
// Flags Act 1953 / Flag specification: 1:2; Union Flag in the canton;
// Commonwealth Star (7 points) outer diameter 3/10 of hoist, centred in the lower
// hoist quarter; Crux stars outer diameter 1/7 hoist; Epsilon 1/12 hoist;
// inner diameter of every star 4/9 of its outer diameter.
const australiaFlag = () => {
  const H = 5040;
  const W = 10080;
  const s7 = (x: number, y: number, R: number) => star(x, y, R, (R * 4) / 9, 7, '#FFFFFF');
  return svg(
    W,
    H,
    `<rect width="${W}" height="${H}" fill="#012169"/>` +
      `<svg x="0" y="0" width="${W / 2}" height="${H / 2}" viewBox="0 0 60 30">${unionJack('#E4002B', 'au')}</svg>` +
      s7(2520, 3780, 756) +
      s7(7560, 4200, 360) +
      s7(6300, 2205, 360) +
      s7(7560, 840, 360) +
      s7(8680, 1869, 360) +
      star(8064, 2730, 210, (210 * 4) / 9, 5, '#FFFFFF'),
  );
};

// ---------------------------------------------------------------- UAE
// 1:2; vertical red band 1/4 of the length at the hoist; green, white, black.
const uaeFlag = () =>
  svg(
    12,
    6,
    `<rect width="12" height="2" fill="#00732F"/><rect y="2" width="12" height="2" fill="#FFFFFF"/>` +
      `<rect y="4" width="12" height="2" fill="#000000"/><rect width="3" height="6" fill="#FF0000"/>`,
  );

// ---------------------------------------------------------------- Türkiye
// Turkish Flag Law No. 2994 (G = hoist): crescent outer circle centre 1/2 G
// from the hoist, diameter 1/2 G; inner circle 1/16 G further, diameter 2/5 G;
// star in a circle of diameter 1/4 G, one point toward the hoist.
const turkiyeFlag = () =>
  svg(
    90000,
    60000,
    `<rect x="0" y="-30000" width="90000" height="60000" fill="#E30A17"/>` +
      `<circle cx="30000" cy="0" r="15000" fill="#FFFFFF"/><circle cx="33750" cy="0" r="12000" fill="#E30A17"/>` +
      star(49250, 0, 7500, 7500 * PENTA, 5, '#FFFFFF', -90),
    0,
    -30000,
  );

// ---------------------------------------------------------------- Switzerland
// Federal Act on the Protection of the Swiss Coat of Arms: square flag; the
// cross arms are 1/6 longer than they are wide (6 x 7 units, 32-unit field).
const switzerlandFlag = () =>
  svg(32, 32, `<rect width="32" height="32" fill="#DA291C"/><path d="M13,6h6v7h7v6h-7v7h-6v-7h-7v-6h7z" fill="#FFFFFF"/>`);

// ---------------------------------------------------------------- South Africa
// 2:3; green pall 1/5 of hoist wide with 1/15 white (fly side) and gold (hoist
// side) borders; arm centre-lines from the hoist corners meeting at the centre.
const southAfricaFlag = () =>
  svg(
    9,
    6,
    `<clipPath id="za-t"><path d="M0,0 L4.5,3 L0,6 z"/></clipPath><clipPath id="za-f"><path d="M0,0h9v6h-9z"/></clipPath>` +
      `<g clip-path="url(#za-f)">` +
      `<rect width="9" height="3" fill="#E03C31"/><rect y="3" width="9" height="3" fill="#001489"/>` +
      `<path d="M0,0 L4.5,3 L0,6 M4.5,3 H9" fill="none" stroke="#FFFFFF" stroke-width="2"/>` +
      `<g clip-path="url(#za-t)"><rect width="9" height="6" fill="#000000"/>` +
      `<path d="M0,0 L4.5,3 L0,6" fill="none" stroke="#FFB81C" stroke-width="2"/></g>` +
      `<path d="M0,0 L4.5,3 L0,6 M4.5,3 H9" fill="none" stroke="#007749" stroke-width="1.2"/></g>`,
  );

// ---------------------------------------------------------------- Pakistan
// Official specification: 2:3; white hoist band 1/4 of the length. On the
// diagonal of the green field: crescent from a circle of radius 3/10 H at the
// field's centre and a circle of radius 11/40 H centred 13/20 H from the top
// fly corner; star in a circle of radius 1/10 H on the diagonal, one point
// along it toward the corner.
const pakistanFlag = () => {
  const H = 80;
  const dx = -90;
  const dy = 80; // diagonal of the 90x80 green field, top-right -> bottom-left
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const corner = [45, -40];
  const b = [corner[0] + ux * (13 / 20) * H, corner[1] + uy * (13 / 20) * H];
  const c = [-ux * 0.3 * H, -uy * 0.3 * H];
  const rot = (Math.atan2(-uy, -ux) * 180) / Math.PI + 90;
  return svg(
    120,
    80,
    `<rect x="-75" y="-40" width="120" height="80" fill="#01411C"/><rect x="-75" y="-40" width="30" height="80" fill="#FFFFFF"/>` +
      `<circle cx="0" cy="0" r="${0.3 * H}" fill="#FFFFFF"/><circle cx="${f(b[0])}" cy="${f(b[1])}" r="${(11 / 40) * H}" fill="#01411C"/>` +
      star(c[0], c[1], 0.1 * H, 0.1 * H * PENTA, 5, '#FFFFFF', rot),
    -75,
    -40,
  );
};

export const FLAGS = {
  EU: {w: 3, h: 2, main: '#003399', source: 'code', svg: euFlag()},
  USA: {w: 19, h: 10, main: '#3C3B6E', source: 'code', svg: usaFlag()},
  China: {w: 3, h: 2, main: '#EE1C25', source: 'code', svg: chinaFlag()},
  Japan: {w: 3, h: 2, main: '#BC002D', source: 'code', svg: japanFlag()},
  Germany: {w: 5, h: 3, main: '#DD0000', source: 'code', svg: hBands(5, 3, ['#000000', '#DD0000', '#FFCE00'])},
  UK: {w: 2, h: 1, main: '#012169', source: 'code', svg: ukFlag()},
  India: {w: 3, h: 2, main: '#138808', source: 'code', svg: indiaFlag()},
  France: {w: 3, h: 2, main: '#000091', source: 'code', svg: vBands(3, 2, ['#000091', '#FFFFFF', '#E1000F'])},
  Italy: {w: 3, h: 2, main: '#009246', source: 'code', svg: vBands(3, 2, ['#009246', '#F1F2F1', '#CE2B37'])},
  Canada: {w: 2, h: 1, main: '#D52B1E', source: 'wikimedia', file: 'flags/ca.svg'},
  Brazil: {w: 10, h: 7, main: '#009C3B', source: 'wikimedia', file: 'flags/br.svg'},
  Russia: {w: 3, h: 2, main: '#0039A6', source: 'code', svg: hBands(3, 2, ['#FFFFFF', '#0039A6', '#D52B1E'])},
  SouthKorea: {w: 3, h: 2, main: '#0047A0', source: 'code', svg: koreaFlag()},
  Australia: {w: 2, h: 1, main: '#012169', source: 'code', svg: australiaFlag()},
  Spain: {w: 3, h: 2, main: '#AA151B', source: 'wikimedia', file: 'flags/es.svg'},
  Mexico: {w: 7, h: 4, main: '#006847', source: 'wikimedia', file: 'flags/mx.svg'},
  Indonesia: {w: 3, h: 2, main: '#FF0000', source: 'code', svg: hBands(3, 2, ['#FF0000', '#FFFFFF'])},
  Netherlands: {w: 3, h: 2, main: '#21468B', source: 'code', svg: hBands(3, 2, ['#AE1C28', '#FFFFFF', '#21468B'])},
  UAE: {w: 2, h: 1, main: '#00732F', source: 'code', svg: uaeFlag()},
  Turkiye: {w: 3, h: 2, main: '#E30A17', source: 'code', svg: turkiyeFlag()},
  Switzerland: {w: 1, h: 1, main: '#DA291C', source: 'code', svg: switzerlandFlag()},
  Argentina: {w: 8, h: 5, main: '#74ACDF', source: 'wikimedia', file: 'flags/ar.svg'},
  SouthAfrica: {w: 3, h: 2, main: '#007749', source: 'code', svg: southAfricaFlag()},
  Nigeria: {w: 2, h: 1, main: '#008751', source: 'code', svg: vBands(2, 1, ['#008751', '#FFFFFF', '#008751'])},
  Egypt: {w: 3, h: 2, main: '#CE1126', source: 'wikimedia', file: 'flags/eg.svg'},
  Pakistan: {w: 3, h: 2, main: '#01411C', source: 'code', svg: pakistanFlag()},
} satisfies Record<string, FlagDef>;

export type FlagId = keyof typeof FLAGS;
