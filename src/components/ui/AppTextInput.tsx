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
    borderColor: '#d9dce3',
    borderRadius: 14,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#1d1e22'
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: 'top'
  }
});
