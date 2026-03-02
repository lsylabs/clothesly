import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
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
    backgroundColor: '#ecebed',
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
    backgroundColor: '#f0f0f1',
    borderWidth: 1,
    borderColor: '#e5e4e7'
  },
  body: {
    color: '#45464c',
    fontSize: 16,
    lineHeight: 24
  }
});
