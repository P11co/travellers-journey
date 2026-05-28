import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Dimensions,
  Image,
  Linking
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import useAppStore from '../../src/store';
import TrioDock from '../../src/components/TrioDock';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function AIChatInterface({ navigation }) {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const chatMessages = useAppStore((s) => s.chatMessages);
  const isChatLoading = useAppStore((s) => s.isChatLoading);
  const sendMessage = useAppStore((s) => s.sendMessage);

  const scrollToBottom = (animated = true) => {
    scrollViewRef.current?.scrollToEnd({ animated });
  };

  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
    isNearBottomRef.current = distanceFromBottom < 80;
  };

  const handleContentSizeChange = () => {
    if (isNearBottomRef.current) {
      scrollToBottom(true);
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isChatLoading) return;
    isNearBottomRef.current = true;
    setInputText('');
    try {
      await sendMessage(text);
    } catch {
      // Store renders a friendly failure message.
    }
  };

  const handleOpenNaver = async (payload) => {
    if (!payload) return;

    try {
      if (payload.naver_app_url) {
        await Linking.openURL(payload.naver_app_url);
        return;
      }
    } catch {
      // Fall back to the web URL below.
    }

    if (payload.naver_web_url) {
      await Linking.openURL(payload.naver_web_url);
    }
  };

  const formatTimestamp = (value) => {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = (message) => {
    if (message.role === 'user') {
      return (
        <View key={message.id} style={styles.userMessageRow}>
          <View style={styles.msgUserPill}>
            <Text style={styles.msgTextUser}>{message.content}</Text>
            {message.attachmentType === 'image' && (
              <Text style={styles.userAttachmentText}>Photo attached</Text>
            )}
          </View>
          <Text style={styles.timestampSubtextRight}>YOU • {formatTimestamp(message.timestamp)}</Text>
        </View>
      );
    }

    return (
      <View key={message.id} style={styles.buddyMessageRow}>
        <View style={styles.avatarContainer}>
          <Svg width="16" height="16" fill="#5c77ff" viewBox="0 0 20 20">
            <Path fillRule="evenodd" clipRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" />
          </Svg>
        </View>
        <View style={styles.msgBuddyPillContainer}>
          <View style={[styles.msgBuddyPill, message.isError && styles.errorBubble]}>
            <Text style={styles.msgTextBuddy}>{message.content}</Text>
            {message.action === 'OPEN_NAVER_MAP' && message.actionPayload && (
              <TouchableOpacity style={styles.naverButton} onPress={() => handleOpenNaver(message.actionPayload)}>
                <Svg width="18" height="18" fill="#ffffff" viewBox="0 0 24 24" style={styles.naverIcon}>
                  <Path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" />
                </Svg>
                <Text style={styles.naverButtonText}>Open in Naver</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.timestampSubtextLeft}>BUDDY • {formatTimestamp(message.timestamp)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.deviceWrapper}>
      {/* 1. IMMERSIVE GRADIENT & GRID BACKGROUND PATTERN */}
      <View style={styles.backgroundContainer}>
        <View style={styles.radialGlowOverlay} />
        <Svg style={styles.gridOverlay} pointerEvents="none">
          {/* Custom Matrix Grid Emulation */}
          {Array.from({ length: 15 }).map((_, i) => (
            <Line key={`h-${i}`} x1="0" y1={i * 60} x2={screenWidth} y2={i * 60} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <Line key={`v-${i}`} x1={i * 50} y1="0" x2={i * 50} y2={screenHeight} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          ))}
        </Svg>
      </View>

      <TrioDock
        navigation={navigation}
        activeKey="chat"
        placement="top"
        topOffset={28}
        onChatPress={() => navigation.goBack()}
      />

      {/* 3. SCROLLABLE CORE CHAT WINDOW */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatScrollContainer}
        contentContainerStyle={styles.chatContentPadding}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
      >
        <Text style={styles.dateStamp}>TODAY</Text>
        {chatMessages.map(renderMessage)}
        {isChatLoading && (
          <View style={styles.buddyMessageRow}>
            <View style={styles.avatarContainer}>
              <ActivityIndicator color="#5c77ff" size="small" />
            </View>
            <View style={styles.msgBuddyPill}>
              <Text style={styles.msgTextBuddy}>Typing...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* 4. CAMERA VIEWFINDER FLOATING LIVE-PANEL OVERLAY */}
      {cameraVisible && (
        <View style={styles.cameraViewfinder}>
          {/* Custom Layout Framing Corner Brackets */}
          <View style={[styles.focusBracket, styles.bracketTL]} />
          <View style={[styles.focusBracket, styles.bracketTR]} />
          <View style={[styles.focusBracket, styles.bracketBL]} />
          <View style={[styles.focusBracket, styles.bracketBR]} />

          <View style={styles.liveTagBadge}>
            <View style={styles.redPulseDot} />
            <Text style={styles.liveTagText}>LIVE</Text>
          </View>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=400' }}
            style={styles.povCameraFrame}
          />
        </View>
      )}

      {/* 5. FLOATING HUD FUNCTION SIDEBAR */}
      {sidebarVisible && (
        <View style={styles.actionSidebar}>
          <TouchableOpacity
            style={styles.sidebarActionButton}
            onPress={() => setCameraVisible(!cameraVisible)}
          >
            <Svg width="22" height="22" fill="none" stroke={cameraVisible ? "#5c77ff" : "#9ca3af"} strokeWidth="2" viewBox="0 0 24 24">
              <Path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <Path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sidebarActionButton}>
            <Svg width="22" height="22" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24">
              <Path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sidebarActionButton}>
            <Svg width="22" height="22" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24">
              <Path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </Svg>
          </TouchableOpacity>
        </View>
      )}

      {/* 6. BOTTOM CONTEXT INPUT FOOTER BAR */}
      <View style={styles.bottomDockInputBar}>
        <View style={styles.inputFieldContainer}>
          <TouchableOpacity style={styles.audioAttachButton}>
            <Svg width="20" height="20" fill="none" stroke="#5c77ff" strokeWidth="2" viewBox="0 0 24 24">
              <Path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </Svg>
          </TouchableOpacity>
          <TextInput
            style={styles.textInputBox}
            placeholder="Ask AI..."
            placeholderTextColor="#4b5563"
            editable={true}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendActionButton, (!inputText.trim() || isChatLoading) && styles.sendActionButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isChatLoading}
          >
            <Svg width="14" height="14" fill="none" stroke="#5c77ff" strokeWidth="2.5" viewBox="0 0 24 24">
              <Path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Toggle Menu Toggle Launcher */}
        <TouchableOpacity
          style={styles.menuDockToggle}
          onPress={() => setSidebarVisible(!sidebarVisible)}
        >
          <Svg width="20" height="20" fill="none" stroke="#ffffff" strokeWidth="2.5" viewBox="0 0 24 24">
            <Path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </Svg>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deviceWrapper: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  radialGlowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d0d0d',
    opacity: 0.95,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.25,
  },
  chatScrollContainer: {
    flex: 1,
  },
  chatContentPadding: {
    paddingTop: 130,
    paddingBottom: 140,
    paddingHorizontal: 16,
  },
  dateStamp: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 24,
  },
  buddyMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 24,
    width: '100%',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  msgBuddyPillContainer: {
    flexDirection: 'column',
    maxWidth: '85%',
  },
  msgBuddyPill: {
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  errorBubble: {
    borderColor: '#7f1d1d',
    backgroundColor: '#2a1111',
  },
  msgTextBuddy: {
    color: '#e5e5e5',
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageRow: {
    alignItems: 'flex-end',
    marginBottom: 24,
    width: '100%',
  },
  msgUserPill: {
    backgroundColor: '#5c77ff',
    borderRadius: 20,
    borderBottomRightRadius: 4,
    padding: 16,
    maxWidth: '85%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  msgTextUser: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  userAttachmentText: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  naverButton: {
    backgroundColor: '#00c73c',
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 16,
    shadowColor: '#00c73c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  naverIcon: {
    marginRight: 8,
  },
  naverButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  timestampSubtextLeft: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 4,
    marginLeft: 4,
  },
  timestampSubtextRight: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 4,
    marginRight: 4,
  },
  actionSidebar: {
    position: 'absolute',
    bottom: 100,
    right: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 12,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    zIndex: 60,
  },
  sidebarActionButton: {
    padding: 4,
  },
  cameraViewfinder: {
    position: 'absolute',
    top: 116,
    right: 16,
    width: 160,
    height: 224,
    borderRadius: 16,
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#5c77ff',
    overflow: 'hidden',
    zIndex: 40,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  povCameraFrame: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  focusBracket: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1.5,
    zIndex: 45,
  },
  bracketTL: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0 },
  bracketTR: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0 },
  bracketBL: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0 },
  bracketBR: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0 },
  liveTagBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 46,
  },
  redPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    marginRight: 4,
  },
  liveTagText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bottomDockInputBar: {
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
    zIndex: 50,
  },
  inputFieldContainer: {
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
  audioAttachButton: {
    marginRight: 12,
  },
  textInputBox: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    padding: 0,
  },
  sendActionButton: {
    marginLeft: 8,
    backgroundColor: '#1f1f1f',
    padding: 6,
    borderRadius: 8,
  },
  sendActionButtonDisabled: {
    opacity: 0.45,
  },
  menuDockToggle: {
    borderRadius: 9999,
    padding: 12,
    backgroundColor: '#5c77ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5c77ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
