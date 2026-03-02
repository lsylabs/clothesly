import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

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
      <TextInput editable={!loading} onChangeText={setName} placeholder="e.g. Formal, Black, Gym" style={styles.input} value={name} />

      <Text style={styles.label}>Cover Image (optional)</Text>
      <View style={styles.row}>
        <Pressable
          onPress={async () => {
            try {
              const image = await pickImageFromCamera();
              setCoverImage(image ?? null);
            } catch (error) {
              Alert.alert('Camera error', error instanceof Error ? error.message : 'Could not open camera');
            }
          }}
          style={[styles.secondary, loading && styles.disabled]}
          disabled={loading}
        >
          <Text style={styles.secondaryText}>Take Photo</Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            const image = await pickImageFromLibrary();
            setCoverImage(image ?? null);
          }}
          style={[styles.secondary, loading && styles.disabled]}
          disabled={loading}
        >
          <Text style={styles.secondaryText}>Choose Photo</Text>
        </Pressable>
      </View>
      <Text style={styles.fileText}>{coverImage ? `Selected: ${coverImage.uri.split('/').pop()}` : 'No cover selected'}</Text>
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

      <Pressable disabled={loading} onPress={handleSave} style={[styles.primary, loading && styles.disabled]}>
        <Text style={styles.primaryText}>{loading ? 'Creating...' : 'Create Closet'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#ecebed',
    gap: 12
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1d1e22'
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#c7c6ca',
    borderRadius: 14,
    backgroundColor: '#f0f0f1',
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  secondary: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#c7c6ca',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f0f0f1'
  },
  secondaryText: {
    color: '#24252a',
    fontWeight: '600'
  },
  fileText: {
    color: '#676770'
  },
  primary: {
    backgroundColor: '#141518',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700'
  },
  disabled: {
    opacity: 0.65
  },
  errorText: {
    color: '#a04f4f',
    fontWeight: '600'
  }
});
