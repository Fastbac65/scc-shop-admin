export default function handler(req, res) {
  const store = process.env.SHOPIFY_STORE_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  res.status(200).json({ store });
}
