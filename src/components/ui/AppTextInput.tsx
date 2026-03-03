import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet, TextInput } from 'react-native';

type Props = Omit<TextInputProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export default function AppTextInput({ style, inputStyle, multiline, ...rest }: Props) {
  return <TextInput multiline={multiline} style={[styles.input, multiline && styles.multiline, style, inputStyle]} {...rest} />;
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#0A0A0A'
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: 'top'
  }
});
