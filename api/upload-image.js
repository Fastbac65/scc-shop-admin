import { shopifyClient, readBody } from './_shopify.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { gql } = shopifyClient();
  try {
    const body = req.body ?? await readBody(req);
    const { productId, filename, mimeType, base64 } = body;
    if (!base64) return res.status(400).json({ error: 'No image data received' });

    const buffer = Buffer.from(base64, 'base64');
    const fileSize = buffer.length.toString();
    const productGid = `gid://shopify/Product/${productId}`;

    // Step 1: get staged upload target
    const r1 = await gql(`
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { field message }
        }
      }`, {
      input: [{ filename, mimeType, resource: 'IMAGE', fileSize }],
    });
    const errs1 = r1.stagedUploadsCreate.userErrors;
    if (errs1.length) throw new Error(errs1[0].message);
    const target = r1.stagedUploadsCreate.stagedTargets[0];

    // Step 2: POST file to S3
    const form = new FormData();
    for (const p of target.parameters) form.append(p.name, p.value);
    form.append('file', new Blob([buffer], { type: mimeType }), filename);
    const uploadRes = await fetch(target.url, { method: 'POST', body: form });
    if (!uploadRes.ok) throw new Error('Storage upload failed: ' + uploadRes.status);

    // Step 3: attach media to product
    const r3 = await gql(`
      mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
        productCreateMedia(productId: $productId, media: $media) {
          media { ... on MediaImage { id image { url } } }
          userErrors { field message }
        }
      }`, {
      productId: productGid,
      media: [{ originalSource: target.resourceUrl, mediaContentType: 'IMAGE' }],
    });
    const errs3 = r3.productCreateMedia.userErrors;
    if (errs3.length) throw new Error(errs3[0].message);

    const node = r3.productCreateMedia.media[0];
    res.status(200).json({ ok: true, mediaId: node?.id, url: node?.image?.url || target.resourceUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
