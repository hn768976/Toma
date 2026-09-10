// A plain textbook binary-search-tree module. Deliberately generic: no
// keys, hostnames, real-looking paths, product names or company names.
export const PROMPT_LINE = "Write code for implementations of data structures";

export const PYTHON_SOURCE = `class TreeNode:
    def __init__(self, key, value=None):
        self.key = key
        self.value = value
        self.left = None
        self.right = None


class BinarySearchTree:
    """An ordered map backed by a binary search tree."""

    def __init__(self):
        self.root = None
        self.size = 0

    def insert(self, key, value=None):
        self.root = self._insert(self.root, key, value)

    def _insert(self, node, key, value):
        if node is None:
            self.size += 1
            return TreeNode(key, value)
        if key < node.key:
            node.left = self._insert(node.left, key, value)
        elif key > node.key:
            node.right = self._insert(node.right, key, value)
        else:
            node.value = value
        return node

    def search(self, key):
        node = self.root
        while node is not None:
            if key == node.key:
                return node.value
            node = node.left if key < node.key else node.right
        return None

    def find_min(self):
        # The smallest key always sits at the leftmost node.
        node = self.root
        while node is not None and node.left is not None:
            node = node.left
        return node.key if node is not None else None

    def inorder_traversal(self):
        """Yield every key in the tree in ascending order."""
        stack, node = [], self.root
        while stack or node is not None:
            while node is not None:
                stack.append(node)
                node = node.left
            node = stack.pop()
            yield node.key
            node = node.right`;
