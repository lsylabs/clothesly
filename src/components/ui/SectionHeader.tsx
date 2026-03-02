import { StyleSheet, Text } from 'react-native';

type Props = {
  title: string;
};

export default function SectionHeader({ title }: Props) {
  return <Text style={styles.title}>{title}</Text>;
}

const styles = StyleSheet.create({
  title: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: '700',
    color: '#17181b'
  }
});
