import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { config } from '../config.js';

const router = Router();

const uuidV4Like = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const currencyCode = /^[A-Za-z]{3}$/;
const MAX_NAME_LENGTH = 80;
const MAX_SHORT_TEXT_LENGTH = 120;
const MAX_ARRAY_ENTRY_LENGTH = 40;
const MAX_ARRAY_ITEMS = 25;
const MAX_NOTES_LENGTH = 4000;

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

function hasOwnProperty(value, property) {
  return Object.prototype.hasOwnProperty.call(value, property);
}

function parseRequiredName(value) {
  if (typeof value !== 'string') {
    throw new Error('Missing or invalid name');
  }
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Name must be between 2 and ${MAX_NAME_LENGTH} characters`);
  }
  return trimmed;
}

function parseOptionalText(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_SHORT_TEXT_LENGTH) {
    throw new Error(`${fieldName} must be ${MAX_SHORT_TEXT_LENGTH} characters or less`);
  }
  return trimmed;
}

function parseOptionalPriceAmount(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('Invalid priceAmount');
  }
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('priceAmount must be a valid non-negative number');
  }
  return trimmed;
}

function parseOptionalCurrency(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error('Invalid priceCurrency');
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!currencyCode.test(trimmed)) {
    throw new Error('priceCurrency must be a 3-letter code');
  }
  return trimmed.toUpperCase();
}

function parseOptionalStringArray(value, fieldName, options = {}) {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of strings`);
  }

  const allowLegacyValues = options.allowLegacyValues instanceof Set ? options.allowLegacyValues : new Set();
  const deduped = [];
  const seen = new Set();
  for (const entry of value) {
    if (typeof entry !== 'string') {
      throw new Error(`${fieldName} must contain only strings`);
    }
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const normalizedKey = trimmed.toLowerCase();
    if (trimmed.length > MAX_ARRAY_ENTRY_LENGTH && !allowLegacyValues.has(normalizedKey)) {
      throw new Error(`${fieldName} entries must be ${MAX_ARRAY_ENTRY_LENGTH} characters or less`);
    }

    if (seen.has(normalizedKey)) continue;
    seen.add(normalizedKey);
    deduped.push(trimmed);
  }

  if (deduped.length > MAX_ARRAY_ITEMS) {
    throw new Error(`${fieldName} cannot have more than ${MAX_ARRAY_ITEMS} entries`);
  }

  return deduped;
}

function buildNormalizedStringSet(values) {
  const normalized = new Set();
  if (!Array.isArray(values)) return normalized;
  for (const entry of values) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    normalized.add(trimmed.toLowerCase());
  }
  return normalized;
}

function parseOptionalNotes(value) {
  if (value === undefined) return undefined;
  if (value === null) return '';
  if (typeof value !== 'string') {
    throw new Error('Invalid notes');
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_NOTES_LENGTH) {
    throw new Error(`notes must be ${MAX_NOTES_LENGTH} characters or less`);
  }
  return trimmed;
}

function parseClosetIds(value) {
  if (!Array.isArray(value)) {
    throw new Error('closetIds must be an array of UUIDs');
  }

  const deduped = [];
  const seen = new Set();
  for (const entry of value) {
    if (typeof entry !== 'string' || !uuidV4Like.test(entry)) {
      throw new Error('closetIds must contain valid UUIDs');
    }
    if (seen.has(entry)) continue;
    seen.add(entry);
    deduped.push(entry);
  }
  return deduped;
}

function mergeNotesIntoCustomFields(existingCustomFields, notes) {
  const next =
    existingCustomFields && typeof existingCustomFields === 'object' && !Array.isArray(existingCustomFields)
      ? { ...existingCustomFields }
      : {};

  if (notes && notes.length) {
    next.notes = notes;
  } else {
    delete next.notes;
  }

  return Object.keys(next).length ? next : null;
}

router.post('/v1/items', requireAuth, async (req, res) => {
  try {
    const body = req.body ?? {};
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return res.status(400).json({ error: 'Missing or invalid name' });
    }
    let season;
    let material;
    try {
      season = parseOptionalStringArray(body.season, 'season');
      material = parseOptionalStringArray(body.material, 'material');
    } catch (validationError) {
      return res.status(400).json({
        error: validationError instanceof Error ? validationError.message : 'Invalid request payload'
      });
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
      season: season === undefined ? null : season.length ? season : null,
      material: material === undefined ? null : material.length ? material : null,
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

router.patch('/v1/items/:id', requireAuth, async (req, res) => {
  try {
    const itemId = req.params.id;
    if (!uuidV4Like.test(itemId)) {
      return res.status(400).json({ error: 'Invalid item id format' });
    }

    const body = req.body ?? {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Invalid request payload' });
    }

    let name;
    let brand;
    let clothingType;
    let color;
    let priceAmount;
    let priceCurrency;
    let material;
    let season;
    let notes;
    let closetIds = null;

    try {
      if (!hasOwnProperty(body, 'name')) {
        throw new Error('Missing or invalid name');
      }
      name = parseRequiredName(body.name);
      brand = parseOptionalText(body.brand, 'brand');
      clothingType = parseOptionalText(body.clothingType, 'clothingType');
      color = parseOptionalText(body.color, 'color');
      priceAmount = parseOptionalPriceAmount(body.priceAmount);
      priceCurrency = parseOptionalCurrency(body.priceCurrency);
      notes = parseOptionalNotes(body.notes);
      if (hasOwnProperty(body, 'closetIds')) {
        closetIds = parseClosetIds(body.closetIds);
      }
    } catch (validationError) {
      return res.status(400).json({
        error: validationError instanceof Error ? validationError.message : 'Invalid request payload'
      });
    }

    const headers = {
      ...buildHeaders(req.auth.accessToken),
      Prefer: 'return=representation'
    };

    const itemLookupUrl =
      `${config.supabaseUrl}/rest/v1/clothing_items` +
      `?id=eq.${encodeURIComponent(itemId)}` +
      `&user_id=eq.${encodeURIComponent(req.auth.userId)}` +
      '&select=*';
    const { response: itemLookupResponse, body: itemLookupBody } = await fetchJson(itemLookupUrl, {
      method: 'GET',
      headers
    });
    if (!itemLookupResponse.ok) {
      return res.status(502).json({
        error: 'Failed to read item',
        upstreamStatus: itemLookupResponse.status,
        upstreamBody: itemLookupBody
      });
    }

    const itemRows = Array.isArray(itemLookupBody) ? itemLookupBody : [];
    if (!itemRows.length) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const existingItem = itemRows[0];

    try {
      material = parseOptionalStringArray(body.material, 'material', {
        allowLegacyValues: buildNormalizedStringSet(existingItem.material)
      });
      season = parseOptionalStringArray(body.season, 'season', {
        allowLegacyValues: buildNormalizedStringSet(existingItem.season)
      });
    } catch (validationError) {
      return res.status(400).json({
        error: validationError instanceof Error ? validationError.message : 'Invalid request payload'
      });
    }

    let verifiedClosetRows = [];
    if (closetIds) {
      if (closetIds.length) {
        const closetFilter = encodeURIComponent(`(${closetIds.join(',')})`);
        const closetsLookupUrl =
          `${config.supabaseUrl}/rest/v1/closets?id=in.${closetFilter}` +
          `&user_id=eq.${encodeURIComponent(req.auth.userId)}` +
          '&select=id,name';
        const { response: closetsLookupResponse, body: closetsLookupBody } = await fetchJson(closetsLookupUrl, {
          method: 'GET',
          headers
        });
        if (!closetsLookupResponse.ok) {
          return res.status(502).json({
            error: 'Failed to validate closet ownership',
            upstreamStatus: closetsLookupResponse.status,
            upstreamBody: closetsLookupBody
          });
        }

        verifiedClosetRows = Array.isArray(closetsLookupBody) ? closetsLookupBody : [];
        const validClosetIds = new Set(verifiedClosetRows.map((row) => row.id));
        const invalidClosetIds = closetIds.filter((closetId) => !validClosetIds.has(closetId));
        if (invalidClosetIds.length) {
          return res.status(400).json({
            error: 'One or more closetIds are invalid or not owned by the user',
            invalidClosetIds
          });
        }
      } else {
        verifiedClosetRows = [];
      }
    }

    const updatePayload = {
      name,
      brand: brand === undefined ? existingItem.brand : brand,
      clothing_type: clothingType === undefined ? existingItem.clothing_type : clothingType,
      color: color === undefined ? existingItem.color : color,
      price_amount: priceAmount === undefined ? existingItem.price_amount : priceAmount,
      price_currency: priceCurrency === undefined ? existingItem.price_currency : priceCurrency,
      material: material === undefined ? existingItem.material : material.length ? material : null,
      season: season === undefined ? existingItem.season : season.length ? season : null,
      custom_fields:
        notes === undefined ? existingItem.custom_fields : mergeNotesIntoCustomFields(existingItem.custom_fields, notes)
    };

    const updateItemUrl =
      `${config.supabaseUrl}/rest/v1/clothing_items` +
      `?id=eq.${encodeURIComponent(itemId)}` +
      `&user_id=eq.${encodeURIComponent(req.auth.userId)}` +
      '&select=*';
    const { response: updateResponse, body: updateBody } = await fetchJson(updateItemUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updatePayload)
    });
    if (!updateResponse.ok) {
      return res.status(502).json({
        error: 'Failed to update item',
        upstreamStatus: updateResponse.status,
        upstreamBody: updateBody
      });
    }

    const updatedRows = Array.isArray(updateBody) ? updateBody : [];
    if (!updatedRows.length) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const updatedItem = updatedRows[0];

    if (closetIds) {
      const mappingDeleteUrl = `${config.supabaseUrl}/rest/v1/clothing_item_closets?item_id=eq.${encodeURIComponent(itemId)}`;
      const { response: mappingDeleteResponse, body: mappingDeleteBody } = await fetchJson(mappingDeleteUrl, {
        method: 'DELETE',
        headers
      });
      if (!mappingDeleteResponse.ok) {
        return res.status(502).json({
          error: 'Failed to replace closet mappings',
          upstreamStatus: mappingDeleteResponse.status,
          upstreamBody: mappingDeleteBody
        });
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
            error: 'Failed to insert closet mappings',
            upstreamStatus: mappingInsertResponse.status,
            upstreamBody: mappingInsertBody
          });
        }
      }
    }

    const mappingLookupUrl = `${config.supabaseUrl}/rest/v1/clothing_item_closets?item_id=eq.${encodeURIComponent(itemId)}&select=closet_id`;
    const { response: mappingLookupResponse, body: mappingLookupBody } = await fetchJson(mappingLookupUrl, {
      method: 'GET',
      headers
    });
    if (!mappingLookupResponse.ok) {
      return res.status(502).json({
        error: 'Failed to read closet mappings',
        upstreamStatus: mappingLookupResponse.status,
        upstreamBody: mappingLookupBody
      });
    }

    const mappingRows = Array.isArray(mappingLookupBody) ? mappingLookupBody : [];
    const assignedClosetIds = Array.from(
      new Set(
        mappingRows
          .map((row) => (typeof row?.closet_id === 'string' ? row.closet_id : null))
          .filter((value) => Boolean(value))
      )
    );

    let assignedClosets = [];
    if (assignedClosetIds.length) {
      const closetFilter = encodeURIComponent(`(${assignedClosetIds.join(',')})`);
      const assignedClosetsUrl =
        `${config.supabaseUrl}/rest/v1/closets?id=in.${closetFilter}` +
        `&user_id=eq.${encodeURIComponent(req.auth.userId)}` +
        '&select=id,name';
      const { response: assignedClosetsResponse, body: assignedClosetsBody } = await fetchJson(assignedClosetsUrl, {
        method: 'GET',
        headers
      });
      if (!assignedClosetsResponse.ok) {
        return res.status(502).json({
          error: 'Failed to resolve closets',
          upstreamStatus: assignedClosetsResponse.status,
          upstreamBody: assignedClosetsBody
        });
      }
      const assignedClosetRows = Array.isArray(assignedClosetsBody) ? assignedClosetsBody : [];
      const closetLookup = new Map(assignedClosetRows.map((row) => [row.id, row]));
      assignedClosets = assignedClosetIds.map((closetId) => closetLookup.get(closetId)).filter((row) => Boolean(row));
    } else if (closetIds) {
      assignedClosets = verifiedClosetRows;
    }

    return res.status(200).json({
      ok: true,
      item: updatedItem,
      closetIds: assignedClosetIds,
      closets: assignedClosets
    });
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
    let deletedStoragePaths = [];
    let failedStorageDeletes = [];

    if (uniqueStoragePaths.length) {
      const deleteStorageUrl = `${config.supabaseUrl}/storage/v1/object/items`;
      const { response: deleteStorageResponse, body: deleteStorageBody } = await fetchJson(deleteStorageUrl, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ prefixes: uniqueStoragePaths })
      });

      if (!deleteStorageResponse.ok) {
        failedStorageDeletes = [
          {
            paths: uniqueStoragePaths,
            status: deleteStorageResponse.status,
            body: deleteStorageBody
          }
        ];
      } else {
        deletedStoragePaths = uniqueStoragePaths;
      }
    }

    if (failedStorageDeletes.length > 0) {
      return res.status(502).json({
        error: 'Failed to delete one or more storage objects',
        storage: {
          attempted: uniqueStoragePaths.length,
          deleted: deletedStoragePaths.length,
          failed: failedStorageDeletes
        }
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
