import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { config } from '../config.js';

const router = Router();

const uuidV4Like = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const buildHeaders = (accessToken) => ({
  apikey: config.supabaseAnonKey,
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
});

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { response, body };
}

router.post('/v1/items', requireAuth, async (req, res) => {
  try {
    const body = req.body ?? {};
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return res.status(400).json({ error: 'Missing or invalid name' });
    }

    const headers = {
      ...buildHeaders(req.auth.accessToken),
      Prefer: 'return=representation'
    };

    const createUrl = `${config.supabaseUrl}/rest/v1/clothing_items?select=id`;
    const payload = {
      user_id: req.auth.userId,
      name: body.name.trim(),
      primary_image_path: 'pending',
      brand: typeof body.brand === 'string' && body.brand.trim() ? body.brand.trim() : null,
      clothing_type: typeof body.clothingType === 'string' && body.clothingType.trim() ? body.clothingType.trim() : null,
      color: typeof body.color === 'string' && body.color.trim() ? body.color.trim() : null,
      price_amount: typeof body.priceAmount === 'string' && body.priceAmount.trim() ? body.priceAmount.trim() : null,
      price_currency: typeof body.priceCurrency === 'string' && body.priceCurrency.trim() ? body.priceCurrency.trim() : 'USD',
      season: Array.isArray(body.season) && body.season.length ? body.season : null,
      material: Array.isArray(body.material) && body.material.length ? body.material : null,
      custom_fields: body.customFields ?? null
    };

    const { response, body: createBody } = await fetchJson(createUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return res.status(502).json({
        error: 'Failed to create item',
        upstreamStatus: response.status,
        upstreamBody: createBody
      });
    }

    const rows = Array.isArray(createBody) ? createBody : [];
    if (!rows.length || !rows[0]?.id) {
      return res.status(502).json({ error: 'Failed to parse created item id' });
    }

    return res.status(201).json({ ok: true, itemId: rows[0].id });
  } catch (error) {
    return res.status(502).json({
      error: 'Upstream Supabase request failed',
      message: error instanceof Error ? error.message : 'Unknown upstream error'
    });
  }
});

router.post('/v1/items/:id/finalize', requireAuth, async (req, res) => {
  try {
    const itemId = req.params.id;
    if (!uuidV4Like.test(itemId)) {
      return res.status(400).json({ error: 'Invalid item id format' });
    }

    const body = req.body ?? {};
    if (!body.primaryImagePath || typeof body.primaryImagePath !== 'string' || !body.primaryImagePath.trim()) {
      return res.status(400).json({ error: 'Missing or invalid primaryImagePath' });
    }

    const extraImagePaths = Array.isArray(body.extraImagePaths)
      ? body.extraImagePaths.filter((path) => typeof path === 'string' && path.trim()).map((path) => path.trim())
      : [];
    const closetIds = Array.isArray(body.closetIds)
      ? Array.from(new Set(body.closetIds.filter((id) => typeof id === 'string' && uuidV4Like.test(id))))
      : [];

    const headers = {
      ...buildHeaders(req.auth.accessToken),
      Prefer: 'return=representation'
    };

    const updateUrl = `${config.supabaseUrl}/rest/v1/clothing_items?id=eq.${encodeURIComponent(itemId)}&select=id`;
    const { response: updateResponse, body: updateBody } = await fetchJson(updateUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ primary_image_path: body.primaryImagePath.trim() })
    });

    if (!updateResponse.ok) {
      return res.status(502).json({
        error: 'Failed to update primary image path',
        upstreamStatus: updateResponse.status,
        upstreamBody: updateBody
      });
    }

    const updatedRows = Array.isArray(updateBody) ? updateBody : [];
    if (!updatedRows.length) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (extraImagePaths.length) {
      const imageInsertUrl = `${config.supabaseUrl}/rest/v1/clothing_item_images`;
      const imagePayload = extraImagePaths.map((imagePath, index) => ({
        item_id: itemId,
        image_path: imagePath,
        sort_order: index
      }));
      const { response: imageInsertResponse, body: imageInsertBody } = await fetchJson(imageInsertUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(imagePayload)
      });
      if (!imageInsertResponse.ok) {
        return res.status(502).json({
          error: 'Failed to insert extra images',
          upstreamStatus: imageInsertResponse.status,
          upstreamBody: imageInsertBody
        });
      }
    }

    if (closetIds.length) {
      const mappingInsertUrl = `${config.supabaseUrl}/rest/v1/clothing_item_closets`;
      const mappingPayload = closetIds.map((closetId) => ({
        item_id: itemId,
        closet_id: closetId
      }));
      const mappingHeaders = {
        ...headers,
        Prefer: 'resolution=ignore-duplicates'
      };
      const { response: mappingInsertResponse, body: mappingInsertBody } = await fetchJson(mappingInsertUrl, {
        method: 'POST',
        headers: mappingHeaders,
        body: JSON.stringify(mappingPayload)
      });
      if (!mappingInsertResponse.ok) {
        return res.status(502).json({
          error: 'Failed to assign item to closets',
          upstreamStatus: mappingInsertResponse.status,
          upstreamBody: mappingInsertBody
        });
      }
    }

    return res.status(200).json({
      ok: true,
      itemId,
      extraImagesCount: extraImagePaths.length,
      closetAssignmentsCount: closetIds.length
    });
  } catch (error) {
    return res.status(502).json({
      error: 'Upstream Supabase request failed',
      message: error instanceof Error ? error.message : 'Unknown upstream error'
    });
  }
});

router.delete('/v1/items/:id', requireAuth, async (req, res) => {
  try {
    const itemId = req.params.id;
    if (!uuidV4Like.test(itemId)) {
      return res.status(400).json({ error: 'Invalid item id format' });
    }

    const headers = buildHeaders(req.auth.accessToken);
    const itemLookupUrl = `${config.supabaseUrl}/rest/v1/clothing_items?id=eq.${encodeURIComponent(itemId)}&select=id,primary_image_path`;

    const { response: itemLookupResponse, body: itemLookupBody } = await fetchJson(itemLookupUrl, { method: 'GET', headers });
    if (!itemLookupResponse.ok) {
      return res.status(502).json({
        error: 'Failed to read item before deletion',
        upstreamStatus: itemLookupResponse.status,
        upstreamBody: itemLookupBody
      });
    }

    const itemRows = Array.isArray(itemLookupBody) ? itemLookupBody : [];
    if (!itemRows.length) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemRows[0];
    const imagesLookupUrl = `${config.supabaseUrl}/rest/v1/clothing_item_images?item_id=eq.${encodeURIComponent(itemId)}&select=image_path`;
    const { response: imagesLookupResponse, body: imagesLookupBody } = await fetchJson(imagesLookupUrl, { method: 'GET', headers });
    if (!imagesLookupResponse.ok) {
      return res.status(502).json({
        error: 'Failed to read item images before deletion',
        upstreamStatus: imagesLookupResponse.status,
        upstreamBody: imagesLookupBody
      });
    }

    const imageRows = Array.isArray(imagesLookupBody) ? imagesLookupBody : [];
    const storagePaths = [item.primary_image_path, ...imageRows.map((row) => row.image_path)]
      .filter((path) => typeof path === 'string' && path.trim() && path !== 'pending')
      .map((path) => path.trim());

    const uniqueStoragePaths = Array.from(new Set(storagePaths));
    const deletedStoragePaths = [];
    const failedStorageDeletes = [];

    for (const path of uniqueStoragePaths) {
      const encodedPath = encodeURIComponent(path);
      const deleteStorageUrl = `${config.supabaseUrl}/storage/v1/object/items/${encodedPath}`;
      const { response: deleteStorageResponse, body: deleteStorageBody } = await fetchJson(deleteStorageUrl, {
        method: 'DELETE',
        headers
      });

      if (deleteStorageResponse.ok) {
        deletedStoragePaths.push(path);
        continue;
      }

      failedStorageDeletes.push({
        path,
        status: deleteStorageResponse.status,
        body: deleteStorageBody
      });
    }

    const deleteItemUrl = `${config.supabaseUrl}/rest/v1/clothing_items?id=eq.${encodeURIComponent(itemId)}&select=id`;
    const deleteHeaders = {
      ...headers,
      Prefer: 'return=representation'
    };
    const { response: deleteItemResponse, body: deleteItemBody } = await fetchJson(deleteItemUrl, {
      method: 'DELETE',
      headers: deleteHeaders
    });

    if (!deleteItemResponse.ok) {
      return res.status(502).json({
        error: 'Failed to delete item row',
        upstreamStatus: deleteItemResponse.status,
        upstreamBody: deleteItemBody,
        storage: {
          attempted: uniqueStoragePaths.length,
          deleted: deletedStoragePaths.length,
          failed: failedStorageDeletes
        }
      });
    }

    return res.json({
      ok: true,
      itemId,
      storage: {
        attempted: uniqueStoragePaths.length,
        deleted: deletedStoragePaths.length,
        failed: failedStorageDeletes
      }
    });
  } catch (error) {
    return res.status(502).json({
      error: 'Upstream Supabase request failed',
      message: error instanceof Error ? error.message : 'Unknown upstream error'
    });
  }
});

export default router;
