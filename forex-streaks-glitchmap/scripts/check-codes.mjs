// Verifies that none of the invented board codes is an ISO 4217 currency code
// or a well-known ticker/index/crypto symbol.  Run: node scripts/check-codes.mjs
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/looks/board/data.ts", import.meta.url), "utf8");
const codes = [...src.match(/export const CODES = \[([\s\S]*?)\]/)[1].matchAll(/"([A-Z]{3})"/g)].map((m) => m[1]);

const ISO4217 = `AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRO MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS VED VES VND VUV WST XAF XAG XAU XBA XBB XBC XBD XCD XDR XOF XPD XPF XPT XSU XTS XUA XXX YER ZAR ZMW ZWL CNH BTC ETH XRP LTC DOGE SOL ADA`.split(/\s+/);
const WELL_KNOWN = `IBM GOOG META AMZN NFLX TSLA NVDA AAPL MSFT INTC AMD ORCL CSCO UBER LYFT SNAP PYPL SQ COIN HOOD DAX FTSE SPX NDX DJI NKY HSI CAC SMI IBEX AEX ASX TSX BSE SSE VIX WTI BRN CL GC SI HG NG ZB ZN ZF ES NQ YM RTY TEL ORA GOL`.split(/\s+/);

let bad = 0;
for (const c of codes) {
  if (ISO4217.includes(c)) { console.error(`${c}: is an ISO 4217 / crypto code`); bad++; }
  if (WELL_KNOWN.includes(c)) { console.error(`${c}: is a well-known ticker/index`); bad++; }
}
if (new Set(codes).size !== codes.length) { console.error("duplicate codes"); bad++; }
console.log(`${codes.length} codes checked, ${bad} problems`);
process.exit(bad ? 1 : 0);
