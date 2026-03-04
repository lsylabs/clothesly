import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  SUPABASE_URL,
  USER_ID,
  VALID_TOKEN,
  ITEM_ID,
  CLOSET_A,
  CLOSET_B
} = vi.hoisted(() => ({
  SUPABASE_URL: 'https://supabase.test',
  USER_ID: '22222222-2222-4222-8222-222222222222',
  VALID_TOKEN: 'valid-token',
  ITEM_ID: '11111111-1111-4111-8111-111111111111',
  CLOSET_A: '33333333-3333-4333-8333-333333333333',
  CLOSET_B: '44444444-4444-4444-8444-444444444444'
}));

vi.mock('../auth.js', () => ({
  requireAuth: (req, res, next) => {
    if (req.headers.authorization === `Bearer ${VALID_TOKEN}`) {
      req.auth = {
        userId: USER_ID,
        accessToken: VALID_TOKEN,
        email: 'test@example.com',
        role: 'authenticated',
        payload: { sub: USER_ID }
      };
      return next();
    }
    return res.status(401).json({ error: 'Invalid access token' });
  }
}));

vi.mock('../config.js', () => ({
  config: {
    port: 8787,
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: 'anon-key',
    supabaseJwtAudience: 'authenticated',
    allowedOrigins: '*'
  }
}));

import { createApp } from '../app.js';

function jsonResponse(status, body) {
  const hasBody = body !== undefined && ![204, 205, 304].includes(status);
  return new Response(hasBody ? JSON.stringify(body) : null, {
    status,
    headers: hasBody ? { 'content-type': 'application/json' } : undefined
  });
}

describe('Items routes contract', () => {
  const fetchMock = vi.fn();
  const authHeader = { Authorization: `Bearer ${VALID_TOKEN}` };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('POST /v1/items', () => {
    it('returns 401 without bearer token', async () => {
      const response = await request(createApp()).post('/v1/items').send({ name: 'Tee' });
      expect(response.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 400 for missing name', async () => {
      const response = await request(createApp()).post('/v1/items').set(authHeader).send({});
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/name/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 502 when Supabase create fails', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: 'boom' }));

      const response = await request(createApp()).post('/v1/items').set(authHeader).send({ name: 'Tee' });

      expect(response.status).toBe(502);
      expect(response.body.error).toBe('Failed to create item');
      expect(response.body.upstreamStatus).toBe(500);
    });

    it('returns created item id on success', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(201, [{ id: ITEM_ID }]));

      const response = await request(createApp())
        .post('/v1/items')
        .set(authHeader)
        .send({ name: '  Tee  ', brand: '  BrandX  ', season: ['winter', 'Winter'] });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ ok: true, itemId: ITEM_ID });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toContain(`${SUPABASE_URL}/rest/v1/clothing_items`);
      expect(init.method).toBe('POST');

      const payload = JSON.parse(init.body);
      expect(payload.user_id).toBe(USER_ID);
      expect(payload.name).toBe('Tee');
      expect(payload.brand).toBe('BrandX');
      expect(payload.season).toEqual(['Winter']);
      expect(init.headers.Authorization).toBe(`Bearer ${VALID_TOKEN}`);
    });
  });

  describe('PATCH /v1/items/:id', () => {
    it('returns 401 without bearer token', async () => {
      const response = await request(createApp()).patch(`/v1/items/${ITEM_ID}`).send({ name: 'Tee' });
      expect(response.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid item id format', async () => {
      const response = await request(createApp()).patch('/v1/items/not-a-uuid').set(authHeader).send({ name: 'Tee' });
      expect(response.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 404 when item is not found for user ownership scope', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, []));

      const response = await request(createApp()).patch(`/v1/items/${ITEM_ID}`).set(authHeader).send({ name: 'Tee' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Item not found');
      const [lookupUrl] = fetchMock.mock.calls[0];
      expect(String(lookupUrl)).toContain(`user_id=eq.${encodeURIComponent(USER_ID)}`);
    });

    it('returns 400 for invalid currency validation', async () => {
      const response = await request(createApp())
        .patch(`/v1/items/${ITEM_ID}`)
        .set(authHeader)
        .send({ name: 'Tee', priceCurrency: 'US' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/3-letter/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 400 when closetIds are not owned by user', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, [
          {
            id: ITEM_ID,
            name: 'Old Tee',
            brand: null,
            clothing_type: null,
            color: null,
            price_amount: null,
            price_currency: 'USD',
            material: null,
            season: null,
            custom_fields: null
          }
        ])
      );
      fetchMock.mockResolvedValueOnce(jsonResponse(200, [{ id: CLOSET_A, name: 'Daily' }]));

      const response = await request(createApp())
        .patch(`/v1/items/${ITEM_ID}`)
        .set(authHeader)
        .send({ name: 'New Tee', closetIds: [CLOSET_A, CLOSET_B] });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/closetIds/i);
      expect(response.body.invalidClosetIds).toEqual([CLOSET_B]);
    });

    it('updates item and replaces closet mappings', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, [
          {
            id: ITEM_ID,
            name: 'Old Tee',
            brand: null,
            clothing_type: null,
            color: null,
            price_amount: null,
            price_currency: 'USD',
            material: null,
            season: null,
            custom_fields: { foo: 'bar' }
          }
        ])
      );
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, [
          { id: CLOSET_A, name: 'Daily' },
          { id: CLOSET_B, name: 'Work' }
        ])
      );
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, [
          {
            id: ITEM_ID,
            name: 'Updated Tee',
            brand: 'BrandX',
            clothing_type: 'Shirt',
            color: 'Blue',
            price_amount: '19.99',
            price_currency: 'USD',
            material: ['cotton', 'wool'],
            season: ['Winter'],
            custom_fields: { foo: 'bar', notes: 'Great fit' }
          }
        ])
      );
      fetchMock.mockResolvedValueOnce(jsonResponse(204));
      fetchMock.mockResolvedValueOnce(jsonResponse(201, []));
      fetchMock.mockResolvedValueOnce(jsonResponse(200, [{ closet_id: CLOSET_A }, { closet_id: CLOSET_B }]));
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, [
          { id: CLOSET_A, name: 'Daily' },
          { id: CLOSET_B, name: 'Work' }
        ])
      );

      const response = await request(createApp())
        .patch(`/v1/items/${ITEM_ID}`)
        .set(authHeader)
        .send({
          name: 'Updated Tee',
          brand: 'BrandX',
          clothingType: 'Shirt',
          color: 'Blue',
          priceAmount: 19.99,
          priceCurrency: 'usd',
          material: ['cotton', 'Cotton', 'wool'],
          season: ['winter'],
          notes: 'Great fit',
          closetIds: [CLOSET_A, CLOSET_B]
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.item.name).toBe('Updated Tee');
      expect(response.body.closetIds).toEqual([CLOSET_A, CLOSET_B]);
      expect(response.body.closets).toEqual([
        { id: CLOSET_A, name: 'Daily' },
        { id: CLOSET_B, name: 'Work' }
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(7);

      const [, updateInit] = fetchMock.mock.calls[2];
      const updatePayload = JSON.parse(updateInit.body);
      expect(updatePayload.price_currency).toBe('USD');
      expect(updatePayload.material).toEqual(['cotton', 'wool']);
      expect(updatePayload.season).toEqual(['Winter']);
      expect(updatePayload.custom_fields.notes).toBe('Great fit');
    });
  });

  describe('POST /v1/items/:id/finalize', () => {
    it('returns 401 without bearer token', async () => {
      const response = await request(createApp()).post(`/v1/items/${ITEM_ID}/finalize`).send({});
      expect(response.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 400 when primaryImagePath is missing', async () => {
      const response = await request(createApp()).post(`/v1/items/${ITEM_ID}/finalize`).set(authHeader).send({});
      expect(response.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('finalizes item with extra images and closet assignments', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, [{ id: ITEM_ID }]));
      fetchMock.mockResolvedValueOnce(jsonResponse(201, []));
      fetchMock.mockResolvedValueOnce(jsonResponse(201, []));

      const response = await request(createApp())
        .post(`/v1/items/${ITEM_ID}/finalize`)
        .set(authHeader)
        .send({
          primaryImagePath: 'items/user-1/item-1/main.jpg',
          extraImagePaths: ['items/user-1/item-1/1.jpg', 'items/user-1/item-1/2.jpg'],
          closetIds: [CLOSET_A, CLOSET_A, 'not-a-uuid']
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        itemId: ITEM_ID,
        extraImagesCount: 2,
        closetAssignmentsCount: 1
      });
      expect(fetchMock).toHaveBeenCalledTimes(3);

      const [, mappingInsertInit] = fetchMock.mock.calls[2];
      const mappingPayload = JSON.parse(mappingInsertInit.body);
      expect(mappingPayload).toEqual([{ item_id: ITEM_ID, closet_id: CLOSET_A }]);
    });

    it('returns 502 when finalize update fails upstream', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: 'fail' }));

      const response = await request(createApp())
        .post(`/v1/items/${ITEM_ID}/finalize`)
        .set(authHeader)
        .send({ primaryImagePath: 'items/user-1/item-1/main.jpg' });

      expect(response.status).toBe(502);
      expect(response.body.error).toBe('Failed to update primary image path');
    });
  });

  describe('DELETE /v1/items/:id', () => {
    it('returns 401 without bearer token', async () => {
      const response = await request(createApp()).delete(`/v1/items/${ITEM_ID}`);
      expect(response.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 404 when item does not exist', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, []));

      const response = await request(createApp()).delete(`/v1/items/${ITEM_ID}`).set(authHeader);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Item not found');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns 502 when storage deletion fails', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, [{ id: ITEM_ID, primary_image_path: 'items/u/main.jpg' }]));
      fetchMock.mockResolvedValueOnce(jsonResponse(200, [{ image_path: 'items/u/1.jpg' }]));
      fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: 'storage-fail' }));

      const response = await request(createApp()).delete(`/v1/items/${ITEM_ID}`).set(authHeader);

      expect(response.status).toBe(502);
      expect(response.body.error).toMatch(/storage objects/i);
      expect(response.body.storage.attempted).toBe(2);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('deletes item and reports storage stats on success', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, [{ id: ITEM_ID, primary_image_path: 'items/u/main.jpg' }]));
      fetchMock.mockResolvedValueOnce(jsonResponse(200, [{ image_path: 'items/u/1.jpg' }]));
      fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
      fetchMock.mockResolvedValueOnce(jsonResponse(200, [{ id: ITEM_ID }]));

      const response = await request(createApp()).delete(`/v1/items/${ITEM_ID}`).set(authHeader);

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.itemId).toBe(ITEM_ID);
      expect(response.body.storage).toEqual({ attempted: 2, deleted: 2, failed: [] });
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });
  });
});
