// Letters on the five non-target faces of every cube.
//
// Picked once, at module level, from a seeded PRNG, then checked against the
// actual tumble: at every frame from the first drop to full rest we look at
// which faces each cube shows the camera, and reject the whole pick if
// neighbouring cubes could read as a real word, a rude word or a known
// acronym. Lookalikes (O/0, I/1) and the acronym's own characters never
// appear on side faces, so there is no doubt about what is being spelled.

import { Vector3 } from "three";
import { ACRONYMS, type AcronymRow } from "../data/acronyms";
import { SHORT_WORDS } from "../data/shortWords";
import { FACE_NORMALS, TOP_FACE, planCubes, poseAt, type CubePlan } from "./motion";
import { seeded } from "./prng";
import { ALL_STILL_BY_FRAME, FIRST_DROP_FRAME, cameraAt } from "./world";

// Consonants only (vowels make words), no lookalikes (O, I, and also Q next to
// O-ish shapes is fine), plus the odd digit. Y counts as a vowel here.
const LETTER_POOL = "BCDFGHJKLMNPRSTVWXZ".split("");
const DIGIT_POOL = "347".split("");

const RUDE = [
  "ASS", "FU", "FUK", "FUC", "FCK", "FK", "SHT", "SH1T", "CNT", "DCK", "DIK",
  "KKK", "WTF", "FFS", "STFU", "GTFO", "FML", "NSFW", "SEX", "XXX", "XX",
  "PMS", "MF", "BJ", "NIG", "FAG", "TIT", "TITS", "POO", "PEE", "SOB", "BS",
  "VD", "STD", "KMS", "KYS", "SS", "NSDP", "PR0N", "PRN", "DMN", "DAM",
  "H3LL", "CR4P", "PCP", "LSD", "THC", "HIV", "MILF", "DTF", "BDSM", "CK",
  "FKN", "FFK", "SHT", "B1TCH", "BTCH", "WH0R", "SL4T", "SLT", "PSSY",
];
// Common initialisms a viewer might recognise.
const INITIALISMS = [
  "OK", "TV", "PC", "CEO", "CFO", "CTO", "COO", "ATM", "IRS", "SEC", "FBI",
  "CIA", "NBA", "NFL", "BBC", "CNN", "USA", "UK", "EU", "UN", "NYC", "LA",
  "DC", "GPS", "DNA", "RNA", "PDF", "MP3", "MP4", "HTML", "HTTP", "WWW",
  "SMS", "MMS", "VIP", "DIY", "FAQ", "ASAP", "RSVP", "LOL", "OMG", "BRB",
  "BTW", "IMO", "TBH", "IDK", "PS", "PM", "AM", "BC", "AD", "HR", "PR", "IT",
  "QA", "R&D", "B2C", "C2C", "P2P", "NFT", "BTC", "ETH", "USD", "EUR", "GBP",
  "JPY", "CHF", "CAD", "AUD", "CNY", "HKD", "SGD", "NZD", "MXN", "INR", "KRW",
  "NYSE", "LSE", "TSX", "DAX", "FTSE", "CAC", "SPX", "DJI", "NDX", "VIX",
  "FX", "PE", "EPS", "EBIT", "CAGR", "NAV", "AUM", "LLC", "INC", "LTD", "PLC",
  "CPA", "CFA", "MBA", "PHD", "MD", "DDS", "RN", "DJ", "MC", "VJ", "BMW",
  "VW", "GM", "HP", "IBM", "AMD", "LG", "BP", "KFC", "MTV", "HBO", "NHS",
  "NASA", "NATO", "FIFA", "UFC", "WWE", "MVP", "GDP", "GNP", "CPI", "PPI",
  "KPI", "ROI", "ROE", "ROA", "IPO", "ETF", "IRA", "ESG", "APR", "APY",
  "VAT", "GST", "B2B", "SaaS", "CRM", "ERP", "API", "SDK", "SQL", "XML",
  "JSON", "CSS", "PHP", "JS", "TS", "VR", "AR", "AI", "ML", "CPU", "GPU",
  "RAM", "ROM", "SSD", "HDD", "USB", "LED", "LCD", "DVD", "CD", "HD", "4K",
  "3D", "2D", "5G", "4G", "3G", "24/7", "007", "911", "7", "KB", "MB", "GB",
  "TB", "KG", "KM", "CM", "MM", "MPH", "KPH", "PSI", "RPM", "BPM", "DNS",
  "VPN", "LAN", "WAN", "ISP", "SIM", "PIN", "OTP", "SSN", "DOB", "ID",
];

const BLOCK = new Set<string>([
  ...SHORT_WORDS.split(" "),
  ...RUDE,
  ...INITIALISMS.map((s) => s.toUpperCase()),
  ...ACRONYMS.map((a) => a.id),
]);

export type CubeFaces = string[]; // 6 chars, BoxGeometry group order

// Glyphs a viewer reads as letters: a zero next to a P reads "OP".
const LOOKALIKE: Record<string, string> = { "0": "O", "1": "I", "2": "Z", "5": "S", "8": "B" };
const asRead = (s: string) => [...s].map((c) => LOOKALIKE[c] ?? c).join("");
const blocked = (s: string) => BLOCK.has(s) || BLOCK.has(asRead(s));

const VIS_DOT = 0.1; // a face counts as readable if it faces the camera at all

export const visibleFaces = (plan: CubePlan, frame: number): number[] => {
  const pose = poseAt(plan, frame);
  if (!pose.visible) return [];
  const cam = new Vector3(...cameraAt(frame).position);
  const toCam = cam.sub(pose.position).normalize();
  const out: number[] = [];
  FACE_NORMALS.forEach((n, i) => {
    if (n.clone().applyQuaternion(pose.quaternion).dot(toCam) > VIS_DOT) out.push(i);
  });
  return out;
};

// All strings neighbouring cubes could show at once, that include at least
// one side-face letter (the intended acronym itself is not a violation).
// Each hit lists the side faces that took part, so the picker can repair them.
export type WordHit = { frame: number; word: string; faces: [number, number][] };

export const findWordViolations = (plans: CubePlan[], faces: CubeFaces[]) => {
  const hits: WordHit[] = [];
  const seen = new Set<string>();
  for (let f = FIRST_DROP_FRAME; f <= ALL_STILL_BY_FRAME; f++) {
    const vis = plans.map((p) => visibleFaces(p, f));
    for (let i = 0; i < plans.length; i++) {
      for (let j = i + 1; j < plans.length; j++) {
        if (vis.slice(i, j + 1).some((v) => v.length === 0)) break;
        const walk = (k: number, s: string, used: [number, number][]) => {
          if (k > j) {
            if (used.length && blocked(s)) {
              const key = s + used.map((u) => u.join(".")).join(",");
              if (!seen.has(key)) {
                seen.add(key);
                hits.push({ frame: f, word: s, faces: used });
              }
            }
            return;
          }
          for (const fi of vis[k]) {
            walk(k + 1, s + faces[k][fi], fi === TOP_FACE ? used : [...used, [k, fi]]);
          }
        };
        walk(i, "", []);
      }
    }
  }
  return hits;
};

const cache = new Map<string, CubeFaces[]>();

export const sideFacesFor = (row: AcronymRow): CubeFaces[] => {
  const key = `${row.id}/${row.seed}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const plans = planCubes(row);
  const targetChars = new Set([...row.id]);
  const letters = LETTER_POOL.filter((c) => !targetChars.has(c));
  const digits = DIGIT_POOL.filter((c) => !targetChars.has(c));
  const rng = seeded(row.id, row.seed, "side-faces");

  const draw = (used: Set<string>) => {
    for (;;) {
      const pool = rng() < 0.1 ? digits : letters;
      const c = pool[Math.floor(rng() * pool.length) % pool.length];
      if (!used.has(c)) return c;
    }
  };
  // Random first pick, then repair: re-draw one side face that took part in
  // a word until nothing readable is left. Fully deterministic (seeded).
  const faces: CubeFaces[] = plans.map((p) => {
    const used = new Set<string>([p.char]);
    return Array.from({ length: 6 }, (_, fi) => {
      if (fi === TOP_FACE) return p.char;
      const c = draw(used);
      used.add(c);
      return c;
    });
  });
  let best = faces.map((f) => [...f]);
  for (let iter = 0; iter < 600; iter++) {
    const hits = findWordViolations(plans, faces);
    if (hits.length === 0) {
      best = faces.map((f) => [...f]);
      break;
    }
    const hit = hits[Math.floor(rng() * hits.length) % hits.length];
    const [ci, fi] = hit.faces[Math.floor(rng() * hit.faces.length) % hit.faces.length];
    faces[ci][fi] = draw(new Set(faces[ci]));
    best = faces.map((f) => [...f]);
  }
  cache.set(key, best);
  return best;
};
