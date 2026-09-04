import type { Content } from "./types";

export const PYTHON_CODE = `"""Streaming ingest pipeline for telemetry records."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Iterable, Iterator, Optional

logger = logging.getLogger(__name__)

@dataclass(slots=True)
class StreamConfig:
    """Runtime options for a single ingest worker."""

    source: Path
    batch_size: int = 256
    max_retries: int = 3
    timeout_s: float = 12.5
    tags: list[str] = field(default_factory=list)

    def merged(self, overrides: dict[str, Any]) -> "StreamConfig":
        # Unknown keys are dropped on purpose rather than merged blindly.
        known = {k: v for k, v in overrides.items() if hasattr(self, k)}
        return replace(self, **known)


def read_records(path: Path) -> Iterator[dict[str, Any]]:
    """Yield one decoded record per line, skipping malformed rows."""
    with path.open("r", encoding="utf-8") as handle:
        for lineno, raw in enumerate(handle, start=1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError as exc:
                logger.warning("line %d is not valid json: %s", lineno, exc)


def batched(items: Iterable[Any], size: int) -> Iterator[list[Any]]:
    buffer: list[Any] = []
    for item in items:
        buffer.append(item)
        if len(buffer) >= size:
            yield buffer
            buffer = []
    if buffer:
        yield buffer


def run(config: StreamConfig) -> int:
    total = 0
    for batch in batched(read_records(config.source), config.batch_size):
        total += len(batch)
        logger.info("flushed %d records (%d total)", len(batch), total)
    return total`;

export const PYTHON: Content = {
  id: "python",
  workspace: "telemetry-service",
  branch: "feat/ingest-retry",
  breadcrumb: ["src", "ingest", "pipeline.py"],
  language: "python",
  code: PYTHON_CODE,
  tabs: [
    { label: "schema.py", active: false },
    { label: "pipeline.py", active: true, dot: true },
    { label: "retry.py", active: false },
  ],
  tree: [
    { depth: 0, label: "src", kind: "open" },
    { depth: 1, label: "ingest", kind: "open" },
    { depth: 2, label: "__init__.py", kind: "file" },
    { depth: 2, label: "pipeline.py", kind: "file", active: true, warn: true },
    { depth: 2, label: "schema.py", kind: "file" },
    { depth: 1, label: "transforms", kind: "closed" },
    { depth: 1, label: "api", kind: "open" },
    { depth: 2, label: "routes.py", kind: "file" },
    { depth: 2, label: "deps.py", kind: "file" },
    { depth: 1, label: "utils", kind: "open" },
    { depth: 2, label: "retry.py", kind: "file", warn: true },
    { depth: 2, label: "timing.py", kind: "file" },
    { depth: 1, label: "settings.py", kind: "file" },
    { depth: 0, label: "tests", kind: "closed" },
    { depth: 0, label: "scripts", kind: "closed" },
    { depth: 0, label: "pyproject.toml", kind: "file" },
    { depth: 0, label: "ruff.toml", kind: "file" },
    { depth: 0, label: "Dockerfile", kind: "file" },
    { depth: 0, label: "README.md", kind: "file" },
  ],
  terminal: {
    command: "ruff check src/ingest/pipeline.py --statistics",
    warnings: [
      {
        loc: "src/ingest/pipeline.py:9:44",
        rule: "F401",
        message: "`typing.Optional` imported but unused",
      },
      {
        loc: "src/ingest/pipeline.py:26:16",
        rule: "ANN401",
        message: "dynamic `Any` leaks out of `merged`",
      },
    ],
    summary: "Found 2 warnings, 0 errors  (fixable with --fix)",
  },
  chat: {
    first: "Why does read_records skip malformed rows silently?",
    reply: [
      "It only skips rows that fail to decode, and every skip is logged at",
      "warning level with the line number. To fail hard instead, re-raise:",
    ],
    replyCode: `except json.JSONDecodeError as exc:
    raise IngestError(lineno) from exc`,
    follow: "Could it collect the bad rows and return them too?",
  },
};
