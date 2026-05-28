import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ITEMS = [
  {
    key: 'itinerary',
    route: 'ConfirmItinerary',
    path: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    key: 'chat',
    route: 'Chat',
    path: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  },
  {
    key: 'settings',
    route: 'Settings',
    paths: [
      'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
      'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    ],
  },
];

export default function TrioDock({
  navigation,
  activeKey,
  placement = 'bottom',
  bottomOffset = 24,
  topOffset = 48,
  onItineraryPress,
  onChatPress,
  onSettingsPress,
  style,
}) {
  const insets = useSafeAreaInsets();

  const handlePress = (item) => {
    if (item.key === 'itinerary' && onItineraryPress) {
      onItineraryPress();
      return;
    }
    if (item.key === 'chat' && onChatPress) {
      onChatPress();
      return;
    }
    if (item.key === 'settings' && onSettingsPress) {
      onSettingsPress();
      return;
    }
    navigation?.navigate(item.route);
  };

  const positionStyle = placement === 'top'
    ? { top: insets.top + topOffset }
    : { bottom: insets.bottom + bottomOffset };

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, positionStyle, style]}>
      <View style={styles.dock}>
        {ITEMS.map((item) => {
          const active = item.key === activeKey;
          const stroke = active ? '#ffffff' : '#a1a1aa';
          const paths = item.paths || [item.path];

          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.button, active && styles.activeButton]}
              onPress={() => handlePress(item)}
              activeOpacity={0.82}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Svg width="24" height="24" fill="none" stroke={stroke} strokeWidth="2" viewBox="0 0 24 24">
                {paths.map((path) => (
                  <Path key={path} d={path} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </Svg>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 120,
    alignItems: 'center',
  },
  dock: {
    minWidth: 230,
    height: 76,
    backgroundColor: 'rgba(22, 22, 26, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },
  button: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    backgroundColor: '#5c77ff',
    shadowColor: '#5c77ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 16,
    elevation: 10,
  },
});
