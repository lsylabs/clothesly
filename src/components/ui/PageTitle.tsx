import { StyleSheet, Text } from 'react-native';

type Props = {
  title: string;
};

export default function PageTitle({ title }: Props) {
  return <Text style={styles.title}>{title}</Text>;
}

const styles = StyleSheet.create({
  title: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: '#16171a'
  }
});
