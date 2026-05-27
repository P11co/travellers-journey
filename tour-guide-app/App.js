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

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#0F0F12' },
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="PlanJourney" component={PlanYourJourneyView} />
          <Stack.Screen name="ConfirmItinerary" component={CurrentItineraryView} />
          <Stack.Screen name="TourMap" component={TourMapScreen} />
          <Stack.Screen name="Chat" component={AIChatInterface} options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="Settings" component={SettingsConfigurationView} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
