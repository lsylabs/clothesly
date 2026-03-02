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
      backgroundColor: '#141518',
      borderColor: '#141518',
      borderWidth: 1
    },
    text: {
      color: '#ffffff',
      fontWeight: '700'
    }
  },
  secondary: {
    button: {
      backgroundColor: '#ffffff',
      borderColor: '#d9dce3',
      borderWidth: 2
    },
    text: {
      color: '#232429',
      fontWeight: '600'
    }
  },
  danger: {
    button: {
      backgroundColor: '#b43d3d',
      borderColor: '#b43d3d',
      borderWidth: 1
    },
    text: {
      color: '#ffffff',
      fontWeight: '700'
    }
  },
  ghost: {
    button: {
      backgroundColor: '#ffffff',
      borderColor: '#d9dce3',
      borderWidth: 1
    },
    text: {
      color: '#292a30',
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
    fontSize: 15
  },
  disabled: {
    opacity: 0.65
  }
});
