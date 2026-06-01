import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import ARMapNavigationView from '../ar_map_navigation_animated';
import AIChatInterface from '../buddy_ai_chat_fullscreen_open_in_naver';
import useAppStore from '../../src/store';

/**
 * TourMapScreen renders the AR map and sends chat actions to the shared
 * full-screen chat interface.
 */
export default function TourMapScreen({ navigation }) {
  const [chatPanelMode, setChatPanelMode] = useState('half');
  const logActivity = useAppStore((s) => s.logActivity);
  const setCurrentLocation = useAppStore((s) => s.setCurrentLocation);
  const activeTourId = useAppStore((s) => s.activeTourId);
  const lastLoggedAtRef = useRef(0);

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

  const handleItineraryDockPress = () => {
    navigation.navigate('ConfirmItinerary', activeTourId ? { itineraryId: activeTourId } : undefined);
  };

  const handleAskWaypoint = () => {
    setChatPanelMode('full');
  };

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <ARMapNavigationView
        navigation={navigation}
        showBottomNav={false}
        onAskWaypoint={handleAskWaypoint}
      />

      <AIChatInterface
        navigation={navigation}
        presentation="embedded"
        panelMode={chatPanelMode}
        onItineraryPress={handleItineraryDockPress}
        onChatPress={() => {
          setChatPanelMode((mode) => (mode === 'full' ? 'half' : 'full'));
        }}
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
