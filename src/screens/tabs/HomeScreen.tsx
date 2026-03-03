import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import InfoCard from '../../components/ui/InfoCard';
import PageTitle from '../../components/ui/PageTitle';
import { useAuth } from '../../services/AuthContext';
import { warmSignedImageUrls } from '../../services/imageCacheService';
import { prefetchWardrobeData } from '../../services/wardrobeDataService';

export default function HomeScreen() {
  const { session } = useAuth();
  const fullName = session?.user.user_metadata?.full_name ?? session?.user.user_metadata?.name ?? '';
  const firstNameFromFullName = typeof fullName === 'string' ? fullName.trim().split(/\s+/)[0] : '';
  const emailLocalPart = session?.user.email?.split('@')[0] ?? '';
  const firstName = firstNameFromFullName || emailLocalPart || 'there';
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
      <PageTitle title={`Welcome, ${firstName}`} />
      <InfoCard style={styles.card} text="Dashboard and recommendations will land here in Milestone 3+." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    padding: 20
  },
  card: {
    marginTop: 14
  }
});
