import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  text?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function InfoCard({ text, children, style }: Props) {
  return (
    <View style={[styles.card, style]}>
      {text ? <Text style={styles.text}>{text}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6e8ec'
  },
  text: {
    color: '#45464c',
    fontSize: 16,
    lineHeight: 24
  }
});
