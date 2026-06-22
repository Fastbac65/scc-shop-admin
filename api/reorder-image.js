import { shopifyClient, readBody } from './_shopify.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { gql } = shopifyClient();
  try {
    const { productId, mediaId } = await readBody(req);
    const productGid = `gid://shopify/Product/${productId}`;
    const r = await gql(`
      mutation productReorderMedia($id: ID!, $moves: [MoveInput!]!) {
        productReorderMedia(id: $id, moves: $moves) {
          job { id }
          userErrors { field message }
        }
      }`, {
      id: productGid,
      moves: [{ id: mediaId, newPosition: '0' }],
    });
    const errs = r.productReorderMedia.userErrors;
    if (errs.length) return res.status(400).json({ error: errs[0].message });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
