#!/usr/bin/env bash
# Rejoins the byte-exact parts into Cubes_ETF.mp4 and Cubes_401K.mp4 and
# verifies them against SHA256SUMS.txt.
set -euo pipefail
cd "$(dirname "$0")"
for A in ETF 401K; do cat Cubes_$A.mp4.part* > Cubes_$A.mp4; done
sha256sum -c SHA256SUMS.txt
