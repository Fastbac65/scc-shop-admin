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

    // Step 2: PUT file directly to V4 signed URL (X-Goog-SignedHeaders=host only)
    const uploadRes = await fetch(target.url, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: buffer,
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error('[upload-image] GCS PUT error:', uploadRes.status, errText.slice(0, 300));
      throw new Error('Storage upload failed: ' + uploadRes.status);
    }

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

    // Step 4: move new image to position 0 so it becomes the primary/featured image
    if (node?.id) {
      await gql(`
        mutation productReorderMedia($id: ID!, $moves: [MoveInput!]!) {
          productReorderMedia(id: $id, moves: $moves) {
            job { id }
            userErrors { field message }
          }
        }`, {
        id: productGid,
        moves: [{ id: node.id, newPosition: '0' }],
      });
    }

    res.status(200).json({ ok: true, mediaId: node?.id, url: node?.image?.url || target.resourceUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
