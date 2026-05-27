import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import ARMapNavigationView from '../ar_map_navigation_animated';
import BuddyAIChatOverlay from '../buddy_ai_chat_overlay_true_60_height';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppStore from '../../src/store';

const CHAT_SHEET_MODES = ['folded', 'half', 'full'];

const getNextChatSheetMode = (mode) => {
  const currentIndex = CHAT_SHEET_MODES.indexOf(mode);
  return CHAT_SHEET_MODES[(currentIndex + 1) % CHAT_SHEET_MODES.length];
};

/**
 * TourMapScreen composites the AR Map background with the Chat Overlay sheet.
 * The AR map fills the full screen; the chat overlay sits on top as an
 * absolute-positioned sheet covering the bottom portion.
 */
export default function TourMapScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [chatSheetMode, setChatSheetMode] = useState('folded');
  const logActivity = useAppStore((s) => s.logActivity);
  const setCurrentLocation = useAppStore((s) => s.setCurrentLocation);
  const lastLoggedAtRef = useRef(0);
  const tourMapDockHeight = 68;
  const chatOverlayBottomOffset = tourMapDockHeight + 18;

  useEffect(() => {
    let subscription = null;
    let mounted = true;

    const startLocationTracking = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          return;
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60000,
            distanceInterval: 25,
          },
          async ({ coords }) => {
            if (!mounted) return;
            const lat = coords.latitude;
            const lng = coords.longitude;
            setCurrentLocation({ lat, lng });

            const now = Date.now();
            if (now - lastLoggedAtRef.current < 60000) {
              return;
            }

            lastLoggedAtRef.current = now;
            try {
              await logActivity(lat, lng);
            } catch {
              // Activity logging is opportunistic; chat can still work without it.
            }
          },
        );
      } catch {
        // Keep the map usable if permissions or native location services fail.
      }
    };

    startLocationTracking();

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, [logActivity, setCurrentLocation]);

  const handleChatDockPress = () => {
    console.log('[TourMap] Chat dock pressed, current mode:', chatSheetMode);
    setChatSheetMode((mode) => {
      const next = getNextChatSheetMode(mode);
      console.log('[TourMap] Switching to mode:', next);
      return next;
    });
  };

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <ARMapNavigationView navigation={navigation} showBottomNav={false} />

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
          style={styles.dockHandle}
          onPress={handleChatDockPress}
          activeOpacity={0.8}
          hitSlop={{ top: 12, right: 60, bottom: 10, left: 60 }}
        >
          <View style={styles.dockHandlePill} />
        </TouchableOpacity>

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
  tourBottomDock: {
    position: 'absolute',
    left: 30,
    right: 30,
    backgroundColor: 'rgba(24, 24, 27, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
    gap: 28,
    zIndex: 100,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 20,
  },
  dockHandle: {
    position: 'absolute',
    top: 7,
    left: 0,
    right: 0,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockHandlePill: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#5c77ff',
    shadowColor: '#5c77ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  dockButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  dockButtonActive: {
    backgroundColor: 'rgba(92, 119, 255, 0.2)',
  },
});
