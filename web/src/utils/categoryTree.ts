import type { Category } from '../api/types';

export function findCategoryBySlug(categories: Category[], slug: string): Category | null {
  return categories.find((c) => c.slug === slug) ?? null;
}

// Root-first ancestor chain, e.g. Rings -> Gemstone Rings -> [category itself].
export function getAncestorChain(categories: Category[], category: Category): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const chain: Category[] = [category];
  let current = category;
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}

export function getChildCategories(categories: Category[], parentId: string): Category[] {
  return categories
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
