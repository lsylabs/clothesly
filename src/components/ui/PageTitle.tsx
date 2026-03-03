import { StyleSheet, Text } from 'react-native';

type Props = {
  title: string;
};

export default function PageTitle({ title }: Props) {
  return <Text style={styles.title}>{title}</Text>;
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: '#0A0A0A'
  }
});
