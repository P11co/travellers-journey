import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Path, Circle } from 'react-native-svg';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function ARMapNavigationView() {
  return (
    <View style={styles.container}>
      
      {/* 1. MAP BACKGROUND PATTERN (REPLACING WEB TAILWIND GRID) */}
      <View style={styles.backgroundContainer}>
        {/* Decorative Glowing Vector Circles */}
        <View style={[styles.glowCircle, styles.circleTopRight]} />
        <View style={[styles.glowCircle, styles.circleMidLeft]} />
        <View style={[styles.glowCircle, styles.circleBottomRight]} />
        
        {/* Simulated Perspective Grid Lines via Mobile Svg */}
        <Svg style={styles.svgOverlay} pointerEvents="none">
          <Line x1="0%" y1="20%" x2="100%" y2="40%" stroke="#5c77ff" strokeWidth="1" strokeDasharray="4 4" opacity="0.2" />
          <Line x1="0%" y1="80%" x2="100%" y2="60%" stroke="#5c77ff" strokeWidth="1" strokeDasharray="4 4" opacity="0.2" />
        </Svg>
      </View>

      {/* 2. TOP ALERT NOTIFICATION */}
      <View style={styles.topNotificationContainer}>
        <View style={styles.notificationPanel}>
          {/* Eye Icon Container */}
          <View style={styles.iconContainer}>
            <Svg width="24" height="24" fill="none" stroke="#8ca1ff" strokeWidth="1.5" viewBox="0 0 24 24">
              <Path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <Path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </Svg>
          </View>
          {/* Text Descriptions */}
          <View style={styles.textContainer}>
            <Text style={styles.notificationTitle}>Watch your step</Text>
            <Text style={styles.notificationSubtitle}>Approaching uneven terrain.</Text>
          </View>
        </View>
      </View>

      {/* 3. CURRENT LOCATION RADAR MARKER */}
      <View style={styles.markerContainer}>
        <View style={styles.radarRing}>
          <Svg width="32" height="32" viewBox="0 0 20 20" fill="#8ca1ff" style={styles.pinShadow}>
            <Path fillRule="evenodd" clipRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" />
          </Svg>
        </View>
        {/* Label Location Pill */}
        <View style={styles.labelPill}>
          <View style={styles.pulseDot} />
          <Text style={styles.pillText}>CURRENT LOCATION</Text>
        </View>
      </View>

      {/* 4. BOTTOM ACTION HUD BAR */}
      <View style={styles.bottomNavWrapper}>
        <View style={styles.navBar}>
          {/* Left Action: Calendar/Events Router */}
          <TouchableOpacity style={styles.navButton} onPress={() => console.log('navigate to screen_14')}>
            <Svg width="24" height="24" fill="none" stroke="#a1a1aa" strokeWidth="1.5" viewBox="0 0 24 24">
              <Path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </Svg>
          </TouchableOpacity>

          {/* Center Primary Action Bubble: Chat Router */}
          <View style={styles.centerButtonContainer}>
            <TouchableOpacity style={styles.primaryActionButton} onPress={() => console.log('navigate to screen_48')}>
              <Svg width="32" height="32" fill="#ffffff" viewBox="0 0 20 20">
                <Path fillRule="evenodd" clipRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Right Action: Settings Router */}
          <TouchableOpacity style={styles.navButton} onPress={() => console.log('navigate to screen_10')}>
            <Svg width="24" height="24" fill="none" stroke="#a1a1aa" strokeWidth="1.5" viewBox="0 0 24 24">
              <Path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <Path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
    backgroundColor: '#0f0f13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    opacity: 0.6,
  },
  svgOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  glowCircle: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(92, 119, 255, 0.3)',
    backgroundColor: 'transparent',
  },
  circleTopRight: {
    top: -50,
    right: -100,
    width: 256,
    height: 256,
  },
  circleMidLeft: {
    top: '33%',
    left: -80,
    width: 224,
    height: 224,
  },
  circleBottomRight: {
    bottom: 40,
    right: -60,
    width: 192,
    height: 192,
  },
  topNotificationContainer: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    zIndex: 20,
    alignItems: 'center',
  },
  notificationPanel: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(92, 119, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(92, 119, 255, 0.2)',
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  notificationSubtitle: {
    fontSize: 12,
    color: '#a1a1aa',
    marginTop: 2,
  },
  markerContainer: {
    position: 'absolute',
    top: screenHeight / 2 - 60,
    zIndex: 10,
    alignItems: 'center',
  },
  radarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(92, 119, 255, 0.4)',
    backgroundColor: 'rgba(92, 119, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinShadow: {
    shadowColor: '#5c77ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  labelPill: {
    marginTop: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 9999,
    paddingVertical: 6,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 40,
    backgroundColor: '#8ca1ff',
    marginRight: 8,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#e4e4e7',
    letterSpacing: 1,
  },
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    zIndex: 30,
    alignItems: 'center',
  },
  navBar: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(24, 24, 27, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 10,
  },
  navButton: {
    padding: 12,
  },
  centerButtonContainer: {
    position: 'relative',
    top: -12,
  },
  primaryActionButton: {
    width: 64,
    height: 64,
    backgroundColor: '#5c77ff',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5c77ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 4,
    borderColor: '#0f0f13',
  },
});