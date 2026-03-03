import type { PressableProps, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = Omit<PressableProps, 'style'> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  loadingLabel?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const variantStyles: Record<ButtonVariant, { button: ViewStyle; text: TextStyle }> = {
  primary: {
    button: {
      backgroundColor: '#0A0A0A',
      borderColor: '#0A0A0A',
      borderWidth: 1
    },
    text: {
      color: '#FAFAFA',
      fontWeight: '700'
    }
  },
  secondary: {
    button: {
      backgroundColor: '#FAFAFA',
      borderColor: '#E0E0E0',
      borderWidth: 2
    },
    text: {
      color: '#0A0A0A',
      fontWeight: '600'
    }
  },
  danger: {
    button: {
      backgroundColor: '#DC2626',
      borderColor: '#DC2626',
      borderWidth: 1
    },
    text: {
      color: '#FAFAFA',
      fontWeight: '700'
    }
  },
  ghost: {
    button: {
      backgroundColor: '#FAFAFA',
      borderColor: '#E0E0E0',
      borderWidth: 1
    },
    text: {
      color: '#0A0A0A',
      fontWeight: '600'
    }
  }
};

export default function AppButton({
  label,
  variant = 'primary',
  loading = false,
  loadingLabel,
  disabled,
  style,
  textStyle,
  ...rest
}: Props) {
  const isDisabled = Boolean(disabled || loading);
  const variantStyle = variantStyles[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={[styles.base, variantStyle.button, isDisabled && styles.disabled, style]}
      {...rest}
    >
      <Text style={[styles.baseText, variantStyle.text, textStyle]}>{loading ? loadingLabel ?? label : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  baseText: {
    fontSize: 16
  },
  disabled: {
    opacity: 0.65
  }
});
