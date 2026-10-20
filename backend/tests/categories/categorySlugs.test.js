import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../src/config/db.js';
import { createCategory, updateCategory } from '../../src/services/categoriesService.js';

// Category URLs are /<slug>, so slugs are unique site-wide — but the same
// subcategory name under different parents must still be creatable.

const created = [];
after(async () => {
  // Newest first, so subcategories are removed before their parents.
  for (const id of created.reverse()) await query('DELETE FROM categories WHERE id = $1', [id]);
});

async function make(input) {
  const category = await createCategory({ isActive: true, sortOrder: 0, ...input });
  created.push(category.id);
  return category;
}

describe('category slugs', () => {
  const tag = `t${Date.now().toString(36)}`;

  test('same subcategory name under two parents gets the parent appended', async () => {
    const rings = await make({ name: `${tag} Rings` });
    const earrings = await make({ name: `${tag} Earrings` });

    const first = await make({ name: 'Plain Gold Test', parentId: rings.id });
    const second = await make({ name: 'Plain Gold Test', parentId: earrings.id });

    assert.equal(first.slug, 'plain-gold-test');
    assert.equal(second.slug, `plain-gold-test-${earrings.slug}`);
  });

  test('a third clash falls back to a number', async () => {
    const parent = await make({ name: `${tag} Bangles` });
    const a = await make({ name: `${tag} Twist`, parentId: parent.id });
    const b = await make({ name: `${tag} Twist`, parentId: parent.id });
    assert.equal(b.slug, `${a.slug}-${parent.slug}`);
    const c = await make({ name: `${tag} Twist`, parentId: parent.id });
    assert.equal(c.slug, `${a.slug}-${parent.slug}-2`);
  });

  test('a hand-typed slug that is taken is rejected with a clear message', async () => {
    const taken = await make({ name: `${tag} Chains` });
    await assert.rejects(
      () => make({ name: 'Anything', slug: taken.slug }),
      (err) => err.status === 409 && err.message.includes(taken.name),
    );
  });

  test('re-saving a category with its own slug is not a clash', async () => {
    const own = await make({ name: `${tag} Studs` });
    const updated = await updateCategory(own.id, { slug: own.slug, name: `${tag} Studs` });
    assert.equal(updated.slug, own.slug);
  });
});
