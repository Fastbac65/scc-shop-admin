import { shopifyClient, readBody } from './_shopify.js';

const LOCATION_ID = 'gid://shopify/Location/108890554671';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { gql } = shopifyClient();
  try {
    const { inventoryItemId, currentQty, newQty } = await readBody(req);
    const delta = newQty - currentQty;
    if (delta === 0) return res.status(200).json({ ok: true });
    const result = await gql(`
      mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
        inventoryAdjustQuantities(input: $input) {
          inventoryAdjustmentGroup { reason }
          userErrors { field message }
        }
      }`, {
      input: {
        reason: 'correction',
        name: 'available',
        changes: [{ inventoryItemId, locationId: LOCATION_ID, delta }],
      },
    });
    const errs = result.inventoryAdjustQuantities.userErrors;
    if (errs.length) throw new Error(errs.map(e => e.message).join(', '));
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
