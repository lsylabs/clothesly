import { StyleSheet, Text, View } from 'react-native';

export default function OutfitsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Outfits</Text>
      <Text style={styles.body}>Outfit features are planned and will be added in a future milestone.</Text>
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
  body: {
    marginTop: 14,
    color: '#45464c',
    fontSize: 16,
    lineHeight: 24,
    borderRadius: 20,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6e8ec'
  }
});
