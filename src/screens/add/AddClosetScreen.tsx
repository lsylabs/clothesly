import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../../services/AuthContext';
import { createCloset, updateClosetCover } from '../../services/closetService';
import type { LocalImage } from '../../services/mediaService';
import { pickImageFromCamera, pickImageFromLibrary, uploadImage } from '../../services/mediaService';
import { buildClosetCoverPath } from '../../services/storagePaths';
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
    backgroundColor: '#f5f1e8',
    gap: 10
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2b2b2b'
  },
  input: {
    borderWidth: 1,
    borderColor: '#d6d0c5',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  row: {
    flexDirection: 'row',
    gap: 10
  },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1f4d3d',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  secondaryText: {
    color: '#1f4d3d',
    fontWeight: '600'
  },
  fileText: {
    color: '#555'
  },
  primary: {
    backgroundColor: '#1f4d3d',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 13,
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
    color: '#8f2424',
    fontWeight: '600'
  }
});
