#!/bin/sh
# Bundle once; the other tools render from out/bundle (fast, and safe to run in parallel).
cd "$(dirname "$0")/.." && rm -rf out/bundle && npx remotion bundle src/index.ts --out-dir=out/bundle 2>&1 | tail -2
