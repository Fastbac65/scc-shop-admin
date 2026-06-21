import { shopifyClient, readBody } from './_shopify.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { gql } = shopifyClient();
  try {
    const { id, title, price, description, tags, toAdd = [], toRemove = [] } = await readBody(req);
    const productId = `gid://shopify/Product/${id}`;

    // Update title, description, tags
    const r = await gql(`mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id }
        userErrors { field message }
      }
    }`, { input: { id: productId, title, descriptionHtml: description, tags } });
    const errs = r.productUpdate.userErrors;
    if (errs.length) return res.status(400).json({ error: errs[0].message });

    // Update price on all existing variants
    if (price !== undefined && price !== '') {
      const pd = await gql(`{ product(id: "${productId}") { variants(first: 50) { nodes { id } } } }`);
      const variants = pd.product.variants.nodes.map(v => ({
        id: v.id,
        price: parseFloat(price).toFixed(2),
      }));
      const vr = await gql(`mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          userErrors { field message }
        }
      }`, { productId, variants });
      const verrs = vr.productVariantsBulkUpdate.userErrors;
      if (verrs.length) return res.status(400).json({ error: verrs[0].message });
    }

    // Remove variants
    if (toRemove.length) {
      const dr = await gql(`mutation productVariantsBulkDelete($productId: ID!, $variantsIds: [ID!]!) {
        productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
          userErrors { field message }
        }
      }`, { productId, variantsIds: toRemove });
      const derrs = dr.productVariantsBulkDelete.userErrors;
      if (derrs.length) return res.status(400).json({ error: derrs[0].message });
    }

    // Add new size variants
    if (toAdd.length) {
      const cr = await gql(`mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!, $strategy: ProductVariantsBulkCreateStrategy) {
        productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: $strategy) {
          userErrors { field message }
        }
      }`, {
        productId,
        strategy: 'REMOVE_STANDALONE_VARIANT',
        variants: toAdd.map(s => ({
          price: parseFloat(price || 0).toFixed(2),
          optionValues: [{ optionName: 'Size', name: s }],
          inventoryItem: { tracked: true },
        })),
      });
      const cerrs = cr.productVariantsBulkCreate.userErrors;
      if (cerrs.length) return res.status(400).json({ error: cerrs[0].message });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
