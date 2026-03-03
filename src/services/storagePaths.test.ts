import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildAvatarPath, buildClosetCoverPath, buildItemExtraImagePath, buildItemPrimaryImagePath } from './storagePaths';

describe('storage path builders', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when available and normalizes extensions', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('fixed-uuid');

    expect(buildAvatarPath('user-1', '.PNG')).toBe('user-1/fixed-uuid.png');
    expect(buildClosetCoverPath('user-1', 'closet-1', 'JPEG')).toBe('user-1/closet-1/fixed-uuid.jpeg');
    expect(buildItemPrimaryImagePath('user-1', 'item-1', 'webp')).toBe('user-1/item-1/primary/fixed-uuid.webp');
    expect(buildItemExtraImagePath('user-1', 'item-1', '.HeIc')).toBe('user-1/item-1/extra/fixed-uuid.heic');
  });

  it('defaults to jpg when extension is missing or empty', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid-jpg');

    expect(buildAvatarPath('user-1')).toBe('user-1/uuid-jpg.jpg');
    expect(buildItemExtraImagePath('user-1', 'item-1', '.')).toBe('user-1/item-1/extra/uuid-jpg.jpg');
  });

  it('falls back to timestamp-random id when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    expect(buildAvatarPath('user-2', 'png')).toBe('user-2/1700000000000-123456789.png');
  });
});
