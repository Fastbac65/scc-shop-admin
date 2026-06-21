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
          collections(first: 50, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id title handle
              productsCount { count }
              image { url }
              ruleSet {
                appliedDisjunctively
                rules { column relation condition }
              }
            }
          }
        }`, { cursor });
      all.push(...data.collections.nodes);
      if (!data.collections.pageInfo.hasNextPage) break;
      cursor = data.collections.pageInfo.endCursor;
    }
    res.status(200).json(all.sort((a, b) => a.title.localeCompare(b.title)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
