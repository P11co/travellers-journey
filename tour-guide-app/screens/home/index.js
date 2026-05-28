import React from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import useAppStore from '../../src/store';

export default function HomeScreen({ navigation }) {
  const itineraries = useAppStore((s) => s.itineraries);
  const startTour = useAppStore((s) => s.startTour);
  const removeItinerary = useAppStore((s) => s.removeItinerary);

  const handleStartTour = (itinerary) => {
    startTour(itinerary.id);
    navigation.navigate('TourMap');
  };

  const handleDeleteItinerary = (itinerary) => {
    Alert.alert(
      'Delete itinerary?',
      `Remove ${itinerary.name} from this device?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => removeItinerary(itinerary.id),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeftRow}>
          <Svg width="24" height="24" fill="#5c77ff" viewBox="0 0 24 24">
            <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
          </Svg>
          <Text style={styles.headerBrandText}>Buddy</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Svg width="22" height="22" fill="none" stroke="#a1a1aa" strokeWidth="2" viewBox="0 0 24 24">
            <Path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <Path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </Svg>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Your Journeys</Text>
          <Text style={styles.welcomeSubtitle}>
            Plan a new trip or continue an existing tour.
          </Text>
        </View>

        {/* Create New Journey CTA */}
        <TouchableOpacity
          style={styles.createNewCard}
          onPress={() => navigation.navigate('PlanJourney')}
        >
          <View style={styles.createNewIconContainer}>
            <Svg width="28" height="28" fill="none" stroke="#5c77ff" strokeWidth="2" viewBox="0 0 24 24">
              <Path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </Svg>
          </View>
          <View style={styles.createNewTextContainer}>
            <Text style={styles.createNewTitle}>Create New Journey</Text>
            <Text style={styles.createNewDesc}>
              Plan your next adventure with AI-optimized routes
            </Text>
          </View>
          <Text style={styles.arrow}>❯</Text>
        </TouchableOpacity>

        {/* Itinerary List */}
        {itineraries.length > 0 && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved Itineraries</Text>
            <Text style={styles.sectionCount}>{itineraries.length}</Text>
          </View>
        )}

        {itineraries.map((itinerary) => (
          <View key={itinerary.id} style={styles.itineraryCard}>
            {/* Card Header */}
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Svg width="20" height="20" fill="none" stroke="#5c77ff" strokeWidth="2" viewBox="0 0 24 24">
                  <Path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <Path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </Svg>
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.itineraryName}>{itinerary.name}</Text>
                <Text style={styles.itineraryLocation}>{itinerary.location}</Text>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteItinerary(itinerary)}
                hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
              >
                <Svg width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="1.8" viewBox="0 0 24 24">
                  <Path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M10 11v6m4-6v6M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v12a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12z" />
                </Svg>
              </TouchableOpacity>
            </View>

            {/* Meta Tags */}
            <View style={styles.metaRow}>
              <View style={styles.metaTag}>
                <Svg width="12" height="12" fill="none" stroke="#4ade80" strokeWidth="2" viewBox="0 0 24 24">
                  <Path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </Svg>
                <Text style={styles.metaTagText}>{itinerary.duration}</Text>
              </View>
              <View style={styles.metaTag}>
                <Svg width="12" height="12" fill="none" stroke="#a1a1aa" strokeWidth="2" viewBox="0 0 24 24">
                  <Path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </Svg>
                <Text style={styles.metaTagText}>{itinerary.stopCount} stops</Text>
              </View>
            </View>

            {/* Start Tour Button */}
            <TouchableOpacity
              style={styles.startTourButton}
              onPress={() => handleStartTour(itinerary)}
            >
              <Svg width="20" height="20" fill="none" stroke="#ffffff" strokeWidth="2" viewBox="0 0 24 24" style={{ marginRight: 8 }}>
                <Path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <Path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </Svg>
              <Text style={styles.startTourButtonText}>Start Tour</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Empty State */}
        {itineraries.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Svg width="48" height="48" fill="none" stroke="#3f3f46" strokeWidth="1.5" viewBox="0 0 24 24">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>No journeys yet</Text>
            <Text style={styles.emptyDesc}>
              Create your first journey above to get started!
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F12',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2024',
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBrandText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  settingsButton: {
    padding: 8,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  welcomeSection: {
    marginBottom: 28,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#a1a1aa',
    lineHeight: 20,
  },
  createNewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: '#5c77ff',
    borderStyle: 'dashed',
    borderRadius: 20,
    padding: 20,
    marginBottom: 32,
  },
  createNewIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(92, 119, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(92, 119, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  createNewTextContainer: {
    flex: 1,
  },
  createNewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  createNewDesc: {
    fontSize: 12,
    color: '#a1a1aa',
    lineHeight: 16,
  },
  arrow: {
    color: '#5c77ff',
    fontSize: 16,
    marginLeft: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e4e4e7',
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5c77ff',
    backgroundColor: 'rgba(92, 119, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  itineraryCard: {
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(92, 119, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(92, 119, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardHeaderText: {
    flex: 1,
  },
  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.18)',
    marginLeft: 10,
  },
  itineraryName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  itineraryLocation: {
    fontSize: 13,
    color: '#a1a1aa',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1f2024',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  metaTagText: {
    fontSize: 12,
    color: '#d4d4d8',
    fontWeight: '500',
  },
  startTourButton: {
    backgroundColor: '#5c77ff',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5c77ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  startTourButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#1f2024',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#71717a',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#52525b',
    textAlign: 'center',
    lineHeight: 20,
  },
});
