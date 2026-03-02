import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../services/AuthContext';
import { warmSignedImageUrls } from '../../services/imageCacheService';
import { prefetchWardrobeData } from '../../services/wardrobeDataService';

export default function HomeScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    void prefetchWardrobeData(userId)
      .then((data) => {
        const itemPaths = data.items.map((item) => item.primary_image_path);
        const closetCoverPaths = data.closets.map((closet) => closet.cover_image_path || '').filter(Boolean) as string[];
        return Promise.all([warmSignedImageUrls('items', itemPaths), warmSignedImageUrls('closets', closetCoverPaths)]);
      })
      .catch(() => undefined);
  }, [userId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      <View style={styles.card}>
        <Text style={styles.body}>Dashboard and recommendations will land here in Milestone 3+.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: '#16171a'
  },
  card: {
    marginTop: 14,
    borderRadius: 20,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6e8ec'
  },
  body: {
    color: '#45464c',
    fontSize: 16,
    lineHeight: 24
  }
});
