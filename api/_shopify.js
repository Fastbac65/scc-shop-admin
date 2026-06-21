export function shopifyClient() {
  const STORE    = process.env.SHOPIFY_STORE_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const TOKEN    = process.env.SHOPIFY_API_KEY;
  const ENDPOINT = `https://${STORE}/admin/api/2025-01/graphql.json`;

  async function gql(query, variables = {}) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Shopify API error ${res.status}: ${await res.text()}`);
    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0].message);
    return json.data;
  }

  return { gql, STORE };
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
  });
}
