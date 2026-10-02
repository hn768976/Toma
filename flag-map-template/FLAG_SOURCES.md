# Flag sources

Every flag is an SVG at its official proportions. Flags are cropped only when
they are mapped onto a map shape (cover the shape's bounding box, with the
row's `focus` point placed on the shape's most interior point).

## Drawn in code (`src/flags/flags.ts`)

| Flag | Proportion | Construction used |
|------|-----------|-------------------|
| European Union | 2:3 | EU graphic specification: 12 five-pointed gold stars (#FFCC00) on a circle of radius 1/3 of the hoist, each star's outer radius 1/18 of the hoist, upright, on Reflex Blue (#003399) |
| United States | 10:19 | Executive Order 10834: A=1, B=1.9, C=7/13, D=0.76, E=F=0.054, G=H=0.063, K=0.0616, L=1/13; 50 stars in 9 alternating rows of 6/5 |
| China | 2:3 | GB 12982-2004: 30×20 grid, large star r=3 at (5,5), small stars r=1 at (10,2) (12,4) (12,7) (10,9), each pointing at the large star's centre |
| Japan | 2:3 | Act on National Flag and Anthem (1999): disc diameter 3/5 of hoist, centred, crimson #BC002D |
| Germany | 3:5 | Black / red #DD0000 / gold #FFCE00 horizontal thirds |
| United Kingdom | 1:2 | Union Flag, standard counterchanged construction on a 60×30 grid (white saltire 6, red saltire 4 counterchanged, white cross 10, red cross 6) |
| India | 2:3 | Flag Code of India / IS 1:1968: saffron, white, India green bands; navy Ashoka Chakra with 24 spokes in the white band |
| France | 2:3 | Vertical thirds, current Élysée colours (#000091 / white / #E1000F) |
| Italy | 2:3 | Vertical thirds (#009246 / #F1F2F1 / #CE2B37) |
| Russia | 2:3 | White / blue #0039A6 / red #D52B1E horizontal thirds |
| South Korea | 2:3 | Flag Act: taegeuk diameter 1/2 of hoist; trigrams 1/2 diameter long, bars 1/12 diameter, gaps 1/24 diameter, 1/4 diameter from the circle on the diagonals (geon upper-left, gam upper-right, ri lower-left, gon lower-right) |
| Australia | 1:2 | Flags Act 1953 specification: Union Flag canton; 7-point Commonwealth Star outer diameter 3/10 hoist; Crux stars outer diameter 1/7 hoist; Epsilon 1/12 hoist; inner diameters 4/9 of outer; official star positions |
| Indonesia | 2:3 | Red over white halves |
| Netherlands | 2:3 | Red #AE1C28 / white / blue #21468B horizontal thirds |
| United Arab Emirates | 1:2 | Red hoist band 1/4 of length; green / white / black horizontal thirds |
| Türkiye | 2:3 | Turkish Flag Law No. 2994 (G = hoist): crescent outer circle centre G/2 from hoist, diameter G/2; inner circle G/16 further, diameter 2/5 G; star in a circle of diameter G/4, one point toward the hoist; red #E30A17 |
| Switzerland | 1:1 | Federal coat of arms law: cross arms 1/6 longer than wide (6×7 units on a 32-unit field) |
| South Africa | 2:3 | Green pall 1/5 of hoist wide with 1/15 white (fly side) and gold (hoist side) borders, arm centre lines from the hoist corners meeting at the centre; black triangle; chilli red / blue |
| Nigeria | 1:2 | Green / white / green vertical thirds |
| Pakistan | 2:3 | Official specification: white hoist band 1/4 of length; crescent from a circle of radius 3/10 H at the green field's centre and a circle of radius 11/40 H centred 13/20 H from the top fly corner along the diagonal; star in a circle of radius 1/10 H on the diagonal, one point toward the corner |

## From Wikimedia Commons (public domain)

These flags carry detailed coats of arms or emblems that cannot be drawn
faithfully by hand, so the public-domain SVGs from Wikimedia Commons are used
unchanged (only explicit `width`/`height` attributes are set at load time).

| Flag | File in project | Wikimedia Commons file | Licence |
|------|-----------------|------------------------|---------|
| Mexico (coat of arms) | `public/flags/mx.svg` | https://commons.wikimedia.org/wiki/File:Flag_of_Mexico.svg | Public domain |
| Egypt (Eagle of Saladin) | `public/flags/eg.svg` | https://commons.wikimedia.org/wiki/File:Flag_of_Egypt.svg | Public domain |
| Spain (coat of arms) | `public/flags/es.svg` | https://commons.wikimedia.org/wiki/File:Flag_of_Spain.svg | Public domain |
| Brazil (celestial globe, motto) | `public/flags/br.svg` | https://commons.wikimedia.org/wiki/File:Flag_of_Brazil.svg | Public domain |
| Argentina (Sun of May) | `public/flags/ar.svg` | https://commons.wikimedia.org/wiki/File:Flag_of_Argentina.svg | Public domain |
| Canada (maple leaf) | `public/flags/ca.svg` | https://commons.wikimedia.org/wiki/File:Flag_of_Canada.svg | Public domain |

**How these files were obtained.** The build machine's network policy blocks
`wikimedia.org`, so the SVGs were taken from the `svg-country-flags@1.2.10`
npm package (github.com/hampusborgos/country-flags), which redistributes the
Wikimedia Commons flag SVGs. That package is published with
`"license": "PD"` and its README states: *"The source files were taken from
Wikimedia Commons ... The flags are not under copyright protection since flags
are in public domain (there may be other restrictions on how the flag can be
used though)."* A copy of that README is in `public/flags/MIRROR-README.md`.

The Commons licence pages themselves could not be opened from the build
sandbox. Before publishing, open each Commons link above and confirm the file
is still tagged public domain; if one is not, replace it (e.g. draw it in code
in `src/flags/flags.ts`).

Note that some countries restrict *how* their flag or arms may be used (for
example Mexico's Ley sobre el Escudo, la Bandera y el Himno Nacionales). That is
a usage rule, not a copyright licence.

## Left out on purpose

Saudi Arabia: its flag carries the Shahada, which must not be cropped or
distorted, as any map texture would do.
