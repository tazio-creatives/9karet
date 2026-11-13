import { searchProducts } from '../repositories/products.repository.js';
import { searchCategories } from '../repositories/categories.repository.js';
import { searchCollections } from '../repositories/collections.repository.js';

export async function search(term) {
  const [products, categories, collections] = await Promise.all([
    searchProducts(term),
    searchCategories(term),
    searchCollections(term),
  ]);
  return { products, categories, collections };
}
