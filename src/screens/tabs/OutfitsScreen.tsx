import { StyleSheet, View } from 'react-native';

import InfoCard from '../../components/ui/InfoCard';
import PageTitle from '../../components/ui/PageTitle';

export default function OutfitsScreen() {
  return (
    <View style={styles.container}>
      <PageTitle title="Outfits" />
      <InfoCard style={styles.body} text="Outfit features are planned and will be added in a future milestone." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20
  },
  body: {
    marginTop: 14
  }
});
