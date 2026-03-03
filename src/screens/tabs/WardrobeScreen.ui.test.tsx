import { act, render, waitFor } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useFocusEffect: jest.fn()
}));

jest.mock('../../services/AuthContext', () => ({
  useAuth: jest.fn()
}));

jest.mock('../../services/wardrobeDataService', () => ({
  getWardrobeDataCache: jest.fn(),
  fetchWardrobeData: jest.fn()
}));

jest.mock('../../services/imageCacheService', () => ({
  getCachedSignedImageUrlSync: jest.fn(),
  getCachedSignedImageUrl: jest.fn()
}));

const { useNavigation, useFocusEffect } = jest.requireMock('@react-navigation/native') as {
  useNavigation: jest.Mock;
  useFocusEffect: jest.Mock;
};
const { useAuth } = jest.requireMock('../../services/AuthContext') as { useAuth: jest.Mock };
const { getWardrobeDataCache, fetchWardrobeData } = jest.requireMock('../../services/wardrobeDataService') as {
  getWardrobeDataCache: jest.Mock;
  fetchWardrobeData: jest.Mock;
};
const { getCachedSignedImageUrlSync, getCachedSignedImageUrl } = jest.requireMock('../../services/imageCacheService') as {
  getCachedSignedImageUrlSync: jest.Mock;
  getCachedSignedImageUrl: jest.Mock;
};

const WardrobeScreen = require('./WardrobeScreen').default;
let latestFocusCallback: (() => void) | null = null;

describe('WardrobeScreen integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestFocusCallback = null;
    useNavigation.mockReturnValue({ navigate: jest.fn() });
    useAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
    useFocusEffect.mockImplementation((callback: () => void) => {
      latestFocusCallback = callback;
    });
    getCachedSignedImageUrlSync.mockReturnValue(null);
    getCachedSignedImageUrl.mockResolvedValue(null);
  });

  const triggerFocus = async () => {
    await act(async () => {
      latestFocusCallback?.();
    });
  };

  it('hydrates from cache and skips network refresh on focus when cache is fresh', async () => {
    getWardrobeDataCache.mockReturnValue({
      closets: [{ id: 'closet-1', name: 'Daily', cover_image_path: null }],
      items: [],
      mappings: [],
      loadedAt: Date.now()
    });

    const { findByText } = render(<WardrobeScreen />);

    expect(await findByText('Closets (1)')).toBeTruthy();
    await triggerFocus();
    expect(fetchWardrobeData).not.toHaveBeenCalled();
  });

  it('refreshes from network when cache is stale', async () => {
    getWardrobeDataCache.mockReturnValue({
      closets: [{ id: 'closet-old', name: 'Old', cover_image_path: null }],
      items: [],
      mappings: [],
      loadedAt: 0
    });
    fetchWardrobeData.mockResolvedValue({
      closets: [
        { id: 'closet-a', name: 'Daily', cover_image_path: null },
        { id: 'closet-b', name: 'Work', cover_image_path: null }
      ],
      items: [],
      mappings: [],
      loadedAt: Date.now()
    });

    const { findByText } = render(<WardrobeScreen />);
    expect(await findByText('Closets (1)')).toBeTruthy();

    await triggerFocus();
    await waitFor(() => expect(fetchWardrobeData).toHaveBeenCalledWith('user-1'));
    expect(await findByText('Closets (2)')).toBeTruthy();
  });
});
