import { shopifyClient, readBody } from './_shopify.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { gql } = shopifyClient();
  const body = req.body ?? await readBody(req);

  try {
    // Phase 2: attach already-uploaded media to product
    if (body.resourceUrl) {
      const { productId, resourceUrl } = body;
      const r = await gql(`
        mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
          productCreateMedia(productId: $productId, media: $media) {
            media { ... on MediaImage { id image { url } } }
            userErrors { field message }
          }
        }`, {
        productId: `gid://shopify/Product/${productId}`,
        media: [{ originalSource: resourceUrl, mediaContentType: 'IMAGE' }],
      });
      const errs = r.productCreateMedia.userErrors;
      if (errs.length) throw new Error(errs[0].message);
      const node = r.productCreateMedia.media[0];
      return res.status(200).json({ ok: true, mediaId: node?.id, url: node?.image?.url || resourceUrl });
    }

    // Phase 1: get signed upload URL — image data goes direct browser→GCS, never through Vercel
    const { filename, mimeType, fileSize } = body;
    const r1 = await gql(`
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { field message }
        }
      }`, {
      input: [{ filename, mimeType, resource: 'IMAGE', fileSize: String(fileSize) }],
    });
    const errs1 = r1.stagedUploadsCreate.userErrors;
    if (errs1.length) throw new Error(errs1[0].message);
    const target = r1.stagedUploadsCreate.stagedTargets[0];
    return res.status(200).json({ uploadUrl: target.url, resourceUrl: target.resourceUrl });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
