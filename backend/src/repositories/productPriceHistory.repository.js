// Always called with the transaction client from withTransaction (config/db.js)
// — every price change is written atomically alongside the product update.
export async function insertPriceHistory(
  client,
  { productId, oldSellingPrice, newSellingPrice, goldRateId, reason },
) {
  await client.query(
    `INSERT INTO product_price_history
       (product_id, old_selling_price, new_selling_price, gold_rate_id, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [productId, oldSellingPrice, newSellingPrice, goldRateId ?? null, reason],
  );
}
