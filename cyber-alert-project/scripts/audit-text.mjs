// Text audit: regenerates every code line used by the scenes (same seeds and
// generator as src/) plus the fixed labels, and checks them.
// Run: node --experimental-strip-types --import ./scripts/register-hooks.mjs scripts/audit-text.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { makeCode } from "../src/lib/code.ts";

const lines = [];
// Look 2 columns: seeds 0x5000 + i*31, lengths 40/60/80
for (let i = 0; i < 12; i++) lines.push(...makeCode(0x5000 + i * 31, 80, 19));
// Look 3 blocks: generated for many seeds; sample widely
for (let s = 0; s < 400; s++) lines.push(...makeCode(s * 7919 + 13, 60, 44));

// Literal strings in the scene sources
const literals = [];
for (const f of readdirSync(new URL("../src/looks/", import.meta.url))) {
  const src = readFileSync(new URL(`../src/looks/${f}`, import.meta.url), "utf8");
  for (const m of src.matchAll(/(["'`])([A-Z][A-Z0-9 _./:>-]{3,})\1/g)) literals.push(m[2]);
  for (const m of src.matchAll(/>\s*([A-Z][^<{]{3,})\s*</g)) literals.push(m[1].trim());
}
const all = [...lines, ...literals];

const ipRe = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;
const allowed = [/^192\.0\.2\./, /^198\.51\.100\./, /^203\.0\.113\./];
const badIps = new Set();
for (const l of all) for (const m of l.matchAll(ipRe)) if (!allowed.some((r) => r.test(m[0]))) badIps.add(m[0]);
// Also catch IPs cut short by truncation, e.g. "203.0.11"
const partial = new Set();
for (const l of all) for (const m of l.matchAll(/\d{1,3}\.\d{1,3}\.\d{1,3}(\.\d{0,3})?/g)) if (!/^(192\.0\.2|198\.51\.100|203\.0\.113)/.test(m[0])) partial.add(m[0]);

const brands = ["google", "microsoft", "windows", "apple", "linux", "oracle", "cisco", "amazon", "aws", "azure", "facebook", "meta", "twitter", "github", "intel", "nvidia", "samsung", "ibm", "android", "ios", "chrome", "firefox", "mysql", "postgres", "openssl", "kaspersky", "norton", "mcafee", "paypal", "visa", "mastercard", "netflix", "adobe", "java", "python", "node.js", "react", "remotion", "shutterstock", "istock", "getty", "jetbrains", "inter"];
const words = new Set(all.join(" ").toLowerCase().split(/[^a-z.]+/).filter(Boolean));
const hits = brands.filter((b) => words.has(b));

writeFileSync(new URL("../out/verify/text-audit.txt", import.meta.url), [...new Set(all)].join("\n"));
console.log(`text audit: ${new Set(all).size} unique strings`);
console.log(`  non-documentation IPs: ${badIps.size ? [...badIps].join(", ") : "none"}`);
console.log(`  suspicious partial IPs: ${partial.size ? [...partial].join(", ") : "none"}`);
console.log(`  brand/product words: ${hits.length ? hits.join(", ") : "none"}`);
const deps = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const depNames = Object.keys({ ...deps.dependencies, ...deps.devDependencies });
console.log(`  dependencies: ${depNames.join(", ")}`);
const icon = depNames.filter((d) => /icon|fontawesome|lucide|heroicons|feather|material|svg/i.test(d));
console.log(`  icon libraries: ${icon.length ? icon.join(", ") : "none"}`);
process.exit(badIps.size || hits.length || icon.length ? 1 : 0);
