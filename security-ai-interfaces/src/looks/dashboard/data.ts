// Look 1 text labels and generated tables. All generic placeholder text.
// Every table is built ONCE at module load from a seeded mulberry32.
import { LAND_MASK } from "../../data/world";
import { makeSeries, mulberry32, rInt, rRange, rPick } from "../../lib/random";

export const L = {
  title: "CYBER SECURITY",
  subtitle: "SECURITY OPERATIONS CENTER",
  nav: ["PROTECT", "DETECT", "RESPOND", "SECURE"],
  threatLevel: "THREAT LEVEL",
  live: "SOC-01  LIVE",
  ringSecure: ["SYSTEM SECURE", "All protections active"],
  ringThreat: ["THREAT DETECTED", "Suspicious activity"],
  ringScan: ["SCANNING", "Deep system scan"],
  statusTitle: "SYSTEM STATUS",
  status: [
    { icon: "firewall", name: "Firewall Status", state: "ACTIVE" },
    { icon: "bug", name: "Antivirus", state: "RUNNING" },
    { icon: "radar", name: "Intrusion Detection", state: "MONITORING" },
  ] as const,
  accessTitle: "ACCESS CONTROL",
  access: [
    { name: "Server Room A", state: "GRANTED" },
    { name: "Data Center", state: "GRANTED" },
    { name: "Admin Console", state: "DENIED" },
    { name: "Records Database", state: "GRANTED" },
    { name: "Backup Vault", state: "PENDING" },
    { name: "API Gateway", state: "GRANTED" },
  ] as const,
  encTitle: "DATA ENCRYPTION",
  encCipher: "AES-256",
  encFiles: ["archive_07.bin", "records_q3.db", "keystore_main.vlt"],
  logTitle: "SECURITY EVENT LOG",
  mapTitle: "GLOBAL THREAT MAP",
  mapLegend: ["High Risk", "Medium Risk", "Low Risk"],
  analyticsTitle: "SECURITY ANALYTICS",
  analyticsRange: "LAST 24 H",
  gauges: ["CPU", "MEMORY", "NETWORK"],
  intelTitle: "THREAT INTELLIGENCE",
  intel: [
    { icon: "bug", name: "Malware", base: 3415 },
    { icon: "message", name: "Phishing", base: 1205 },
    { icon: "fileLock", name: "Ransomware", base: 644 },
    { icon: "bolt", name: "DDoS", base: 316 },
    { icon: "eye", name: "Spyware", base: 457 },
  ] as const,
  netTitle: "NETWORK ACTIVITY",
  fpTitle: "BIOMETRIC AUTHENTICATION",
  fpChecks: ["Fingerprint", "Face Scan", "Device", "Location"],
  authTitle: "USER AUTHENTICATION",
  authUser: "analyst_07",
  vpnTitle: "SECURE CONNECTION",
  vpnIp: "203.0.113.24",
  scanTitle: "FILE SCANNING",
  scanPaths: ["C:\\Workspace\\Assets", "C:\\Workspace\\Config", "C:\\System\\Modules", "D:\\Archive\\Backups"],
  alertTitle: "UNAUTHORIZED ACCESS",
};

// ---- event log block (scrolls exactly one block per loop) -------------
const LOG_MSGS: [string, string][] = [
  ["INFO", "Login success: user_041"],
  ["WARN", "Suspicious IP 203.0.113.47"],
  ["ALERT", "Malware blocked: payload.tmp"],
  ["INFO", "Firewall rules updated"],
  ["INFO", "Signature database synced"],
  ["WARN", "Port scan from 198.51.100.12"],
  ["INFO", "Certificate renewed"],
  ["ALERT", "Unauthorized access attempt"],
  ["INFO", "VPN tunnel re-established"],
  ["WARN", "Brute-force attempt throttled"],
  ["INFO", "Backup integrity verified"],
  ["INFO", "Session tokens rotated"],
  ["ALERT", "Privilege escalation denied"],
  ["INFO", "New device enrolled"],
  ["WARN", "Anomaly score elevated"],
  ["INFO", "Patch level verified"],
];
export const LOG_LINES = (() => {
  let t = 14 * 3600 + 20 * 60 + 5;
  const r = mulberry32(101);
  return LOG_MSGS.map(([tag, msg]) => {
    t += rInt(r, 4, 41);
    const hh = String(Math.floor(t / 3600)).padStart(2, "0");
    const mm = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
    const ss = String(t % 60).padStart(2, "0");
    return { time: `${hh}:${mm}:${ss}`, tag, msg };
  });
})();

// ---- threat map dots, sampled on land from the Natural Earth mask ------
const PERIODS = [60, 75, 100, 120, 150, 200] as const;
export const MAP_DOTS = (() => {
  const r = mulberry32(202);
  const out: { lon: number; lat: number; kind: 0 | 1 | 2; period: number; offset: number }[] = [];
  let guard = 0;
  while (out.length < 46 && guard++ < 20000) {
    const lon = rRange(r, -170, 178);
    const lat = rRange(r, -45, 68);
    const row = Math.floor(90 - lat);
    const col = Math.floor(lon + 180);
    if (LAND_MASK[row]?.[col] !== "1") continue;
    const k = r();
    const period = rPick(r, PERIODS);
    out.push({ lon, lat, kind: k < 0.28 ? 0 : k < 0.52 ? 1 : 2, period, offset: rInt(r, 0, period - 1) });
  }
  return out;
})();
export const MAP_ARCS = (() => {
  const r = mulberry32(303);
  const reds = MAP_DOTS.map((d, i) => ({ d, i })).filter((x) => x.d.kind === 0);
  return Array.from({ length: 7 }, () => {
    const a = rPick(r, reds).i;
    let b = rInt(r, 0, MAP_DOTS.length - 1);
    if (b === a) b = (b + 5) % MAP_DOTS.length;
    const period = rPick(r, [100, 120, 150] as const);
    return { a, b, period, offset: rInt(r, 0, period - 1) };
  });
})();

// ---- chart series (periodic, wrap seamlessly) -------------------------
export const SERIES_TRAFFIC = makeSeries(404, 96);
export const SERIES_THREATS = makeSeries(405, 96, [1, 3, 4, 7, 11]);
export const SERIES_NET = makeSeries(406, 60, [1, 2, 5, 7, 9, 12]);

export const STATUS_BARS = (() => {
  const r = mulberry32(505);
  return [0, 1, 2].map(() =>
    Array.from({ length: 14 }, () => ({ cycles: rInt(r, 2, 7), phase: r(), base: rRange(r, 0.15, 0.4) })),
  );
})();

// ---- fingerprint ridges (generated arcs with gaps) ---------------------
export const FP_RIDGES = (() => {
  const r = mulberry32(606);
  const paths: string[] = [];
  for (let i = 0; i < 11; i++) {
    const rx = 4 + i * 4.2;
    const ry = 5 + i * 5.4;
    const start = -Math.PI * (0.05 + r() * 0.15);
    const end = Math.PI * (1.05 + r() * 0.15);
    // arc split in up to three segments with small gaps
    const gaps = [r() * 0.6 + 0.15, r() * 0.6 + 0.25];
    const segs: [number, number][] = [];
    let a0 = start;
    for (const g of gaps) {
      const a1 = start + (end - start) * g;
      if (a1 - a0 > 0.15) segs.push([a0, a1 - 0.08]);
      a0 = a1 + 0.08;
    }
    segs.push([a0, end]);
    // lower half for the outer ridges (a loop-like print)
    let d = "";
    for (const [s, e] of segs) {
      const steps = 18;
      for (let k = 0; k <= steps; k++) {
        const a = s + ((e - s) * k) / steps;
        const x = -Math.cos(a) * rx;
        const y = -Math.sin(a) * ry + (i > 2 ? i * 0.9 : 0);
        d += `${k === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      }
    }
    if (i >= 3) {
      const yb = i * 0.9;
      d += `M${(-rx).toFixed(2)} ${yb.toFixed(2)}Q${(-rx * 0.95).toFixed(2)} ${(ry * 0.55).toFixed(2)} ${(-rx * 0.45).toFixed(2)} ${(ry * 0.8).toFixed(2)}`;
      d += `M${rx.toFixed(2)} ${yb.toFixed(2)}Q${(rx * 0.95).toFixed(2)} ${(ry * 0.5).toFixed(2)} ${(rx * 0.5).toFixed(2)} ${(ry * 0.78).toFixed(2)}`;
    }
    paths.push(d);
  }
  return paths;
})();
