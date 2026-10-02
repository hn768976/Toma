#!/usr/bin/env bash
# Builds tech-loops-five-project.zip next to this project, without
# node_modules, .git and render output.
set -euo pipefail
cd "$(dirname "$0")/../.."
NAME=tech-loops-five
rm -f tech-loops-five-project.zip
zip -r -q tech-loops-five-project.zip "$NAME" \
  -x "$NAME/node_modules/*" "$NAME/out/*" "$NAME/.git/*" "$NAME/dist/*" "$NAME/*.log" "$NAME/.DS_Store"
ls -la tech-loops-five-project.zip
