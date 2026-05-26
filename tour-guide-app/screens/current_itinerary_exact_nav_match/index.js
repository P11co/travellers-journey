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
  const itineraryId = route?.params?.itineraryId;
  const itinerary = itineraries.find((item) => item.id === itineraryId) || itineraries[itineraries.length - 1] || null;

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
            <Line x1="20" y1="32" x2="20" y2="680" stroke="#2a2a2a" strokeWidth="1" />
          </Svg>

          {/* TIMELINE CARD NODE 1 */}
          <View style={styles.timelineNodeRow}>
            <View style={[styles.timelineIconUnit, styles.activeNodeIcon]}>
              <Svg width="16" height="16" fill="none" stroke="#ffffff" strokeWidth="2" viewBox="0 0 24 24">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
              </Svg>
            </View>
            <View style={[styles.cardBg, styles.overflowClipCard]}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=500' }}
                style={styles.cardHeroImage}
              />
              <View style={styles.cardPaddingArea}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardNodeTitle}>Gyeongbokgung Palace</Text>
                  <Text style={styles.monoTimeActive}>09:00 AM</Text>
                </View>
                <Text style={styles.cardBodyDescription}>Experience the grandeur of the main royal palace of the Joseon dynasty.</Text>
              </View>
            </View>
          </View>

          {/* TIMELINE CARD NODE 2 */}
          <View style={styles.timelineNodeRow}>
            <View style={styles.timelineIconUnit}>
              <Svg width="16" height="16" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <Path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </Svg>
            </View>
            <View style={[styles.cardBg, styles.cardPaddingArea, styles.radiusPatch]}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardNodeTitle}>Bukchon Hanok Village</Text>
                <Text style={styles.monoTimeMuted}>11:30 AM</Text>
              </View>
              <Text style={styles.cardBodyDescription}>Wander through hundreds of traditional houses, called hanok, that date back to the Joseon dynasty.</Text>
            </View>
          </View>

          {/* TIMELINE CARD NODE 3 */}
          <View style={styles.timelineNodeRow}>
            <View style={styles.timelineIconUnit}>
              <Svg width="16" height="16" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </Svg>
            </View>
            <View style={[styles.cardBg, styles.cardPaddingArea, styles.radiusPatch]}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardNodeTitle}>Lunch in Insadong</Text>
                <Text style={styles.monoTimeMuted}>01:30 PM</Text>
              </View>
              <View style={styles.badgeClusterRow}>
                <View style={styles.greenTagBadge}>
                  <Text style={styles.greenTagText}>TOP CHOICE</Text>
                </View>
                <View style={styles.grayTagBadge}>
                  <Text style={styles.grayTagText}>TRADITIONAL</Text>
                </View>
              </View>
              <Text style={styles.cardBodyDescription}>Enjoy authentic Korean cuisine in the heart of Seoul's traditional cultural district.</Text>
            </View>
          </View>

          {/* TIMELINE CARD NODE 4 */}
          <View style={styles.timelineNodeRow}>
            <View style={styles.timelineIconUnit}>
              <Svg width="16" height="16" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </Svg>
            </View>
            <View style={[styles.cardBg, styles.overflowClipCard]}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1578637387939-43c525550085?w=500' }}
                style={styles.cardHeroImage}
              />
              <View style={styles.cardPaddingArea}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardNodeTitle}>N Seoul Tower</Text>
                  <Text style={styles.monoTimeMuted}>04:00 PM</Text>
                </View>
                <Text style={styles.cardBodyDescription}>Catch the sunset and panoramic city views from the highest point in Seoul.</Text>
              </View>
            </View>
          </View>

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
