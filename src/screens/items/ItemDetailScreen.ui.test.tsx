import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn()
}));

jest.mock('../../components/MetadataOptionSelector', () => () => null);
jest.mock('../../components/ui/SectionHeader', () => () => null);

jest.mock('../../services/AuthContext', () => ({
  useAuth: jest.fn()
}));

jest.mock('../../services/itemDetailCacheService', () => ({
  getCachedItemDetailSync: jest.fn(),
  getCachedItemDetail: jest.fn(),
  setCachedItemDetail: jest.fn(),
  clearCachedItemDetail: jest.fn()
}));

jest.mock('../../services/closetService', () => ({
  listClosets: jest.fn()
}));

jest.mock('../../services/itemService', () => ({
  getItem: jest.fn(),
  listItemImages: jest.fn(),
  listItemClosetMappings: jest.fn(),
  updateItemViaBackend: jest.fn(),
  deleteItemViaBackend: jest.fn(),
  deleteItem: jest.fn()
}));

jest.mock('../../services/imageCacheService', () => ({
  getCachedSignedImageUrl: jest.fn()
}));

jest.mock('../../services/itemMetadataOptionService', () => ({
  listItemMetadataOptions: jest.fn(),
  createItemMetadataOption: jest.fn()
}));

jest.mock('../../services/wardrobeDataService', () => ({
  refreshWardrobeData: jest.fn()
}));

jest.mock('../../utils/retry', () => ({
  withRetry: jest.fn(async (fn: () => Promise<unknown>) => fn())
}));

const { useFocusEffect } = jest.requireMock('@react-navigation/native') as {
  useFocusEffect: jest.Mock;
};
const { useAuth } = jest.requireMock('../../services/AuthContext') as { useAuth: jest.Mock };
const { getCachedItemDetailSync, getCachedItemDetail, setCachedItemDetail } = jest.requireMock('../../services/itemDetailCacheService') as {
  getCachedItemDetailSync: jest.Mock;
  getCachedItemDetail: jest.Mock;
  setCachedItemDetail: jest.Mock;
};
const { listClosets } = jest.requireMock('../../services/closetService') as { listClosets: jest.Mock };
const { getItem, listItemImages, listItemClosetMappings, updateItemViaBackend } = jest.requireMock('../../services/itemService') as {
  getItem: jest.Mock;
  listItemImages: jest.Mock;
  listItemClosetMappings: jest.Mock;
  updateItemViaBackend: jest.Mock;
};
const { listItemMetadataOptions } = jest.requireMock('../../services/itemMetadataOptionService') as {
  listItemMetadataOptions: jest.Mock;
};
const { getCachedSignedImageUrl } = jest.requireMock('../../services/imageCacheService') as {
  getCachedSignedImageUrl: jest.Mock;
};
const { refreshWardrobeData } = jest.requireMock('../../services/wardrobeDataService') as {
  refreshWardrobeData: jest.Mock;
};

const ItemDetailScreen = require('./ItemDetailScreen').default;

function buildCacheEntry() {
  return {
    item: {
      id: 'item-1',
      user_id: 'user-1',
      name: 'Black Tee',
      primary_image_path: 'items/user-1/item-1/primary/main.jpg',
      brand: null,
      price_amount: null,
      price_currency: 'USD',
      clothing_type: null,
      color: null,
      season: null,
      material: null,
      custom_fields: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    },
    extraImages: [],
    selectedClosetNames: [],
    primaryImageUrl: 'https://example.com/main.jpg',
    cachedAt: Date.now()
  };
}

describe('ItemDetailScreen integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
      session: {
        user: { id: 'user-1' },
        access_token: 'token-1'
      }
    });

    const cacheEntry = buildCacheEntry();
    getCachedItemDetailSync.mockReturnValue(cacheEntry);
    getCachedItemDetail.mockResolvedValue(cacheEntry);
    listClosets.mockResolvedValue([]);
    getItem.mockResolvedValue(cacheEntry.item);
    listItemImages.mockResolvedValue([]);
    listItemClosetMappings.mockResolvedValue([]);
    listItemMetadataOptions.mockResolvedValue([]);
    getCachedSignedImageUrl.mockResolvedValue('https://example.com/main.jpg');
    updateItemViaBackend.mockResolvedValue({
      ok: true,
      item: {
        ...cacheEntry.item,
        name: 'Updated Name'
      },
      closetIds: [],
      closets: []
    });
    setCachedItemDetail.mockResolvedValue(undefined);
    refreshWardrobeData.mockResolvedValue(undefined);
    useFocusEffect.mockImplementation(() => undefined);
  });

  it('saves pending changes when back button is pressed', async () => {
    const navigation = {
      addListener: jest.fn(() => jest.fn()),
      goBack: jest.fn()
    } as any;

    const { getByPlaceholderText, getByTestId } = render(
      <ItemDetailScreen navigation={navigation} route={{ key: 'ItemDetail', name: 'ItemDetail', params: { itemId: 'item-1' } } as any} />
    );

    fireEvent.changeText(getByPlaceholderText('Item Name'), 'Updated Name');
    fireEvent.press(getByTestId('item-detail-back-button'));

    await waitFor(() => {
      expect(updateItemViaBackend).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'token-1',
          itemId: 'item-1',
          name: 'Updated Name'
        })
      );
      expect(navigation.goBack).toHaveBeenCalled();
    });
  });

  it('triggers a single background save on swipe-close transition', async () => {
    let transitionHandler: ((event: any) => void) | null = null;
    const navigation = {
      addListener: jest.fn((event: string, callback: (event: any) => void) => {
        if (event === 'transitionStart') transitionHandler = callback;
        return jest.fn();
      }),
      goBack: jest.fn()
    } as any;

    const { getByPlaceholderText } = render(
      <ItemDetailScreen navigation={navigation} route={{ key: 'ItemDetail', name: 'ItemDetail', params: { itemId: 'item-1' } } as any} />
    );

    fireEvent.changeText(getByPlaceholderText('Item Name'), 'Updated Name');

    await act(async () => {
      transitionHandler?.({ data: { closing: true } });
      transitionHandler?.({ data: { closing: true } });
    });

    await waitFor(() => {
      expect(updateItemViaBackend).toHaveBeenCalledTimes(1);
    });
  });
});
