import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import ARMapNavigationView from '../ar_map_navigation_animated';
import BuddyAIChatOverlay from '../buddy_ai_chat_overlay_true_60_height';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppStore from '../../src/store';
import TrioDock from '../../src/components/TrioDock';

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
  const activeTourId = useAppStore((s) => s.activeTourId);
  const lastLoggedAtRef = useRef(0);
  const chatOverlayBottomOffset = 116;

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

  const handleItineraryDockPress = () => {
    navigation.navigate('ConfirmItinerary', activeTourId ? { itineraryId: activeTourId } : undefined);
  };

  const handleAskWaypoint = () => {
    setChatSheetMode((mode) => (mode === 'full' ? 'full' : 'half'));
  };

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <ARMapNavigationView
        navigation={navigation}
        showBottomNav={false}
        onAskWaypoint={handleAskWaypoint}
      />

      {/* Chat Overlay (absolute positioned, bottom sheet) */}
      <BuddyAIChatOverlay
        navigation={navigation}
        bottomOffset={chatOverlayBottomOffset + insets.bottom}
        sheetMode={chatSheetMode}
        onSheetModeChange={setChatSheetMode}
      />

      <TrioDock
        navigation={navigation}
        activeKey={chatSheetMode !== 'folded' ? 'chat' : null}
        bottomOffset={24}
        onItineraryPress={handleItineraryDockPress}
        onChatPress={handleChatDockPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f13',
  },
});
