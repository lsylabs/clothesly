import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

export type LocalImage = {
  uri: string;
  mimeType: string;
  extension: string;
};

const extensionFromUri = (uri: string) => {
  const clean = uri.split('?')[0];
  const maybeExt = clean.includes('.') ? clean.split('.').pop() : 'jpg';
  return (maybeExt || 'jpg').toLowerCase();
};

const mimeFromExtension = (extension: string) => {
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
};

const mapAssetToLocalImage = (asset: ImagePicker.ImagePickerAsset): LocalImage => {
  const extension = extensionFromUri(asset.uri);
  return {
    uri: asset.uri,
    extension,
    mimeType: asset.mimeType ?? mimeFromExtension(extension)
  };
};

export async function pickImageFromLibrary() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.9
  });

  if (result.canceled) return null;
  return mapAssetToLocalImage(result.assets[0]);
}

export async function pickImageFromCamera() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera permission is required to take photos.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.9
  });

  if (result.canceled) return null;
  return mapAssetToLocalImage(result.assets[0]);
}

export async function uploadImage(bucket: 'avatars' | 'closets' | 'items', path: string, localImage: LocalImage) {
  const fileResponse = await fetch(localImage.uri);
  const blob = await fileResponse.blob();

  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: localImage.mimeType,
    upsert: false
  });

  if (error) throw error;
}

export async function deleteImages(bucket: 'avatars' | 'closets' | 'items', paths: string[]) {
  const uniquePaths = Array.from(new Set(paths.map((path) => path.trim()).filter((path) => Boolean(path) && path !== 'pending')));
  if (!uniquePaths.length) return;

  const { error } = await supabase.storage.from(bucket).remove(uniquePaths);
  if (error) throw error;
}
