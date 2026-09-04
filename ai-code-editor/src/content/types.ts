export type TreeNode = {
  depth: number;
  label: string;
  kind: "open" | "closed" | "file";
  active?: boolean;
  warn?: boolean;
};

export type Warning = {
  loc: string;
  rule: string;
  message: string;
};

export type ChatCodeLine = { indent: number; text: string; language: "python" | "tsx" };

export type Content = {
  id: string;
  workspace: string;
  branch: string;
  breadcrumb: string[];
  language: "python" | "tsx";
  code: string;
  tabs: { label: string; active: boolean; dot?: boolean }[];
  tree: TreeNode[];
  terminal: {
    command: string;
    warnings: Warning[];
    summary: string;
  };
  chat: {
    first: string;
    reply: string[];
    replyCode: string;
    follow: string;
  };
};
