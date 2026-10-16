# Invented ticker symbols (Stock Screen)

All 40 symbols shown on the Stock Screen board are made up. They live in
`src/looks/stock/tickers.ts`. Every price and change is generated from a fixed
seed; nothing is real market data.

| 3 letters | | | | | | | | | |
|---|---|---|---|---|---|---|---|---|---|
| QXV | ZJK | XQR | VZQ | JQX | KZX | QVJ | ZXQ | XJQ | QZK |
| VJX | ZQJ | XKZ | JZV | QJV | ZKQ | XVJ | KQX | JXZ | QKJ |

| 4 letters | | | | | | | | | |
|---|---|---|---|---|---|---|---|---|---|
| QZVX | XJQK | ZVQJ | JQZX | KXQV | VQZJ | QXJZ | ZJXK | XZVQ | JVQX |
| QKZV | ZXJV | VXQK | KJZQ | XQZJ | QVXK | ZQKX | JKQZ | VZXJ | XKJQ |

## How the list was checked

- Each code contains **at least two of the rare letters Q, X, Z, J** and no
  vowels, so none is pronounceable or spells a word, brand or company
  abbreviation.
- The list was checked against well-known tickers and abbreviations (large
  US, European and Asian listings, index and ETF tickers, crypto symbols and
  currency codes). None matched. Codes that came close to real ones in an
  earlier draft (for example ones used in the reference clip, such as SNY or
  GBM) were not used.
- No exchange names, logos or brands appear anywhere on the board.

If you localise or extend the list, keep to the same pattern (two or more of
Q/X/Z/J, no vowels) and re-check the additions before release.
