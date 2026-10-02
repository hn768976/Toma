/**
 * The code shown in AI Code Screen: an original binary-search-tree
 * implementation written for this project. Edit CODE freely; the block
 * length (number of lines) automatically sets the scroll distance per loop.
 * Keep a blank line at the end so the repeat reads as a natural break.
 */
export const CODE = `class Node:
    """One entry in a binary search tree."""

    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

class BinarySearchTree:
    def __init__(self):
        self.root = None
        self.size = 0

    def insert(self, key):
        """Add a key; keys already in the tree are skipped."""
        if self.root is None:
            self.root = Node(key)
            self.size += 1
            return
        current = self.root
        while True:
            if key < current.key:
                if current.left is None:
                    current.left = Node(key)
                    break
                current = current.left
            elif key > current.key:
                if current.right is None:
                    current.right = Node(key)
                    break
                current = current.right
            else:
                return  # already present
        self.size += 1

    def search(self, key):
        node = self.root
        while node is not None and node.key != key:
            node = node.left if key < node.key else node.right
        return node

    def find_min(self):
        node = self.root
        if node is None:
            raise ValueError("tree is empty")
        while node.left is not None:
            node = node.left
        return node.key

    def in_order(self):
        """Yield every key in ascending order, without recursion."""
        stack, node = [], self.root
        while stack or node:
            while node:
                stack.append(node)
                node = node.left
            node = stack.pop()
            yield node.key
            node = node.right

if __name__ == "__main__":
    tree = BinarySearchTree()
    for value in (50, 30, 70, 20, 40, 60, 80):
        tree.insert(value)
    print(list(tree.in_order()))
    print(tree.find_min(), tree.search(60) is not None)

`;

export type TokenKind =
  | "plain"
  | "keyword"
  | "builtin"
  | "self"
  | "fn"
  | "cls"
  | "string"
  | "number"
  | "comment"
  | "op";

export type Token = { text: string; kind: TokenKind };

const KEYWORDS = new Set([
  "class", "def", "return", "if", "elif", "else", "while", "for", "in", "is",
  "not", "and", "or", "None", "True", "False", "break", "raise", "yield",
  "import", "from", "as", "pass", "continue", "lambda", "with", "try", "except",
]);
const BUILTINS = new Set(["print", "list", "len", "range", "ValueError", "__name__", "super"]);

/** A small Python highlighter, run once at module load. */
const tokenizeLine = (line: string): Token[] => {
  const out: Token[] = [];
  const re =
    /(\s+)|("""[^"]*"""|"[^"]*"|'[^']*')|(#.*$)|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|([^\sA-Za-z0-9_])/g;
  let prevWord = "";
  for (let m = re.exec(line); m; m = re.exec(line)) {
    const [text, ws, str, comment, num, word] = m;
    if (ws) out.push({ text, kind: "plain" });
    else if (str) out.push({ text, kind: "string" });
    else if (comment) out.push({ text, kind: "comment" });
    else if (num) out.push({ text, kind: "number" });
    else if (word) {
      let kind: TokenKind = "plain";
      if (prevWord === "def") kind = "fn";
      else if (prevWord === "class") kind = "cls";
      else if (KEYWORDS.has(word)) kind = "keyword";
      else if (word === "self") kind = "self";
      else if (BUILTINS.has(word)) kind = "builtin";
      else if (/^[A-Z]/.test(word)) kind = "cls";
      else if (line.slice(re.lastIndex).startsWith("(")) kind = "fn";
      out.push({ text, kind });
      prevWord = word;
    } else out.push({ text, kind: "op" });
  }
  return out;
};

export const CODE_LINES: Token[][] = CODE.replace(/\n$/, "")
  .split("\n")
  .map(tokenizeLine);
