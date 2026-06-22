let _cachedToken = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;
  const STORE         = process.env.SHOPIFY_STORE_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const CLIENT_ID     = process.env.SHOPIFY_CLIENT_ID;
  const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
  const res = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'client_credentials' }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const { access_token, expires_in } = await res.json();
  _cachedToken = access_token;
  _tokenExpiry = Date.now() + (expires_in - 300) * 1000; // refresh 5 min before expiry
  return _cachedToken;
}

export function shopifyClient() {
  const STORE    = process.env.SHOPIFY_STORE_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const ENDPOINT = `https://${STORE}/admin/api/2025-01/graphql.json`;

  async function gql(query, variables = {}) {
    const TOKEN = await getAccessToken();
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
