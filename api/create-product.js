import { Buffer } from 'buffer';
import { shopifyClient, readBody } from './_shopify.js';

function buildSku(title, variantTitle) {
  const base = title.toUpperCase()
    .replace(/['']/g, '').replace(/\s+-\s+.+$/, '').replace(/\(.*?\)/g, '')
    .replace(/WITH SCC LOGO/g, '').replace(/[^A-Z0-9]+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!variantTitle || variantTitle === 'Default Title' || variantTitle === 'One Size') return base;
  const nippers = variantTitle.match(/^(U\d+)/);
  if (nippers) return `${base}-${nippers[1]}`;
  return `${base}-${variantTitle.replace(/['']/g, '').replace(/\s+/g, '-')}`;
}

async function uploadImage(gql, productId, img) {
  const buffer = Buffer.from(img.base64, 'base64');
  const staged = await gql(`
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`, {
    input: [{ filename: img.filename, mimeType: img.mimeType, resource: 'IMAGE', fileSize: String(buffer.length), httpMethod: 'POST' }],
  });
  const errs = staged.stagedUploadsCreate.userErrors;
  if (errs.length) throw new Error(`Stage error: ${errs[0].message}`);
  const target = staged.stagedUploadsCreate.stagedTargets[0];
  const form = new FormData();
  for (const { name, value } of target.parameters) form.append(name, value);
  form.append('file', new Blob([buffer], { type: img.mimeType }), img.filename);
  const upload = await fetch(target.url, { method: 'POST', body: form });
  if (!upload.ok) throw new Error(`Upload failed: ${upload.status}`);
  await gql(`
    mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) { mediaUserErrors { field message } }
    }`, {
    productId,
    media: [{ originalSource: target.resourceUrl, mediaContentType: 'IMAGE', alt: img.filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') }],
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { gql } = shopifyClient();
  try {
    const { title, price, description, variants, tags, images } = await readBody(req);
    const variantList = variants?.length ? variants : [];
    const isSingle    = variantList.length <= 1;
    const descHtml    = description ? `<p>${description.replace(/\n/g, '</p><p>')}</p>` : '';

    const created = await gql(`
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product { id title variants(first: 1) { nodes { id } } }
          userErrors { field message }
        }
      }`, { input: { title, descriptionHtml: descHtml, tags, status: 'ACTIVE' } });

    const errs = created.productCreate.userErrors;
    if (errs.length) throw new Error(errs.map(e => e.message).join(', '));
    const productId        = created.productCreate.product.id;
    const defaultVariantId = created.productCreate.product.variants.nodes[0]?.id;

    if (isSingle) {
      await gql(`
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            userErrors { field message }
          }
        }`, {
        productId,
        variants: [{ id: defaultVariantId, price: String(price), inventoryItem: { sku: buildSku(title, variantList[0] || 'Default Title'), tracked: true } }],
      });
    } else {
      await gql(`
        mutation productOptionsCreate($productId: ID!, $options: [OptionCreateInput!]!) {
          productOptionsCreate(productId: $productId, options: $options) {
            userErrors { field message }
          }
        }`, {
        productId,
        options: [{ name: 'Size', values: variantList.map(s => ({ name: s })) }],
      });
      await gql(`
        mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!, $strategy: ProductVariantsBulkCreateStrategy) {
          productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: $strategy) {
            userErrors { field message }
          }
        }`, {
        productId,
        strategy: 'REMOVE_STANDALONE_VARIANT',
        variants: variantList.map(v => ({
          price: String(price),
          optionValues: [{ optionName: 'Size', name: v }],
          inventoryItem: { sku: buildSku(title, v), tracked: true },
        })),
      });
    }

    for (const img of (images || [])) {
      try { await uploadImage(gql, productId, img); }
      catch (e) { console.warn(`Image upload failed (${img.filename}): ${e.message}`); }
    }

    try {
      const pubData = await gql(`{ publications(first: 20) { nodes { id } } }`);
      const pubs = pubData.publications.nodes.map(p => ({ publicationId: p.id }));
      await gql(`
        mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
          publishablePublish(id: $id, input: $input) { userErrors { field message } }
        }`, { id: productId, input: pubs });
    } catch (e) { console.warn(`Publish failed: ${e.message}`); }

    res.status(200).json({ productId: productId.split('/').pop(), title });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
