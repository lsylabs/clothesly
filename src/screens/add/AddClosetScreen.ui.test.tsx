import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

jest.mock('../../services/AuthContext', () => ({
  useAuth: jest.fn()
}));

jest.mock('../../services/closetService', () => ({
  createCloset: jest.fn(),
  updateClosetCover: jest.fn()
}));

jest.mock('../../services/wardrobeDataService', () => ({
  refreshWardrobeData: jest.fn()
}));

jest.mock('../../utils/retry', () => ({
  withRetry: jest.fn(async (fn: () => Promise<unknown>) => fn())
}));

jest.mock('../../services/mediaService', () => ({
  pickImageFromCamera: jest.fn(),
  pickImageFromLibrary: jest.fn(),
  uploadImage: jest.fn()
}));

const { useAuth } = jest.requireMock('../../services/AuthContext') as { useAuth: jest.Mock };
const { createCloset, updateClosetCover } = jest.requireMock('../../services/closetService') as {
  createCloset: jest.Mock;
  updateClosetCover: jest.Mock;
};
const { refreshWardrobeData } = jest.requireMock('../../services/wardrobeDataService') as {
  refreshWardrobeData: jest.Mock;
};

const AddClosetScreen = require('./AddClosetScreen').default;

describe('AddClosetScreen integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
      session: {
        user: { id: 'user-1' }
      }
    });
    createCloset.mockResolvedValue({ id: 'closet-1' });
    refreshWardrobeData.mockResolvedValue(undefined);
  });

  it('shows validation error for empty closet name', async () => {
    const navigation = {
      addListener: jest.fn(() => jest.fn()),
      goBack: jest.fn(),
      dispatch: jest.fn()
    } as any;

    const { getByRole, findByText } = render(
      <AddClosetScreen navigation={navigation} route={{ key: 'AddCloset', name: 'AddCloset' } as any} />
    );

    fireEvent.press(getByRole('button', { name: 'Create Closet' }));

    expect(await findByText('Please enter a closet name.')).toBeTruthy();
    expect(createCloset).not.toHaveBeenCalled();
  });

  it('prompts discard confirmation on beforeRemove when there are unsaved changes', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    let beforeRemoveHandler: ((event: any) => void) | null = null;
    const navigation = {
      addListener: jest.fn((event: string, callback: (event: any) => void) => {
        if (event === 'beforeRemove') {
          beforeRemoveHandler = callback;
        }
        return jest.fn();
      }),
      goBack: jest.fn(),
      dispatch: jest.fn()
    } as any;

    const { getByPlaceholderText } = render(
      <AddClosetScreen navigation={navigation} route={{ key: 'AddCloset', name: 'AddCloset' } as any} />
    );
    fireEvent.changeText(getByPlaceholderText('e.g. Formal, Black, Gym'), 'Workwear');

    const preventDefault = jest.fn();
    beforeRemoveHandler?.({
      preventDefault,
      data: { action: { type: 'GO_BACK' } }
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Discard this closet?',
      'Your unsaved changes will be lost.',
      expect.any(Array)
    );
  });

  it('creates closet and navigates back on successful save', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const navigation = {
      addListener: jest.fn(() => jest.fn()),
      goBack: jest.fn(),
      dispatch: jest.fn()
    } as any;

    const { getByPlaceholderText, getByRole } = render(
      <AddClosetScreen navigation={navigation} route={{ key: 'AddCloset', name: 'AddCloset' } as any} />
    );

    fireEvent.changeText(getByPlaceholderText('e.g. Formal, Black, Gym'), 'Formal');
    fireEvent.press(getByRole('button', { name: 'Create Closet' }));

    await waitFor(() => {
      expect(createCloset).toHaveBeenCalledWith({ name: 'Formal', userId: 'user-1' });
      expect(updateClosetCover).not.toHaveBeenCalled();
      expect(refreshWardrobeData).toHaveBeenCalledWith('user-1');
      expect(navigation.goBack).toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('Closet created', 'Your closet is ready.');
    });
  });
});
