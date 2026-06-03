import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppStore from '../../src/store';
import { getTheme } from '../../src/theme';
import AppleBackButton from '../../src/components/AppleBackButton';
import RemoteImage from '../../src/components/RemoteImage';

export default function CurrentItineraryView({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const itineraries = useAppStore((s) => s.itineraries);
  const generatedItinerary = useAppStore((s) => s.generatedItinerary);
  const activeTourId = useAppStore((s) => s.activeTourId);
  const loadItinerary = useAppStore((s) => s.loadItinerary);
  const commitItinerary = useAppStore((s) => s.commitItinerary);
  const startTour = useAppStore((s) => s.startTour);
  const endTour = useAppStore((s) => s.endTour);
  const isLoadingItinerary = useAppStore((s) => s.isLoadingItinerary);
  const itineraryError = useAppStore((s) => s.itineraryError);
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = getTheme(themeMode);
  const itineraryId = route?.params?.itineraryId;
  const itinerary =
    itineraries.find((item) => item.id === itineraryId) ||
    itineraries.find((item) => item.id === activeTourId) ||
    generatedItinerary ||
    itineraries[0] ||
    null;
  const stops = itinerary?.stops || [];
  const isViewingActiveTour = Boolean(itinerary?.id && activeTourId && itinerary.id === activeTourId);

  useEffect(() => {
    if (!itineraryId || itinerary || isLoadingItinerary) return;
    loadItinerary(itineraryId).catch(() => {
      // Error state is rendered in the timeline fallback.
    });
  }, [itineraryId, itinerary, isLoadingItinerary, loadItinerary]);

  const handlePrimaryAction = () => {
    if (isViewingActiveTour) {
      navigation.navigate('TourMap');
      return;
    }

    const committedId = commitItinerary(itinerary?.id);
    if (!committedId) return;
    startTour(committedId);
    navigation.navigate('TourMap');
  };

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const handleEndTour = () => {
    endTour();
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const renderTimelineStop = (stop, index) => {
    const isActive = index === 0;
    const hasImage = Boolean(stop.image);

    return (
      <View key={stop.id || `${stop.name}-${index}`} style={styles.timelineNodeRow}>
        <View style={[
          styles.timelineIconUnit,
          { backgroundColor: theme.iconSurface, borderColor: theme.border },
          isActive && [styles.activeNodeIcon, { backgroundColor: theme.accent }],
        ]}>
          <Svg width="16" height="16" fill="none" stroke={isActive ? '#ffffff' : theme.mutedText} strokeWidth="2" viewBox="0 0 24 24">
            <Path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <Path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </Svg>
        </View>
        <View style={[styles.cardBg, { backgroundColor: theme.surface, borderColor: theme.border }, hasImage ? styles.overflowClipCard : [styles.cardPaddingArea, styles.radiusPatch]]}>
          {hasImage && (
            <RemoteImage
              sourcePath={stop.image}
              style={styles.cardHeroImage}
            />
          )}
          <View style={hasImage ? styles.cardPaddingArea : null}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardNodeTitle, { color: theme.text }]}>{stop.name}</Text>
              <Text style={isActive ? styles.monoTimeActive : [styles.monoTimeMuted, { color: theme.subtleText }]}>{stop.time}</Text>
            </View>
            <Text style={[styles.cardBodyDescription, { color: theme.mutedText }]}>{stop.description}</Text>
            <View style={styles.badgeClusterRow}>
              <View style={[styles.grayTagBadge, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
                <Text style={[styles.grayTagText, { color: theme.mutedText }]}>{stop.duration}</Text>
              </View>
              {(stop.tags || []).slice(0, 1).map((tag) => (
                <View key={tag} style={[styles.grayTagBadge, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
                  <Text style={[styles.grayTagText, { color: theme.mutedText }]}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ height: insets.top }} />

      {/* 1. FIXED CONTENT SYSTEM HEADER */}
      <View style={[styles.header, { borderColor: theme.border }]}>
        <AppleBackButton onPress={handleGoBack} />
      </View>

      {/* 2. CORE CONTENT SCROLL VIEW */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollPadding}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.screenHeadline, { color: theme.text }]}>Current Itinerary</Text>

        {/* SUMMARY INTERFACE CARD HIGHLIGHT */}
        <View style={[styles.cardBg, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.summaryTopRow}>
            <View style={[styles.summaryIconWrapper, { backgroundColor: theme.iconSurface }]}>
              <Svg width="20" height="20" fill="none" stroke={theme.accent} strokeWidth="2" viewBox="0 0 24 24">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <Path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </Svg>
            </View>
            <View style={styles.summaryTextWrap}>
              <Text style={[styles.summaryTitle, { color: theme.text }]}>{itinerary?.name || 'Gyeongbokgung Palace Tour'}</Text>
              <Text style={[styles.textMuted, { color: theme.mutedText }]}>{itinerary?.location || 'Gyeongbokgung Palace, Seoul'}</Text>
            </View>
          </View>

          <View style={[styles.timeTagBadge, { backgroundColor: theme.elevated }]}>
            <Svg width="16" height="16" fill="none" stroke="#4ade80" strokeWidth="2" viewBox="0 0 24 24" style={styles.tagIconSpace}>
              <Path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </Svg>
            <Text style={[styles.timeBadgeText, { color: theme.text }]}>{itinerary?.duration || '8 Hours'}</Text>
          </View>
        </View>

        {/* TIMELINE ARCHITECTURE WRAPPER */}
        <View style={styles.timelineWrapper}>

          <View style={[styles.timelineLine, { backgroundColor: theme.border }]} pointerEvents="none" />

          {stops.length ? (
            stops.map(renderTimelineStop)
          ) : isLoadingItinerary ? (
            <View style={[styles.cardBg, styles.cardPaddingArea, styles.radiusPatch, styles.loadingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ActivityIndicator color={theme.accent} />
              <Text style={[styles.cardBodyDescription, { color: theme.mutedText }]}>Loading itinerary...</Text>
            </View>
          ) : (
            <View style={[styles.cardBg, styles.cardPaddingArea, styles.radiusPatch, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.cardBodyDescription, { color: theme.mutedText }]}>
                {itineraryError || 'Generate an itinerary to review the route here.'}
              </Text>
            </View>
          )}

        </View>

      </ScrollView>

      <View style={[styles.bottomStickyActionTray, { paddingBottom: insets.bottom + 16, backgroundColor: theme.panel, borderColor: theme.border }]}>
        {isViewingActiveTour && (
          <TouchableOpacity
            style={[styles.secondaryActionButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
            onPress={handleEndTour}
          >
            <Svg width="17" height="17" fill="none" stroke={theme.mutedText} strokeWidth="2" viewBox="0 0 24 24" style={styles.tagIconSpace}>
              <Path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M20 9A8 8 0 006.7 5.7L4 10m0 5a8 8 0 0013.3 3.3L20 14" />
            </Svg>
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>End Tour</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.primaryActionButton, { backgroundColor: theme.accent }, (!itinerary || isLoadingItinerary) && styles.disabledButton]}
          onPress={handlePrimaryAction}
          disabled={!itinerary || isLoadingItinerary}
        >
          <Svg width="18" height="18" fill="none" stroke="#ffffff" strokeWidth="2" viewBox="0 0 24 24" style={styles.tagIconSpace}>
            <Path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={isViewingActiveTour ? 'M15 19l-7-7 7-7' : 'M5 13l4 4L19 7'}
            />
          </Svg>
          <Text style={styles.primaryButtonText}>
            {isViewingActiveTour ? 'Back to Map' : 'Save & Start Tour'}
          </Text>
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
    minWidth: 0,
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
    minWidth: 0,
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
    lineHeight: 23,
    flexShrink: 1,
  },
  textMuted: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 19,
    flexShrink: 1,
  },
  summaryTextWrap: {
    flex: 1,
    minWidth: 0,
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
    width: '100%',
    minWidth: 0,
  },
  loadingCard: {
    alignItems: 'center',
    gap: 10,
  },
  timelineLine: {
    position: 'absolute',
    left: 20,
    top: 10,
    bottom: 24,
    width: 1,
    backgroundColor: '#2a2a2a',
  },
  timelineNodeRow: {
    position: 'relative',
    marginBottom: 32,
    width: '100%',
    minWidth: 0,
    zIndex: 2,
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
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 8,
    minWidth: 0,
  },
  cardNodeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 21,
    flex: 1,
    minWidth: 0,
  },
  monoTimeActive: {
    fontSize: 12,
    fontFamily: 'Courier',
    color: '#4ade80',
    fontWeight: '600',
    maxWidth: 76,
    lineHeight: 16,
  },
  monoTimeMuted: {
    fontSize: 12,
    fontFamily: 'Courier',
    color: '#9ca3af',
    maxWidth: 76,
    lineHeight: 16,
  },
  cardBodyDescription: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
  },
  badgeClusterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  secondaryActionButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
});
