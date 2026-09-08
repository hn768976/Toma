/**
 * THE COUNTRY LIST.
 *
 * This is the only file you edit to add a country. Append an entry, run
 * `npm run build:assets`, and the new compositions appear in the studio. There
 * is no code change anywhere else. See README.md → "Adding a country".
 */

import type {FramingOverride} from './geo/projection';

export interface V3Config {
  /**
   * How wide the closing frame is, as a multiple of the subject's own projected
   * width. Higher ends the zoom wider, keeping more regional context in frame —
   * which is how a country too small for the satellite base's resolution is kept
   * looking intentional rather than soft.
   */
  context?: number;
  /**
   * Flag fill. `false` builds only the `white` variant. Used where clipping and
   * draping a flag over a silhouette is inappropriate — see README.
   */
  flagFill: boolean;
  flagFillSkipReason?: string;
  /** Free-text note carried into the README table. */
  note?: string;
}

export interface CountryConfig {
  /** Natural Earth ADM0_A3 code. This is the composition id stem. */
  code: string;
  /** Overrides the Natural Earth name for the large on-screen title. */
  displayName?: string;
  /**
   * Natural Earth populated-place names, in priority order. Coordinates are
   * resolved from Natural Earth at build time — never typed by hand. Omit the
   * field and the builder auto-picks by scale rank and population.
   */
  cities?: string[];
  /** Manual framing correction. Omit for the auto-fit, which is right for most countries. */
  framing?: FramingOverride;
  /** `false` marks the country V3-ineligible: no satellite compositions are registered. */
  v3: V3Config | false;
  /** Demand tier the country was picked from — carried into the README table. */
  tier: 'A' | 'B' | 'C';
  /** Why this country needs individual attention. */
  tags?: Array<'large' | 'mid' | 'small' | 'elongated' | 'antimeridian' | 'scattered' | 'archipelago'>;
  notes?: string;
}

export const COUNTRIES: CountryConfig[] = [
  // ── Tier A — unavoidable high demand ──────────────────────────────────────
  {
    code: 'USA',
    displayName: 'United States',
    cities: [
      'Washington,  D.C.', 'Los Angeles', 'Chicago', 'Miami', 'Dallas',
      'Atlanta', 'Boston', 'Detroit', 'Phoenix', 'San Francisco',
      'Seattle', 'Minneapolis', 'San Juan', 'Denver', 'St. Louis',
      'Cincinnati', 'San Antonio', 'Kansas City', 'Raleigh', 'Memphis',
    ],
    // Framed on the contiguous 48. Alaska and Hawai‘i are drawn wherever they
    // fall but excluded from the fit by the 4° gap rule.
    framing: {gapDeg: 4, projection: 'conicConformal', parallels: [33, 45]},
    v3: {context: 1.7, flagFill: true},
    tier: 'A',
    tags: ['large', 'scattered'],
    notes: 'Fit is the contiguous 48; Alaska and Hawai‘i excluded by the 4° gap rule.',
  },
  {
    code: 'CHN',
    displayName: 'China',
    cities: [
      'Beijing', 'Shanghai', 'Guangzhou', 'Wuhan', 'Chongqing',
      'Shenyeng', 'Xian', 'Hechi', 'Harbin', 'Ürümqi', 'Zhangzhou',
      'Kunming', 'Qingdao', 'Lanzhou', 'Haikou', 'Baotou', 'Xinxiang',
      'Shache', 'Hami', 'Yining',
    ],
    framing: {projection: 'conicConformal', parallels: [25, 45], maxWidthFrac: 0.5},
    v3: {context: 1.7, flagFill: true},
    tier: 'A',
    tags: ['large'],
  },
  {
    code: 'IND',
    displayName: 'India',
    cities: [
      'New Delhi', 'Mumbai', 'Kolkata', 'Chennai', 'Hyderabad',
      'Ahmedabad', 'Kanpur', 'Nagpur', 'Patna', 'Indore', 'Coimbatore',
      'Ludhiana', 'Vishakhapatnam', 'Srinagar', 'Jodhpur', 'Guwahati',
      'Hubballi', 'Bhubaneswar', 'Bilaspur', 'Siliguri',
    ],
    // The Andaman and Nicobar Islands sit ~1 200 km east; the default 8° gap
    // keeps the fit on the mainland.
    framing: {maxHeightFrac: 0.7},
    v3: {context: 1.9, flagFill: true},
    tier: 'A',
    tags: ['large', 'scattered'],
    notes: 'Andaman and Nicobar Islands drawn but excluded from the fit.',
  },
  {
    code: 'RUS',
    displayName: 'Russia',
    cities: [
      'Moscow', 'St.  Petersburg', 'Novosibirsk', 'Yekaterinburg',
      'Samara', 'Omsk', 'Rostov', 'Krasnoyarsk', 'Voronezh', 'Izhevsk',
      'Vladivostok', 'Irkutsk', 'Khabarovsk', 'Makhachkala',
      'Kaliningrad', 'Surgut', 'Sevastopol', 'Archangel', 'Murmansk',
      'Chita',
    ],
    // The antimeridian case. Territory runs from 19°E to past 180°, so the fit,
    // the projection rotation and the raster window all have to handle the wrap.
    framing: {
      projection: 'conicConformal',
      parallels: [50, 68],
      maxWidthFrac: 0.88,
      maxHeightFrac: 0.62,
    },
    v3: {context: 1.35, flagFill: true},
    tier: 'A',
    tags: ['large', 'antimeridian'],
    notes: 'Antimeridian crosser. Chukotka wraps past 180°.',
  },
  {
    code: 'JPN',
    displayName: 'Japan',
    cities: [
      'Tokyo', 'Kyoto', 'Fukuoka', 'Sapporo', 'Sendai', 'Hiroshima',
      'Naha', 'Kagoshima', 'Kanazawa', 'Aomori', 'Kushiro', 'Nagaoka',
    ],
    framing: {gapDeg: 6, maxHeightFrac: 0.78, maxWidthFrac: 0.6},
    v3: {context: 1.8, flagFill: true},
    tier: 'A',
    tags: ['mid', 'archipelago', 'elongated'],
    notes: 'Fit is the four main islands; the Ryukyu chain is drawn but excluded.',
  },
  {
    code: 'DEU',
    displayName: 'Germany',
    cities: [
      'Berlin', 'Stuttgart', 'Frankfurt', 'Hamburg', 'Essen', 'Munich',
      'Saarbrücken', 'Nürnberg', 'Bremen', 'Hanover', 'Dresden',
      'Leipzig', 'Bielefeld', 'Kassel', 'Kiel', 'Freiburg', 'Magdeburg',
      'Erfurt', 'Rostock', 'Würzburg',
    ],
    v3: {context: 2.4, flagFill: true},
    tier: 'A',
    tags: ['mid'],
  },
  {
    code: 'GBR',
    displayName: 'United Kingdom',
    cities: [
      'London', 'Birmingham', 'Manchester', 'Glasgow', 'Newcastle',
      'Cardiff', 'Belfast', 'Portsmouth', 'Kingston upon Hull',
      'Plymouth', 'Norwich', 'Aberdeen', 'Gibraltar', 'Dundee',
      'Peterborough', 'Londonderry/Derry', 'Carlisle', 'Hamilton',
      'Inverness', 'Dover',
    ],
    framing: {gapDeg: 5, maxHeightFrac: 0.74, maxWidthFrac: 0.42},
    v3: {context: 2.2, flagFill: true},
    tier: 'A',
    tags: ['mid', 'scattered'],
    notes: 'Great Britain and Northern Ireland; overseas territories excluded from the fit.',
  },
  {
    code: 'FRA',
    displayName: 'France',
    cities: [
      'Paris', 'Lyon', 'Marseille', 'Lille', 'Nice', 'Toulouse',
      'Bordeaux', 'Strasbourg', 'Nantes', 'Metz', 'Montpellier',
      'Fort-de-France', 'Le Havre', 'Tours', 'Clermont-Ferrand', 'Reims',
      'St.-Denis', 'Dijon', 'Limoges', 'Perpignan',
    ],
    // Metropolitan France plus Corsica. The overseas departments are drawn if
    // they fall in frame but never pull the fit — applied the same way for every
    // country with distant holdings.
    framing: {gapDeg: 6},
    v3: {context: 2.2, flagFill: true},
    tier: 'A',
    tags: ['mid', 'scattered'],
    notes: 'Metropolitan France + Corsica; overseas departments excluded from the fit.',
  },
  {
    code: 'BRA',
    displayName: 'Brazil',
    cities: [
      'Brasília', 'São Paulo', 'Belo Horizonte', 'Porto Alegre',
      'Recife', 'Fortaleza', 'Salvador', 'Belém', 'Manaus', 'Vila Velha',
      'Cuiabá', 'Campo Grande', 'Foz do Iguaçu', 'Porto Velho', 'Palmas',
      'Boa Vista', 'Santarém', 'Caxias', 'Uruguaiana', 'Vilhena',
    ],
    v3: {context: 1.7, flagFill: true},
    tier: 'A',
    tags: ['large'],
  },
  {
    code: 'CAN',
    displayName: 'Canada',
    cities: [
      'Ottawa', 'Vancouver', 'Calgary', 'Winnipeg', 'Halifax', 'Windsor',
      'St. John\'s', 'Thunder Bay', 'Rimouski', 'Prince Albert',
      'Whitehorse', 'Terrace', 'Yellowknife', 'Thompson',
      'Happy Valley - Goose Bay', 'Fort Nelson', 'Iqaluit', 'Cochrane',
      'Inuvik', 'Rankin Inlet',
    ],
    framing: {projection: 'conicConformal', parallels: [50, 70], maxHeightFrac: 0.52},
    v3: {context: 1.5, flagFill: true},
    tier: 'A',
    tags: ['large'],
  },

  // ── Tier B — strong demand, thinner supply ────────────────────────────────
  {
    code: 'IDN',
    displayName: 'Indonesia',
    cities: [
      'Jakarta', 'Surabaya', 'Medan', 'Palembang', 'Makassar', 'Padang',
      'Palu', 'Pontianak', 'Bandjarmasin', 'Banda Aceh', 'Mataram',
      'Manado', 'Ambon', 'Kupang', 'Tanjungpinang', 'Tarakan',
      'Jayapura', 'Kendari', 'Sorong', 'Biak',
    ],
    // The archipelago is the country: single-linkage clustering walks island to
    // island and keeps the whole chain.
    framing: {maxWidthFrac: 0.66, maxHeightFrac: 0.34},
    v3: {context: 1.5, flagFill: true},
    tier: 'B',
    tags: ['large', 'archipelago', 'scattered'],
  },
  {
    code: 'MEX',
    displayName: 'Mexico',
    cities: [
      'Mexico City', 'Guadalajara', 'Monterrey', 'Tijuana',
      'Ciudad Juárez', 'Torreón', 'San Luis Potosí', 'Mérida', 'Tampico',
      'Culiacán', 'Chihuahua', 'Acapulco', 'Hermosillo', 'Veracruz',
      'Cancún', 'Matamoros', 'Tuxtla Gutiérrez', 'La Paz',
      'Lázaro Cárdenas', 'Ciudad del Carmen',
    ],
    v3: {context: 1.9, flagFill: true},
    tier: 'B',
    tags: ['large'],
  },
  {
    code: 'TUR',
    displayName: 'Turkey',
    cities: [
      'Ankara', 'Istanbul', 'İzmir', 'Adana', 'Gaziantep', 'Konya',
      'Antalya', 'Trabzon', 'Diyarbakır', 'Samsun', 'Kayseri',
      'Eskişehir', 'Malatya', 'Şanlıurfa', 'Erzurum', 'Denizli', 'Van',
      'Sivas', 'Balıkesir', 'Corum',
    ],
    framing: {maxWidthFrac: 0.52, maxHeightFrac: 0.36},
    v3: {context: 2.2, flagFill: true},
    tier: 'B',
    tags: ['mid', 'elongated'],
  },
  {
    code: 'SAU',
    displayName: 'Saudi Arabia',
    cities: [
      'Riyadh', 'Jeddah', 'Dammam', 'Medina', 'Tabuk', 'Buraydah',
      'Hail', 'Najran', 'Hafar al Batin', 'Arar', 'Qal at Bishah',
      'Rafha', 'Al Wajh', 'As Sulayyil', 'An Nabk',
    ],
    v3: {
      context: 1.9,
      flagFill: false,
      flagFillSkipReason:
        'The flag bears the shahada. Cropping it, draping it over a shape or ' +
        'clipping it to a silhouette is considered disrespectful and is ' +
        'restricted in some jurisdictions.',
    },
    tier: 'B',
    tags: ['large'],
  },
  {
    code: 'KOR',
    displayName: 'South Korea',
    cities: [
      'Seoul', 'Busan', 'Daegu', 'Daejeon', 'Gwangju', 'Jeonju',
      'Pohang', 'Jeju', 'Yeosu', 'Mokpo', 'Wonju', 'Chuncheon',
      'Gangneung', 'Andong',
    ],
    framing: {maxHeightFrac: 0.5, maxWidthFrac: 0.3},
    v3: {context: 2.6, flagFill: true},
    tier: 'B',
    tags: ['small'],
  },
  {
    code: 'AUS',
    displayName: 'Australia',
    cities: [
      'Canberra', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Cairns',
      'Darwin', 'Hobart', 'Mackay', 'Port Macquarie', 'Kalgoorlie',
      'Mount Isa', 'Alice Springs', 'Roebourne', 'Broken Hill', 'Broome',
      'Carnarvon', 'Kununurra', 'Roma', 'Tennant Creek',
    ],
    v3: {context: 1.7, flagFill: true},
    tier: 'B',
    tags: ['large'],
  },
  {
    code: 'ITA',
    displayName: 'Italy',
    cities: [
      'Rome', 'Milan', 'Naples', 'Turin', 'Florence', 'Palermo',
      'Catania', 'Genoa', 'Bari', 'Verona', 'Pescara', 'Cagliari',
      'Venice', 'Trieste', 'Lecce', 'Foggia', 'Perugia', 'Ravenna',
      'Sassari', 'Ancona',
    ],
    framing: {maxHeightFrac: 0.76, maxWidthFrac: 0.54},
    v3: {context: 2.0, flagFill: true},
    tier: 'B',
    tags: ['mid', 'elongated'],
  },
  {
    code: 'ESP',
    displayName: 'Spain',
    cities: [
      'Madrid', 'Barcelona', 'Seville', 'Bilbao', 'Valencia', 'Zaragoza',
      'Málaga', 'Murcia', 'Vigo', 'Las Palmas', 'Palma', 'La Coruña',
      'Gijón', 'Valladolid', 'Córdoba', 'Cádiz', 'Pamplona', 'Almería',
      'Burgos', 'Salamanca',
    ],
    // The Canary Islands are ~1 800 km south-west; the 6° gap keeps the fit on
    // the peninsula and the Balearics.
    framing: {gapDeg: 6},
    v3: {context: 2.4, flagFill: true},
    tier: 'B',
    tags: ['mid', 'scattered'],
    notes: 'Canary Islands excluded from the fit by the 6° gap rule.',
  },
  {
    code: 'ZAF',
    displayName: 'South Africa',
    cities: [
      'Johannesburg', 'Cape Town', 'Bloemfontein', 'Durban',
      'Port Elizabeth', 'Mbombela', 'East London', 'Thohoyandou',
      'Klerksdorp', 'George', 'Vryheid', 'Umtata', 'Bethlehem',
      'Upington', 'Graaff Reinet', 'Vryburg', 'Beaufort West',
      'Aliwal North', 'Lebowakgomo', 'De Aar',
    ],
    v3: {context: 2.0, flagFill: true},
    tier: 'B',
    tags: ['large'],
  },
  {
    code: 'POL',
    displayName: 'Poland',
    cities: [
      'Warsaw', 'Katowice', 'Łódź', 'Gdańsk', 'Wrocław', 'Poznań',
      'Szczecin', 'Bydgoszcz', 'Lublin', 'Białystok', 'Rzeszów',
      'Kielce', 'Olsztyn', 'Opole', 'Zielona Góra', 'Koszalin', 'Ełk',
    ],
    v3: {context: 2.5, flagFill: true},
    tier: 'B',
    tags: ['mid'],
  },
  {
    code: 'NLD',
    displayName: 'Netherlands',
    cities: [
      'The Hague', 'Amsterdam', 'Eindhoven', 'Groningen', 'Willemstad',
      'Arnhem', 'Leeuwarden', 'Maastricht', 'Zwolle', 'Oranjestad',
      'Middelburg',
    ],
    framing: {gapDeg: 4, maxWidthFrac: 0.22, maxHeightFrac: 0.34},
    v3: false,
    tier: 'B',
    tags: ['small', 'scattered'],
    notes:
      'V3 skipped — too small for the deep zoom. Caribbean municipalities ' +
      'excluded from the fit by the 4° gap rule.',
  },

  // ── Tier C — regional hubs, logistics and growth markets ──────────────────
  {
    code: 'ARE',
    displayName: 'United Arab Emirates',
    cities: [
      'Abu Dhabi', 'Dubai', 'Al Ayn', 'Ras al Khaymah', 'Al Fujayrah',
    ],
    framing: {maxWidthFrac: 0.26, maxHeightFrac: 0.3},
    v3: false,
    tier: 'C',
    tags: ['small'],
    notes: 'V3 skipped — too small for the deep zoom.',
  },
  {
    code: 'SGP',
    displayName: 'Singapore',
    cities: [
      'Singapore',
    ],
    // 50 km across. A default fit would produce a city map, not a country map,
    // so the frame is opened right out to show the Strait and its neighbours.
    framing: {maxWidthFrac: 0.13, maxHeightFrac: 0.13},
    v3: false,
    tier: 'C',
    tags: ['small'],
    notes: 'V3 skipped — far too small for the deep zoom. V1/V2 framed on the Strait.',
  },
  {
    code: 'VNM',
    displayName: 'Vietnam',
    cities: [
      'Hanoi', 'Ho Chi Minh City', 'Can Tho', 'Da Nang', 'Qui Nhon',
      'Vinh', 'Nha Trang', 'Cà Mau', 'Buon Me Thuot', 'Phan Thiet',
      'Quảng Ngãi', 'Thanh Hóa', 'Đồng Hới', 'Hong Gai', 'Lạng Sơn',
      'Play Ku', 'Yên Bái', 'Quảng Trị', 'Lao Chi', 'Cao Bằng',
    ],
    framing: {maxHeightFrac: 0.79, maxWidthFrac: 0.48, projection: 'mercator'},
    v3: {context: 1.5, flagFill: true},
    tier: 'C',
    tags: ['mid', 'elongated'],
  },
  {
    code: 'NGA',
    displayName: 'Nigeria',
    cities: [
      'Lagos', 'Abuja', 'Kano', 'Ibadan', 'Kaduna', 'Benin City',
      'Ikare', 'Port Harcourt', 'Maiduguri', 'Jos', 'Ilorin', 'Sokoto',
      'Enugu', 'Calabar', 'Katsina', 'Makurdi', 'Minna', 'Gombe',
      'Damaturu', 'Gusau',
    ],
    v3: {context: 2.3, flagFill: true},
    tier: 'C',
    tags: ['mid'],
  },
  {
    code: 'EGY',
    displayName: 'Egypt',
    cities: [
      'Cairo', 'Alexandria', 'Bur Said', 'Luxor', 'Sohag', 'Suez',
      'El Minya', 'Aswan', 'El Arish', 'Hurghada', 'Matruh', 'El Kharga',
      'Siwa', 'Salum', 'Qasr Farafra', 'El Qasr', 'Berenice',
    ],
    v3: {context: 2.1, flagFill: true},
    tier: 'C',
    tags: ['mid'],
  },
  {
    code: 'ARG',
    displayName: 'Argentina',
    cities: [
      'Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'Tucumán',
      'Mar del Plata', 'Salta', 'San Luis', 'Resistencia', 'Posadas',
      'Bahía Blanca', 'Neuquén', 'La Rioja', 'Concordia',
      'Comodoro Rivadavia', 'Santa Rosa', 'Bariloche', 'Trelew',
      'Olavarría', 'Río Gallegos',
    ],
    framing: {maxHeightFrac: 0.74},
    v3: {context: 1.7, flagFill: true},
    tier: 'C',
    tags: ['large', 'elongated'],
  },
  {
    code: 'SWE',
    displayName: 'Sweden',
    cities: [
      'Stockholm', 'Göteborg', 'Malmö', 'Västerås', 'Linköping',
      'Jönköping', 'Umeå', 'Karlstad', 'Sundsvall', 'Gävle', 'Växjö',
      'Halmstad', 'Luleå', 'Östersund', 'Borlänge', 'Kalmar',
      'Skellefteå', 'Örnsköldsvik', 'Nyköping', 'Visby',
    ],
    framing: {maxHeightFrac: 0.8, maxWidthFrac: 0.58},
    v3: {context: 1.7, flagFill: true},
    tier: 'C',
    tags: ['mid', 'elongated'],
  },
  {
    code: 'THA',
    displayName: 'Thailand',
    cities: [
      'Bangkok', 'Chiang Mai', 'Nakhon Ratchasima', 'Hat Yai',
      'Ubon Ratchathani', 'Khon Kaen', 'Nakhon Si Thammarat',
      'Phitsanulok', 'Phuket', 'Chiang Rai', 'Nakhon Sawan', 'Nong Khai',
      'Chanthaburi', 'Chumphon', 'Nan', 'Sakhon Nakhon', 'Narathiwat',
      'Surin', 'Lop Buri', 'Hua Hin',
    ],
    framing: {maxHeightFrac: 0.8, maxWidthFrac: 0.5},
    v3: {context: 1.8, flagFill: true},
    tier: 'C',
    tags: ['mid', 'elongated'],
  },
  {
    code: 'PHL',
    displayName: 'Philippines',
    cities: [
      'Manila', 'Baguio', 'Davao', 'Cagayan de Oro', 'Bacolod',
      'Zamboanga', 'Naga', 'Tacloban', 'Cotabato', 'Laoag',
      'Puerto Princesa', 'Tuguegarao', 'Surigao',
    ],
    framing: {maxHeightFrac: 0.8, maxWidthFrac: 0.6},
    v3: {context: 1.9, flagFill: true},
    tier: 'C',
    tags: ['mid', 'archipelago'],
  },
  {
    code: 'CHE',
    displayName: 'Switzerland',
    cities: [
      'Bern', 'Geneva', 'Zürich', 'Basel', 'Lausanne', 'Lugano',
      'Saint Gallen', 'Chur', 'Sion', 'Sarnen',
    ],
    framing: {maxWidthFrac: 0.26, maxHeightFrac: 0.3},
    v3: false,
    tier: 'C',
    tags: ['small'],
    notes: 'V3 skipped — too small for the deep zoom. Flag is 1:1, not 3:2.',
  },
  {
    code: 'NOR',
    displayName: 'Norway',
    cities: [
      'Oslo', 'Bergen', 'Stavanger', 'Trondheim', 'Kristiansand',
      'Tromsø', 'Ålesund', 'Bodø', 'Narvik', 'Lillehammer', 'Alta',
      'Namsos', 'Vadsø', 'Leikanger', 'Longyearbyen',
    ],
    // Svalbard and Jan Mayen dropped by the gap rule; the mainland alone is
    // still a hard diagonal, so it fits by height with a nudge east.
    // 2.5° rather than the default: at 5° the single-linkage chain runs
    // mainland → Bjørnøya → Svalbard and drags the frame to the Arctic.
    framing: {gapDeg: 2.5, maxHeightFrac: 0.82, maxWidthFrac: 0.64, offset: [0.04, 0]},
    v3: {context: 1.5, flagFill: true},
    tier: 'C',
    tags: ['mid', 'elongated', 'scattered'],
    notes: 'Svalbard, Bjørnøya and Jan Mayen excluded from the fit by the 2.5° gap rule.',
  },
  {
    code: 'CHL',
    displayName: 'Chile',
    cities: [
      'Valparaíso', 'Santiago', 'Concepción', 'Antofagasta', 'Arica',
      'Puerto Montt', 'Coquimbo', 'Punta Arenas', 'Coihaique',
      'Puerto Williams', 'Villa O\'Higgins',
    ],
    // 4 300 km tall, 180 km wide. The default fit would put Chile in a
    // hemisphere-wide frame; fitting by height and dropping Easter Island fixes it.
    // 0.80 rather than 0.88: the push-in ends at 1.18, so anything much above
    // 0.82 at the opening frame is clipped at the closing one.
    framing: {maxHeightFrac: 0.8, maxWidthFrac: 0.82, gapDeg: 4, projection: 'mercator'},
    v3: {context: 1.25, flagFill: true},
    tier: 'C',
    tags: ['large', 'elongated', 'scattered'],
    notes: 'Fits by height. Easter Island and Juan Fernández excluded by the 4° gap rule.',
  },
];

export const countryByCode = (code: string): CountryConfig => {
  const c = COUNTRIES.find((x) => x.code === code);
  if (!c) throw new Error(`Unknown country code ${code}`);
  return c;
};
