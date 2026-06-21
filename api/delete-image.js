import { shopifyClient, readBody } from './_shopify.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { gql } = shopifyClient();
  try {
    const { productId, mediaId } = await readBody(req);
    const r = await gql(`
      mutation productDeleteMedia($productId: ID!, $mediaIds: [ID!]!) {
        productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
          deletedMediaIds
          userErrors { field message }
        }
      }`, {
      productId: `gid://shopify/Product/${productId}`,
      mediaIds: [mediaId],
    });
    const errs = r.productDeleteMedia.userErrors;
    if (errs.length) return res.status(400).json({ error: errs[0].message });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
