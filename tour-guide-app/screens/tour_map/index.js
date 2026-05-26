import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import ARMapNavigationView from '../ar_map_navigation_animated';
import BuddyAIChatOverlay from '../buddy_ai_chat_overlay_true_60_height';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * TourMapScreen composites the AR Map background with the Chat Overlay sheet.
 * The AR map fills the full screen; the chat overlay sits on top as an
 * absolute-positioned sheet covering the bottom portion.
 */
export default function TourMapScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [chatSheetMode, setChatSheetMode] = useState('folded');
  const tourMapDockHeight = 84;
  const chatOverlayBottomOffset = tourMapDockHeight + 24;

  const handleChatDockPress = () => {
    console.log('[TourMap] Chat dock pressed, current mode:', chatSheetMode);
    setChatSheetMode((mode) => {
      const next = mode === 'folded' ? 'full' : 'folded';
      console.log('[TourMap] Switching to mode:', next);
      return next;
    });
  };

  return (
    <View style={styles.container}>
      {/* Full-screen AR Map */}
      <View style={styles.mapLayer}>
        <ARMapNavigationView navigation={navigation} showBottomNav={false} />
      </View>

      {/* Chat Overlay (absolute positioned, bottom sheet) */}
      <BuddyAIChatOverlay
        navigation={navigation}
        bottomOffset={chatOverlayBottomOffset + insets.bottom}
        sheetMode={chatSheetMode}
        onSheetModeChange={setChatSheetMode}
      />

      {/* Tour Bottom Dock: Itinerary / Chat / Settings */}
      <View style={[styles.tourBottomDock, { bottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.dockButton}
          onPress={() => navigation.navigate('ConfirmItinerary')}
        >
          <Svg width="22" height="22" fill="none" stroke="#a1a1aa" strokeWidth="1.8" viewBox="0 0 24 24">
            <Path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </Svg>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dockButton, chatSheetMode !== 'folded' && styles.dockButtonActive]}
          onPress={handleChatDockPress}
          hitSlop={{ top: 16, right: 16, bottom: 16, left: 16 }}
        >
          <Svg width="22" height="22" fill="none" stroke={chatSheetMode !== 'folded' ? '#ffffff' : '#a1a1aa'} strokeWidth="1.8" viewBox="0 0 24 24">
            <Path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </Svg>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dockButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Svg width="22" height="22" fill="none" stroke="#a1a1aa" strokeWidth="1.8" viewBox="0 0 24 24">
            <Path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <Path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </Svg>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f13',
  },
  mapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  tourBottomDock: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(24, 24, 27, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    height: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    zIndex: 100,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 20,
  },
  dockButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  dockButtonActive: {
    backgroundColor: 'rgba(92, 119, 255, 0.2)',
  },
});
