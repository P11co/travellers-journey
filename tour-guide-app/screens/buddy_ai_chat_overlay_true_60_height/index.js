import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  Dimensions 
} from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function BuddyAIChatOverlay() {
  const [cameraVisible, setCameraVisible] = useState(false);

  return (
    <View style={styles.deviceContainer}>
      
      {/* 1. IMMERSIVE MAP & BACKGROUND VECTOR LAYERS */}
      <View style={styles.backgroundContainer}>
        <View style={[styles.glowCircle, styles.circleTopRight]} />
        <View style={[styles.glowCircle, styles.circleMidLeft]} />
        <View style={[styles.glowCircle, styles.circleBottomRight]} />
        
        <Svg style={styles.svgFill} pointerEvents="none">
          <Line x1="0%" y1="20%" x2="100%" y2="40%" stroke="#5c77ff" strokeWidth="1" strokeDasharray="4 4" opacity="0.2" />
          <Line x1="0%" y1="80%" x2="100%" y2="60%" stroke="#5c77ff" strokeWidth="1" strokeDasharray="4 4" opacity="0.2" />
        </Svg>
      </View>

      {/* 2. CHAT OVERLAY INTERFACE SHEET (BOTTOM 60% SEGMENTATION) */}
      <View style={styles.sheetContainer}>
        
        {/* Swipe Handle Indicator Header */}
        <View style={styles.headerDraggerArea}>
          <View style={styles.swipeHandlePill} />
          
          {/* Integrated Horizontal Action Navigation Bar */}
          <View style={styles.navBarPill}>
            <TouchableOpacity style={styles.pillActionItem} onPress={() => console.log('Route to screen_14')}>
              <Svg width="24" height="24" fill="none" stroke="#a1a1aa" strokeWidth="2" viewBox="0 0 24 24">
                <Path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>

            <TouchableOpacity style={styles.centerPillIndicator} onPress={() => console.log('Route to screen_11')}>
              <Svg width="24" height="24" fill="none" stroke="#ffffff" strokeWidth="2" viewBox="0 0 24 24">
                <Path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pillActionItem} onPress={() => console.log('Route to screen_10')}>
              <Svg width="24" height="24" fill="none" stroke="#a1a1aa" strokeWidth="2" viewBox="0 0 24 24">
                <Path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Shell Intersects System (Chat Row Splitter) */}
        <View style={styles.horizontalSplitterFrame}>
          
          {/* Scrollable Chat Message Stack */}
          <ScrollView 
            style={styles.chatScrollArea} 
            contentContainerStyle={styles.scrollContentLayout}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.timeLabel}>TODAY 14:32</Text>

            {/* Buddy Message Unit 1 */}
            <View style={styles.buddyMessageBlock}>
              <View style={styles.avatarIconWrapper}>
                <Svg width="16" height="16" fill="#5c77ff" viewBox="0 0 20 20">
                  <Path fillRule="evenodd" clipRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" />
                </Svg>
              </View>
              <View style={styles.msgBuddyPill}>
                <Text style={styles.msgBuddyText}>
                  I noticed you're near the central district. The weather is clearing up. Want me to adjust the walking route to include the park?
                </Text>
              </View>
            </View>

            {/* User Message Unit 1 */}
            <View style={styles.userMessageBlock}>
              <View style={styles.msgUserPill}>
                <Text style={styles.msgUserText}>
                  Yes, let's do that. Is there a coffee shop on the way?
                </Text>
              </View>
            </View>

            {/* Buddy Message Unit 2 */}
            <View style={styles.buddyMessageBlockWithSubtext}>
              <View style={styles.buddyMessageBlock}>
                <View style={styles.avatarIconWrapper}>
                  <Svg width="16" height="16" fill="#5c77ff" viewBox="0 0 20 20">
                    <Path fillRule="evenodd" clipRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" />
                  </Svg>
                </View>
                <View style={styles.msgBuddyPill}>
                  <Text style={styles.msgBuddyText}>
                    I can see you're currently in the Gangnam-daero area. Are you looking for the nearest subway station or a specific recommendation for dinner?
                  </Text>
                </View>
              </View>
              <Text style={styles.leftLabelSubtext}>BUDDY • 14:02</Text>
            </View>

            {/* User Message Unit 2 with Floating Camera Viewfinder Intersection */}
            <View style={styles.userMessageBlockWithSubtext}>
              <View style={styles.userMessageBlock}>
                
                {/* FLOATING CAMERA VIEWFINDER OVERLAY DOCK */}
                {cameraVisible && (
                  <View style={styles.floatingCameraPortal}>
                    <View style={styles.liveIndicatorBadge}>
                      <View style={styles.redPulseDot} />
                      <Text style={styles.liveText}>LIVE</Text>
                    </View>
                    <View style={styles.scanlineLaserVertical} />
                    <Image 
                      source={{ uri: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=400' }} 
                      style={styles.imageAssetFill} 
                    />
                  </View>
                )}

                <View style={[styles.msgUserPill, cameraVisible && styles.adjustedPaddingRight]}>
                  <Text style={styles.msgUserText}>
                    I'm looking for a highly-rated BBQ spot nearby. Can you show me the way?
                  </Text>
                </View>
              </View>
              <Text style={styles.rightLabelSubtext}>YOU • 14:03</Text>
            </View>

          </ScrollView>

          {/* Right Modular Activity Controls HUD Sidebar Bar */}
          <View style={styles.rightActionSidebar}>
            <View style={styles.flexSpacer} />
            
            <TouchableOpacity 
              style={styles.sidebarButton} 
              onPress={() => setCameraVisible(!cameraVisible)}
            >
              <Svg width="24" height="24" fill="none" stroke={cameraVisible ? "#ffffff" : "#6b7280"} strokeWidth="2" viewBox="0 0 24 24">
                <Path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <Path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </Svg>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sidebarButton}>
              <Svg width="24" height="24" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24">
                <Path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </Svg>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sidebarButton}>
              <Svg width="24" height="24" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24">
                <Path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </Svg>
            </TouchableOpacity>
            
            <View style={styles.flexSpacer} />
          </View>
        </View>

      </View>

      {/* 3. FIXED BOTTOM CONTEXT INPUT ARCHITECTURE */}
      <View style={styles.inputDockContainer}>
        <View style={styles.inputFrameRow}>
          <TouchableOpacity style={styles.pillAttachmentButton}>
            <Svg width="20" height="20" fill="none" stroke="#5c77ff" strokeWidth="2" viewBox="0 0 24 24">
              <Path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </Svg>
          </TouchableOpacity>
          
          <TextInput 
            style={styles.textInputArea} 
            placeholder="Ask AI..." 
            placeholderTextColor="#6b7280"
            editable={true}
          />
          
          <TouchableOpacity style={styles.sendActionButton}>
            <Svg width="16" height="16" fill="none" stroke="#5c77ff" strokeWidth="2" viewBox="0 0 24 24">
              <Path d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </Svg>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity style={styles.contextSystemMenuLauncher}>
          <Svg width="20" height="20" fill="none" stroke="#ffffff" strokeWidth="2.5" viewBox="0 0 24 24">
            <Path d="M4 6h16M4 12h16M4 18h16" />
          </Svg>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  deviceContainer: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    opacity: 0.6,
  },
  svgFill: {
    ...StyleSheet.absoluteFillObject,
  },
  glowCircle: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(92, 119, 255, 0.3)',
  },
  circleTopRight: { top: -50, right: -100, width: 256, height: 256 },
  circleMidLeft: { top: '33%', left: -80, width: 224, height: 224 },
  circleBottomRight: { bottom: 40, right: -60, width: 192, height: 192 },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: screenHeight * 0.65, 
    backgroundColor: 'rgba(13, 13, 13, 0.95)',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    zIndex: 10,
    overflow: 'hidden',
  },
  headerDraggerArea: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 12,
    zIndex: 50,
  },
  swipeHandlePill: {
    width: 48,
    height: 6,
    backgroundColor: '#4b5563',
    borderRadius: 3,
    opacity: 0.8,
    marginBottom: 12,
  },
  navBarPill: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 9999,
    paddingHorizontal: 24,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
    marginBottom: -24,
    position: 'relative',
    zIndex: 55,
  },
  pillActionItem: {
    padding: 4,
  },
  centerPillIndicator: {
    backgroundColor: '#5c77ff',
    padding: 12,
    borderRadius: 9999,
    shadowColor: '#5c77ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  horizontalSplitterFrame: {
    flex: 1,
    flexDirection: 'row',
    paddingBottom: 80, 
  },
  chatScrollArea: {
    flex: 1,
  },
  scrollContentLayout: {
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  timeLabel: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 24,
  },
  buddyMessageBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 16,
    width: '100%',
  },
  buddyMessageBlockWithSubtext: {
    flexDirection: 'column',
    marginBottom: 24,
  },
  avatarIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  msgBuddyPill: {
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    padding: 16,
    maxWidth: '80%',
  },
  msgBuddyText: {
    color: '#e5e5e5',
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageBlock: {
    alignItems: 'flex-end',
    width: '100%',
    marginBottom: 4,
    position: 'relative',
  },
  userMessageBlockWithSubtext: {
    flexDirection: 'column',
    marginBottom: 24,
  },
  msgUserPill: {
    backgroundColor: '#5c77ff',
    borderRadius: 20,
    borderBottomRightRadius: 4,
    padding: 16,
    maxWidth: '80%',
  },
  adjustedPaddingRight: {
    marginRight: 40, 
  },
  msgUserText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
  },
  leftLabelSubtext: {
    fontSize: 10,
    color: '#5c77ff',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginLeft: 40,
  },
  rightLabelSubtext: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
    letterSpacing: 0.5,
    alignSelf: 'flex-end',
    marginRight: 8,
    marginTop: 4,
  },
  floatingCameraPortal: {
    position: 'absolute',
    top: -140,
    right: 0,
    width: 144,
    height: 192,
    borderRadius: 16,
    backgroundColor: '#111827',
    borderWidth: 2,
    borderColor: '#5c77ff',
    overflow: 'hidden',
    zIndex: 40,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
  },
  liveIndicatorBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 50,
  },
  redPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    marginRight: 4,
  },
  liveText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scanlineLaserVertical: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(92, 119, 255, 0.5)',
    zIndex: 45,
  },
  imageAssetFill: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  rightActionSidebar: {
    width: 56,
    backgroundColor: '#151515',
    borderLeftWidth: 1,
    borderColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  sidebarButton: {
    padding: 4,
  },
  flexSpacer: {
    flex: 1,
  },
  inputDockContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0d0d0d',
    borderTopWidth: 1,
    borderColor: '#333333',
    padding: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 60,
  },
  inputFrameRow: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pillAttachmentButton: {
    marginRight: 12,
  },
  textInputArea: {
    flex: 1,
    color: '#d1d5db',
    fontSize: 14,
    padding: 0,
  },
  sendActionButton: {
    marginLeft: 8,
    backgroundColor: '#1f1f1f',
    padding: 6,
    borderRadius: 8,
  },
  contextSystemMenuLauncher: {
    borderRadius: 9999,
    padding: 12,
    backgroundColor: '#5c77ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});