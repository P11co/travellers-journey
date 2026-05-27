import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image
} from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppStore from '../../src/store';

export default function CurrentItineraryView({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const itineraries = useAppStore((s) => s.itineraries);
  const generatedItinerary = useAppStore((s) => s.generatedItinerary);
  const itineraryId = route?.params?.itineraryId;
  const itinerary = itineraries.find((item) => item.id === itineraryId) || generatedItinerary || itineraries[0] || null;
  const stops = itinerary?.stops || [];

  const handleSavePlan = () => {
    navigation.navigate('Home');
  };

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Home');
  };

  const renderTimelineStop = (stop, index) => {
    const isActive = index === 0;
    const hasImage = Boolean(stop.image);

    return (
      <View key={stop.id || `${stop.name}-${index}`} style={styles.timelineNodeRow}>
        <View style={[styles.timelineIconUnit, isActive && styles.activeNodeIcon]}>
          <Svg width="16" height="16" fill="none" stroke={isActive ? '#ffffff' : '#9ca3af'} strokeWidth="2" viewBox="0 0 24 24">
            <Path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <Path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </Svg>
        </View>
        <View style={[styles.cardBg, hasImage ? styles.overflowClipCard : [styles.cardPaddingArea, styles.radiusPatch]]}>
          {hasImage && (
            <Image
              source={{ uri: stop.image }}
              style={styles.cardHeroImage}
            />
          )}
          <View style={hasImage ? styles.cardPaddingArea : null}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardNodeTitle}>{stop.name}</Text>
              <Text style={isActive ? styles.monoTimeActive : styles.monoTimeMuted}>{stop.time}</Text>
            </View>
            <Text style={styles.cardBodyDescription}>{stop.description}</Text>
            <View style={styles.badgeClusterRow}>
              <View style={styles.grayTagBadge}>
                <Text style={styles.grayTagText}>{stop.duration}</Text>
              </View>
              {(stop.tags || []).slice(0, 1).map((tag) => (
                <View key={tag} style={styles.grayTagBadge}>
                  <Text style={styles.grayTagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={{ height: insets.top }} />

      {/* 1. FIXED CONTENT SYSTEM HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Svg width="18" height="18" fill="none" stroke="#a1a1aa" strokeWidth="2" viewBox="0 0 24 24">
            <Path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* 2. CORE CONTENT SCROLL VIEW */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollPadding}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenHeadline}>Current Itinerary</Text>

        {/* SUMMARY INTERFACE CARD HIGHLIGHT */}
        <View style={styles.cardBg}>
          <View style={styles.summaryTopRow}>
            <View style={styles.summaryIconWrapper}>
              <Svg width="20" height="20" fill="none" stroke="#5c77ff" strokeWidth="2" viewBox="0 0 24 24">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <Path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </Svg>
            </View>
            <View>
              <Text style={styles.summaryTitle}>{itinerary?.name || 'Gyeongbokgung Palace Tour'}</Text>
              <Text style={styles.textMuted}>{itinerary?.location || 'Gyeongbokgung Palace, Seoul'}</Text>
            </View>
          </View>

          <View style={styles.timeTagBadge}>
            <Svg width="16" height="16" fill="none" stroke="#4ade80" strokeWidth="2" viewBox="0 0 24 24" style={styles.tagIconSpace}>
              <Path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </Svg>
            <Text style={styles.timeBadgeText}>{itinerary?.duration || '8 Hours'}</Text>
          </View>
        </View>

        {/* TIMELINE ARCHITECTURE WRAPPER */}
        <View style={styles.timelineWrapper}>

          {/* Continuous Running Svg Line Component */}
          <Svg style={styles.absoluteTimelineLine} pointerEvents="none">
            <Line x1="20" y1="32" x2="20" y2={Math.max(120, stops.length * 120)} stroke="#2a2a2a" strokeWidth="1" />
          </Svg>

          {stops.length ? (
            stops.map(renderTimelineStop)
          ) : (
            <View style={[styles.cardBg, styles.cardPaddingArea, styles.radiusPatch]}>
              <Text style={styles.cardBodyDescription}>Generate an itinerary to review the route here.</Text>
            </View>
          )}

        </View>

      </ScrollView>

      <View style={[styles.bottomStickyActionTray, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.primaryActionButton} onPress={handleSavePlan}>
          <Svg width="18" height="18" fill="none" stroke="#ffffff" strokeWidth="2" viewBox="0 0 24 24" style={styles.tagIconSpace}>
            <Path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </Svg>
          <Text style={styles.primaryButtonText}>Understood, Save Plan</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1014',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#1f2024',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollPadding: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 132,
  },
  screenHeadline: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  cardBg: {
    backgroundColor: '#1a1b1e',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 20,
  },
  radiusPatch: {
    borderRadius: 20,
  },
  overflowClipCard: {
    overflow: 'hidden',
    borderRadius: 20,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    paddingBottom: 12,
  },
  summaryIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1f2024',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  textMuted: {
    fontSize: 14,
    color: '#9ca3af',
  },
  timeTagBadge: {
    backgroundColor: '#22252a',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginBottom: 16,
  },
  tagIconSpace: {
    marginRight: 8,
  },
  timeBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  timelineWrapper: {
    position: 'relative',
    paddingLeft: 40,
    marginTop: 16,
  },
  absoluteTimelineLine: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  timelineNodeRow: {
    position: 'relative',
    marginBottom: 32,
    width: '100%',
  },
  timelineIconUnit: {
    position: 'absolute',
    left: -40,
    top: 0,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1b1e',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeNodeIcon: {
    backgroundColor: '#5c77ff',
    borderWidth: 0,
  },
  cardHeroImage: {
    width: '100%',
    height: 128,
  },
  cardPaddingArea: {
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardNodeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  monoTimeActive: {
    fontSize: 12,
    fontFamily: 'Courier',
    color: '#4ade80',
    fontWeight: '600',
  },
  monoTimeMuted: {
    fontSize: 12,
    fontFamily: 'Courier',
    color: '#9ca3af',
  },
  cardBodyDescription: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
  },
  badgeClusterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    marginTop: 2,
  },
  greenTagBadge: {
    backgroundColor: 'rgba(20, 83, 45, 0.3)',
    borderColor: '#166534',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  greenTagText: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: '700',
  },
  grayTagBadge: {
    backgroundColor: '#27272a',
    borderColor: '#3f3f46',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  grayTagText: {
    color: '#d4d4d8',
    fontSize: 10,
    fontWeight: '700',
  },
  bottomStickyActionTray: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 16, 20, 0.96)',
    borderTopWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingTop: 14,
    zIndex: 80,
  },
  primaryActionButton: {
    backgroundColor: '#5c77ff',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
});
