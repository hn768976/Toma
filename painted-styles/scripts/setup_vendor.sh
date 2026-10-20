#!/usr/bin/env bash
# Clone claude-drawing-skill at the pinned commit (MIT, see licenses/).
set -euo pipefail
cd "$(dirname "$0")/.."
PIN=24418f3f61963ea6c4964537dad732c4ad7467c6
[ -d vendor/claude-drawing-skill/.git ] || git clone https://github.com/cloveric/claude-drawing-skill.git vendor/claude-drawing-skill
git -C vendor/claude-drawing-skill checkout -q "$PIN"
python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt
