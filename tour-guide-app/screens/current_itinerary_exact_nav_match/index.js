import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Dimensions 
} from 'react-native';
import Svg, { Line, Circle, Path } from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');

export default function CurrentItineraryView() {
  return (
    <View style={styles.container}>
      
      {/* 1. FIXED CONTENT SYSTEM HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeftRow}>
          <Svg width="24" height="24" fill="#5c77ff" viewBox="0 0 24 24">
            <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
          </Svg>
          <Text style={styles.headerBrandText}>Buddy</Text>
        </View>
        <View style={styles.avatarBorder}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' }} 
            style={styles.profileThumbnail} 
          />
        </View>
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
              <Text style={styles.summaryTitle}>Gyeongbokgung Palace</Text>
              <Text style={styles.textMuted}>Seoul, South Korea</Text>
            </View>
          </View>
          
          <View style={styles.timeTagBadge}>
            <Svg width="16" height="16" fill="none" stroke="#4ade80" strokeWidth="2" viewBox="0 0 24 24" style={styles.tagIconSpace}>
              <Path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </Svg>
            <Text style={styles.timeBadgeText}>8 Hours</Text>
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

        {/* 3. TRIP INTERACTION SUB-BUTTON CONTROLS */}
        <View style={styles.actionButtonGroupContainer}>
          <TouchableOpacity style={styles.primaryActionButton} onPress={() => console.log('Edit tracking timeline context')}>
            <Svg width="18" height="18" fill="none" stroke="#ffffff" strokeWidth="2" viewBox="0 0 24 24" style={styles.tagIconSpace}>
              <Path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </Svg>
            <Text style={styles.primaryButtonText}>Edit Plan</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dangerSecondaryButton} onPress={() => console.log('Wipe out timeline schema configuration')}>
            <Svg width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24" style={styles.tagIconSpace}>
              <Path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </Svg>
            <Text style={styles.dangerButtonText}>Scrap & Restart</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* 4. FLOATING CORE HORIZONTAL ROUTING TAB PILL */}
      <View style={styles.floatingTabsWrapper}>
        <View style={styles.navigationDockPill}>
          
          {/* Active Navigation: Timeline Link */}
          <TouchableOpacity style={styles.tabBubbleActive} onPress={() => console.log('Stay Route screen_60')}>
            <Svg width="24" height="24" fill="none" stroke="#ffffff" strokeWidth="2" viewBox="0 0 24 24">
              <Path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

          {/* Link 2: Chat Overlay */}
          <TouchableOpacity style={styles.tabButtonMuted} onPress={() => console.log('Route screen_61')}>
            <Svg width="24" height="24" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24">
              <Path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

          {/* Link 3: Setup Preferences */}
          <TouchableOpacity style={styles.tabButtonMuted} onPress={() => console.log('Route screen_67')}>
            <Svg width="24" height="24" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24">
              <Path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

        </View>
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
    justifyContent: 'between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#1f2024',
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBrandText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  avatarBorder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
  },
  profileThumbnail: {
    width: '100%',
    height: '100%',
  },
  scrollArea: {
    flex: 1,
  },
  scrollPadding: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 120,
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
  actionButtonGroupContainer: {
    marginTop: 16,
    gap: 12,
    width: '100%',
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
  dangerSecondaryButton: {
    backgroundColor: '#1a1b1e',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 16,
  },
  floatingTabsWrapper: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    zIndex: 70,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  navigationDockPill: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 9999,
    paddingHorizontal: 24,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  tabButtonMuted: {
    padding: 4,
  },
  tabBubbleActive: {
    backgroundColor: '#5c77ff',
    padding: 12,
    borderRadius: 9999,
    shadowColor: '#5c77ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
});