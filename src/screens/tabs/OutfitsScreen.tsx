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
    backgroundColor: '#f5f1e8',
    padding: 20,
    justifyContent: 'center'
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222'
  },
  body: {
    marginTop: 10,
    color: '#444',
    fontSize: 15,
    lineHeight: 22
  }
});

