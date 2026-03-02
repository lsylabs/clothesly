import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      <Text style={styles.body}>Dashboard and recommendations will land here in Milestone 3+.</Text>
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
