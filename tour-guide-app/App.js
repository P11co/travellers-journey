import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens
import HomeScreen from './screens/home';
import PlanYourJourneyView from './screens/plan_your_journey_animated';
import CurrentItineraryView from './screens/current_itinerary_exact_nav_match';
import TourMapScreen from './screens/tour_map';
import AIChatInterface from './screens/buddy_ai_chat_fullscreen_open_in_naver';
import SettingsConfigurationView from './screens/settings_configuration_animated';
import HotspotDetailScreen from './screens/hotspot_detail';
import WaypointArticleScreen from './screens/waypoint_article';
import useAppStore from './src/store';
import { getTheme } from './src/theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = getTheme(themeMode);
  const navigationTheme = {
    dark: themeMode === 'dark',
    colors: {
      primary: theme.accent,
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      notification: theme.accent,
    },
    fonts: {
      regular: { fontFamily: undefined, fontWeight: '400' },
      medium: { fontFamily: undefined, fontWeight: '500' },
      bold: { fontFamily: undefined, fontWeight: '700' },
      heavy: { fontFamily: undefined, fontWeight: '900' },
    },
  };

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: theme.background },
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="PlanJourney" component={PlanYourJourneyView} />
          <Stack.Screen
            name="HotspotDetail"
            component={HotspotDetailScreen}
            options={{ gestureEnabled: true, animation: 'slide_from_right' }}
          />
          <Stack.Screen name="ConfirmItinerary" component={CurrentItineraryView} />
          <Stack.Screen name="TourMap" component={TourMapScreen} />
          <Stack.Screen
            name="WaypointArticle"
            component={WaypointArticleScreen}
            options={{ gestureEnabled: true, animation: 'slide_from_right' }}
          />
          <Stack.Screen name="Chat" component={AIChatInterface} options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="Settings" component={SettingsConfigurationView} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
