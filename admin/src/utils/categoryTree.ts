import type { Category } from '../api/types';

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  depth: number;
}

export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const nodeById = new Map<string, CategoryTreeNode>(
    categories.map((c) => [c.id, { ...c, children: [], depth: 0 }]),
  );
  const roots: CategoryTreeNode[] = [];

  for (const category of categories) {
    const node = nodeById.get(category.id)!;
    if (category.parentId) {
      const parent = nodeById.get(category.parentId);
      if (parent) {
        node.depth = parent.depth + 1;
        parent.children.push(node);
        continue;
      }
    }
    roots.push(node);
  }

  const sortNodes = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);

  return roots;
}

export function flattenTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)]);
}

// A category's own id plus every descendant's — what can't be chosen as its
// parent (that would create a cycle).
export function selfAndDescendantIds(categories: Category[], id: string): Set<string> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
    }
  }
  return ids;
}

export interface CategoryPathOption extends CategoryTreeNode {
  // "Rings › Gemstone Rings" — the full ancestor path, so two subcategories
  // with the same name under different parents can be told apart.
  pathLabel: string;
}

// Every category in tree order (parent, then its children), each labelled
// with its full path — what every category dropdown in the admin shows.
export function categoryPathOptions(categories: Category[]): CategoryPathOption[] {
  const out: CategoryPathOption[] = [];
  const walk = (nodes: CategoryTreeNode[], parentPath: string) => {
    for (const n of nodes) {
      const pathLabel = parentPath ? `${parentPath} › ${n.name}` : n.name;
      out.push({ ...n, pathLabel });
      walk(n.children, pathLabel);
    }
  };
  walk(buildCategoryTree(categories), '');
  return out;
}
