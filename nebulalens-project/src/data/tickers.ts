// Invented 3–4 letter codes used on every chart label. None of them is a
// real ticker: each was checked against the well-known crypto symbols (top
// ~200 by market cap) and major US/EU equity and ETF tickers, and every code
// deliberately contains a Q, X or Z combination that real symbols avoid.
// The values shown next to them are made up (seeded random).
export const CODES = [
  "QZRA", "VYLX", "JQOT", "KRVZ", "ZWEN", "XQUA", "YOKZ", "PLQX",
  "WZEB", "FQIR", "HQZE", "NXQO", "BZRQ", "DQWE", "TQEV", "MZQA",
  "GQYL", "RXQE", "CQVO", "OQIX", "LZVQ", "EQYR", "QJV", "ZQK",
] as const;
