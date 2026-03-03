import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

jest.mock('../../components/MetadataOptionSelector', () => () => null);

jest.mock('../../services/AuthContext', () => ({
  useAuth: jest.fn()
}));

jest.mock('../../services/closetService', () => ({
  listClosets: jest.fn()
}));

jest.mock('../../services/itemMetadataOptionService', () => ({
  listItemMetadataOptions: jest.fn(),
  createItemMetadataOption: jest.fn()
}));

jest.mock('../../services/itemService', () => ({
  createItemViaBackend: jest.fn(),
  finalizeItemViaBackend: jest.fn(),
  deleteItemViaBackend: jest.fn(),
  deleteItem: jest.fn()
}));

jest.mock('../../services/mediaService', () => ({
  pickImageFromCamera: jest.fn(),
  pickImagesFromLibrary: jest.fn(),
  uploadImage: jest.fn()
}));

jest.mock('../../services/storagePaths', () => ({
  buildItemPrimaryImagePath: jest.fn(),
  buildItemExtraImagePath: jest.fn()
}));

jest.mock('../../services/wardrobeDataService', () => ({
  refreshWardrobeData: jest.fn()
}));

jest.mock('../../utils/retry', () => ({
  withRetry: jest.fn(async (fn: () => Promise<unknown>) => fn())
}));

const { useAuth } = jest.requireMock('../../services/AuthContext') as { useAuth: jest.Mock };
const { listClosets } = jest.requireMock('../../services/closetService') as { listClosets: jest.Mock };
const { listItemMetadataOptions } = jest.requireMock('../../services/itemMetadataOptionService') as {
  listItemMetadataOptions: jest.Mock;
};
const { createItemViaBackend, finalizeItemViaBackend } = jest.requireMock('../../services/itemService') as {
  createItemViaBackend: jest.Mock;
  finalizeItemViaBackend: jest.Mock;
};
const { pickImagesFromLibrary, uploadImage } = jest.requireMock('../../services/mediaService') as {
  pickImagesFromLibrary: jest.Mock;
  uploadImage: jest.Mock;
};
const { buildItemPrimaryImagePath, buildItemExtraImagePath } = jest.requireMock('../../services/storagePaths') as {
  buildItemPrimaryImagePath: jest.Mock;
  buildItemExtraImagePath: jest.Mock;
};
const { refreshWardrobeData } = jest.requireMock('../../services/wardrobeDataService') as {
  refreshWardrobeData: jest.Mock;
};

const AddItemScreen = require('./AddItemScreen').default;

describe('AddItemScreen integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
      session: {
        user: { id: 'user-1' },
        access_token: 'token-1'
      }
    });
    listClosets.mockResolvedValue([]);
    listItemMetadataOptions.mockResolvedValue([]);
    pickImagesFromLibrary.mockResolvedValue([
      {
        uri: 'file:///img-1.jpg',
        extension: 'jpg',
        width: 100,
        height: 120
      }
    ]);
    buildItemPrimaryImagePath.mockReturnValue('user-1/item-1/primary/main.jpg');
    buildItemExtraImagePath.mockReturnValue('user-1/item-1/extra/extra.jpg');
    createItemViaBackend.mockResolvedValue({ ok: true, itemId: 'item-1' });
    finalizeItemViaBackend.mockResolvedValue({ ok: true });
    refreshWardrobeData.mockResolvedValue(undefined);
    uploadImage.mockResolvedValue(undefined);
  });

  it('shows item name validation after photo step when name is empty', async () => {
    const navigation = {
      addListener: jest.fn(() => jest.fn()),
      goBack: jest.fn(),
      dispatch: jest.fn()
    } as any;

    const { getByText, findByText } = render(
      <AddItemScreen navigation={navigation} route={{ key: 'AddItem', name: 'AddItem' } as any} />
    );

    fireEvent.press(getByText('Album'));
    await waitFor(() => expect(getByText('Save Item')).toBeTruthy());
    fireEvent.press(getByText('Save Item'));

    expect(await findByText('Please enter an item name.')).toBeTruthy();
    expect(createItemViaBackend).not.toHaveBeenCalled();
  });

  it('runs create-upload-finalize orchestration and navigates back on success', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const navigation = {
      addListener: jest.fn(() => jest.fn()),
      goBack: jest.fn(),
      dispatch: jest.fn()
    } as any;

    const { getByText, getByPlaceholderText } = render(
      <AddItemScreen navigation={navigation} route={{ key: 'AddItem', name: 'AddItem' } as any} />
    );

    fireEvent.press(getByText('Album'));
    await waitFor(() => expect(getByText('Save Item')).toBeTruthy());

    fireEvent.changeText(getByPlaceholderText('Item Name *'), 'Black Tee');
    fireEvent.press(getByText('Save Item'));

    await waitFor(() => {
      expect(createItemViaBackend).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'token-1',
          name: 'Black Tee'
        })
      );
      expect(uploadImage).toHaveBeenCalledWith(
        'items',
        'user-1/item-1/primary/main.jpg',
        expect.objectContaining({ uri: 'file:///img-1.jpg' })
      );
      expect(finalizeItemViaBackend).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'token-1',
          itemId: 'item-1',
          primaryImagePath: 'user-1/item-1/primary/main.jpg'
        })
      );
      expect(refreshWardrobeData).toHaveBeenCalledWith('user-1');
      expect(navigation.goBack).toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('Item added', 'Your wardrobe item has been saved.');
    });
  });
});
