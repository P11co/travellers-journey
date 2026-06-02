import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import useAppStore from '../store';
import { getTheme } from '../theme';

export default function AppleBackButton({ onPress }) {
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = getTheme(themeMode);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: theme.surface || '#ffffff',
          borderColor: theme.border || '#e5e5ea',
          shadowColor: '#000',
        }
      ]}
      onPress={onPress}
      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
      activeOpacity={0.7}
    >
      <Svg width="20" height="20" fill="none" stroke={theme.text || '#000000'} strokeWidth="2.5" viewBox="0 0 24 24">
        <Path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </Svg>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
