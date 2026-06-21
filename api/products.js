import { shopifyClient } from './_shopify.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { gql } = shopifyClient();
  try {
    const all = [];
    let cursor = null;
    while (true) {
      const data = await gql(`
        query($cursor: String) {
          products(first: 50, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id title tags status descriptionHtml
              media(first: 10) { nodes { ... on MediaImage { id image { url } } } }
              variants(first: 50) {
                nodes {
                  id title price sku
                  inventoryItem {
                    id
                    inventoryLevels(first: 1) {
                      nodes { quantities(names: ["available","committed","on_hand"]) { name quantity } }
                    }
                  }
                }
              }
            }
          }
        }`, { cursor });
      all.push(...data.products.nodes);
      if (!data.products.pageInfo.hasNextPage) break;
      cursor = data.products.pageInfo.endCursor;
    }
    const products = all
      .filter(p => p.status === 'ACTIVE')
      .map(p => ({
        id: p.id.split('/').pop(),
        title: p.title,
        description: p.descriptionHtml.replace(/<[^>]+>/g, '').trim(),
        tags: p.tags,
        images: p.media.nodes.filter(n => n.id).map(n => ({ id: n.id, url: n.image?.url })).filter(n => n.url),
        variants: p.variants.nodes.map(v => ({
          id: v.id,
          title: v.title,
          price: v.price,
          sku: v.sku,
          inventoryItemId: v.inventoryItem.id,
          qty: v.inventoryItem.inventoryLevels.nodes[0]?.quantities.find(q => q.name === 'available')?.quantity ?? 0,
          committed: v.inventoryItem.inventoryLevels.nodes[0]?.quantities.find(q => q.name === 'committed')?.quantity ?? 0,
          onHand: v.inventoryItem.inventoryLevels.nodes[0]?.quantities.find(q => q.name === 'on_hand')?.quantity ?? 0,
        })),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
