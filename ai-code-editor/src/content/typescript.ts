import type { Content } from "./types";

export const TSX_CODE = `import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiClient } from "../api/client";
import { Toolbar } from "../components/Toolbar";
import type { SortDirection } from "../api/types";

export interface DatasetOptions {
  query: string;
  pageSize?: number;
  direction?: SortDirection;
}

interface DatasetState<T> {
  rows: T[];
  total: number;
  loading: boolean;
  error: string | null;
}

const EMPTY: DatasetState<never> = {
  rows: [],
  total: 0,
  loading: false,
  error: null,
};

export function useDataset<T>(options: DatasetOptions) {
  const { query, pageSize = 50, direction = "asc" } = options;
  const [state, setState] = useState<DatasetState<T>>(EMPTY);
  const inFlight = useRef<AbortController | null>(null);

  const params = useMemo(
    () => ({ q: query.trim(), limit: pageSize, dir: direction }),
    [query, pageSize, direction],
  );

  const load = useCallback(async () => {
    // Cancel the previous request so late responses cannot win the race.
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const page = await apiClient.get("/datasets", params, controller.signal);
      setState({ rows: page.rows as T[], total: page.total, loading: false, error: null });
    } catch (err) {
      if (controller.signal.aborted) return;
      setState((prev) => ({ ...prev, loading: false, error: String(err) }));
    }
  }, [params]);

  useEffect(() => {
    void load();
    return () => inFlight.current?.abort();
  }, [load]);

  return { ...state, reload: load, Toolbar };
}`;

export const TYPESCRIPT: Content = {
  id: "typescript",
  workspace: "insights-console",
  branch: "feat/dataset-hook",
  breadcrumb: ["src", "hooks", "useDataset.ts"],
  language: "tsx",
  code: TSX_CODE,
  tabs: [
    { label: "DataTable.tsx", active: false },
    { label: "useDataset.ts", active: true, dot: true },
    { label: "client.ts", active: false },
  ],
  tree: [
    { depth: 0, label: "src", kind: "open" },
    { depth: 1, label: "components", kind: "open" },
    { depth: 2, label: "DataTable.tsx", kind: "file" },
    { depth: 2, label: "Toolbar.tsx", kind: "file" },
    { depth: 1, label: "hooks", kind: "open" },
    { depth: 2, label: "useDataset.ts", kind: "file", active: true, warn: true },
    { depth: 2, label: "useDebounce.ts", kind: "file" },
    { depth: 1, label: "pages", kind: "closed" },
    { depth: 1, label: "api", kind: "open" },
    { depth: 2, label: "client.ts", kind: "file", warn: true },
    { depth: 2, label: "types.ts", kind: "file" },
    { depth: 1, label: "utils", kind: "closed" },
    { depth: 0, label: "tests", kind: "closed" },
    { depth: 0, label: "package.json", kind: "file" },
    { depth: 0, label: "tsconfig.json", kind: "file" },
    { depth: 0, label: "vite.config.ts", kind: "file" },
    { depth: 0, label: "README.md", kind: "file" },
  ],
  terminal: {
    command: "tsc --noEmit && eslint src/hooks/useDataset.ts",
    warnings: [
      {
        loc: "src/hooks/useDataset.ts:46:24",
        rule: "TS2571",
        message: "object is of type 'unknown' before the cast to T[]",
      },
      {
        loc: "src/hooks/useDataset.ts:58:36",
        rule: "react-hooks",
        message: "'Toolbar' is returned but never re-rendered",
      },
    ],
    summary: "Found 2 warnings, 0 errors  (0 fixable)",
  },
  chat: {
    first: "What actually triggers a refetch inside useDataset?",
    reply: [
      "Only params changes. It is memoised on query, pageSize and direction,",
      "so a new object identity alone will not re-run the effect:",
    ],
    replyCode: `const params = useMemo(
  () => ({ q: query.trim(), limit: pageSize }),
  [query, pageSize],
);`,
    follow: "How would I debounce the query before it hits params?",
  },
};
