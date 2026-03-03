import type { ComponentType, PropsWithChildren } from 'react';
import { useCallback, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

function ScreenFadeTransition({ children }: PropsWithChildren) {
  const opacity = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      opacity.setValue(0.7);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start();
    }, [opacity])
  );

  return <Animated.View style={[styles.fill, { opacity }]}>{children}</Animated.View>;
}

export function withScreenFadeTransition<Props extends object>(Component: ComponentType<Props>) {
  function Wrapped(props: Props) {
    return (
      <ScreenFadeTransition>
        <Component {...props} />
      </ScreenFadeTransition>
    );
  }

  Wrapped.displayName = `WithScreenFadeTransition(${Component.displayName ?? Component.name ?? 'Screen'})`;
  return Wrapped;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1
  }
});
