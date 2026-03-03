import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import AppButton from '../../components/ui/AppButton';
import AppTextInput from '../../components/ui/AppTextInput';
import { useAuth } from '../../services/AuthContext';
import { createCloset, updateClosetCover } from '../../services/closetService';
import type { LocalImage } from '../../services/mediaService';
import { pickImageFromCamera, pickImageFromLibrary, uploadImage } from '../../services/mediaService';
import { buildClosetCoverPath } from '../../services/storagePaths';
import { refreshWardrobeData } from '../../services/wardrobeDataService';
import type { AppStackParamList } from '../../types/navigation';
import { withRetry } from '../../utils/retry';
import { validateClosetName } from '../../utils/validation';

type Props = NativeStackScreenProps<AppStackParamList, 'AddCloset'>;

export default function AddClosetScreen({ navigation }: Props) {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [name, setName] = useState('');
  const [coverImage, setCoverImage] = useState<LocalImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleSave = async () => {
    setErrorText(null);

    if (!userId) {
      setErrorText('You need to sign in again before creating a closet.');
      return;
    }

    const nameValidation = validateClosetName(name);
    if (!nameValidation.valid) {
      setErrorText(nameValidation.message ?? 'Invalid closet name.');
      return;
    }

    setLoading(true);
    try {
      const closet = await withRetry(() => createCloset({ name, userId }));

      if (coverImage) {
        const path = buildClosetCoverPath(userId, closet.id, coverImage.extension);
        await withRetry(() => uploadImage('closets', path, coverImage));
        await withRetry(() => updateClosetCover(closet.id, path));
      }
      await refreshWardrobeData(userId).catch(() => undefined);

      Alert.alert('Closet created', 'Your closet is ready.');
      navigation.goBack();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Closet Name</Text>
      <AppTextInput editable={!loading} onChangeText={setName} placeholder="e.g. Formal, Black, Gym" value={name} />

      <Text style={styles.label}>Cover Image (optional)</Text>
      <View style={styles.row}>
        <AppButton
          disabled={loading}
          label="Take Photo"
          onPress={async () => {
            try {
              const image = await pickImageFromCamera();
              setCoverImage(image ?? null);
            } catch (error) {
              Alert.alert('Camera error', error instanceof Error ? error.message : 'Could not open camera');
            }
          }}
          style={styles.secondary}
          variant="secondary"
        />
        <AppButton
          disabled={loading}
          label="Choose Photo"
          onPress={async () => {
            const image = await pickImageFromLibrary();
            setCoverImage(image ?? null);
          }}
          style={styles.secondary}
          variant="secondary"
        />
      </View>
      {coverImage ? (
        <Image
          resizeMode="cover"
          source={{ uri: coverImage.uri }}
          style={[
            styles.coverPreview,
            coverImage.width && coverImage.height ? { aspectRatio: coverImage.width / coverImage.height } : null
          ]}
        />
      ) : null}
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

      <AppButton label="Create Closet" loading={loading} loadingLabel="Creating..." onPress={handleSave} style={styles.primary} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FAFAFA',
    gap: 12
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A0A0A'
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  secondary: {
    flex: 1
  },
  coverPreview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: '#F5F5F5'
  },
  primary: {
    marginTop: 8
  },
  errorText: {
    color: '#DC2626',
    fontWeight: '600'
  }
});
