#!/bin/bash
# Installs and registers the Rive MCP server on every Claude Code on the web
# session. Remote containers are ephemeral, so both the global npm package and
# the user-scope MCP registration are recreated from scratch each time.
set -euo pipefail

# Local machines keep their own npm globals and MCP config; leave them alone.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# A missing Rive server should never block the session from starting.
warn() { echo "session-start: $*" >&2; }

if ! command -v rive-mcp >/dev/null 2>&1; then
  if ! npm install -g rive-mcp-server; then
    warn "npm install -g rive-mcp-server failed; skipping MCP registration"
    exit 0
  fi
fi

if ! command -v claude >/dev/null 2>&1; then
  warn "claude CLI not on PATH; skipping MCP registration"
  exit 0
fi

# `claude mcp add` exits 1 when the name is already taken, so guard on `get`.
if ! claude mcp get rive >/dev/null 2>&1; then
  if ! claude mcp add --scope user rive -- rive-mcp; then
    warn "claude mcp add rive failed"
    exit 0
  fi
fi

echo "session-start: rive MCP server ready"
