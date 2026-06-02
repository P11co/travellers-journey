import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Dimensions,
  Linking
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppStore from '../../src/store';
import TrioDock from '../../src/components/TrioDock';
import VisionCameraPanel from '../../src/components/VisionCameraPanel';
import { getTheme } from '../../src/theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function AIChatInterface({
  navigation,
  presentation = 'screen',
  panelMode = 'full',
  onChatPress,
  onItineraryPress,
  onSettingsPress,
  onOutsidePress,
}) {
  const insets = useSafeAreaInsets();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [inputText, setInputText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef(null);
  const inputRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const pendingInputFocusRef = useRef(false);
  const didLongPressMicRef = useRef(false);
  const micHoldActiveRef = useRef(false);
  const micRecordingStartedRef = useRef(false);
  const chatMessages = useAppStore((s) => s.chatMessages);
  const chatWaypointContext = useAppStore((s) => s.chatWaypointContext);
  const chatPhotoContext = useAppStore((s) => s.chatPhotoContext);
  const isChatLoading = useAppStore((s) => s.isChatLoading);
  const isRecording = useAppStore((s) => s.isRecording);
  const isTranscribing = useAppStore((s) => s.isTranscribing);
  const isSpeaking = useAppStore((s) => s.isSpeaking);
  const voiceModeEnabled = useAppStore((s) => s.voiceModeEnabled);
  const sendMessage = useAppStore((s) => s.sendMessage);
  const sendVisionMessage = useAppStore((s) => s.sendVisionMessage);
  const startVoiceRecording = useAppStore((s) => s.startVoiceRecording);
  const stopVoiceRecordingAndSend = useAppStore((s) => s.stopVoiceRecordingAndSend);
  const addAssistantNotice = useAppStore((s) => s.addAssistantNotice);
  const setVoiceModeEnabled = useAppStore((s) => s.setVoiceModeEnabled);
  const stopSpeaking = useAppStore((s) => s.stopSpeaking);
  const logTraceEvent = useAppStore((s) => s.logTraceEvent);
  const clearChatWaypointContext = useAppStore((s) => s.clearChatWaypointContext);
  const setChatPhotoContext = useAppStore((s) => s.setChatPhotoContext);
  const clearChatPhotoContext = useAppStore((s) => s.clearChatPhotoContext);
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = getTheme(themeMode);
  const hasStreamingMessage = chatMessages.some((message) => message.isStreaming);
  const isEmbedded = presentation === 'embedded';
  const isFullPanel = !isEmbedded || panelMode === 'full';

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates?.height || 0);
      isNearBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottom(true));
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!pendingInputFocusRef.current || !isEmbedded || !isFullPanel) {
      return undefined;
    }

    pendingInputFocusRef.current = false;
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 120);

    return () => clearTimeout(focusTimer);
  }, [isEmbedded, isFullPanel]);

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
    if (isChatLoading) return;
    if (!text && !chatPhotoContext) return;
    isNearBottomRef.current = true;
    setInputText('');
    try {
      if (chatPhotoContext) {
        const photo = chatPhotoContext;
        clearChatPhotoContext();
        await sendVisionMessage(
          photo.imageBase64,
          text || 'What is this?',
          {
            imageUri: photo.imageUri,
            imageMimeType: photo.imageMimeType,
          }
        );
      } else {
        await sendMessage(text);
      }
    } catch {
      // Store renders a friendly failure message.
    }
  };

  const handleOpenNaver = async (payload) => {
    if (!payload) return;

    logTraceEvent('naver_handoff_pressed', {
      has_app_url: Boolean(payload.naver_app_url),
      has_web_url: Boolean(payload.naver_web_url),
      place_name: payload.place_name,
    });

    try {
      if (payload.naver_app_url) {
        logTraceEvent('naver_handoff_app_open_attempted', { url_scheme: 'nmap' });
        await Linking.openURL(payload.naver_app_url);
        logTraceEvent('naver_handoff_app_opened', { url_scheme: 'nmap' });
        return;
      }
    } catch {
      logTraceEvent('naver_handoff_web_fallback', { reason: 'app_url_failed' });
      // Fall back to the web URL below.
    }

    if (payload.naver_web_url) {
      try {
        await Linking.openURL(payload.naver_web_url);
        logTraceEvent('naver_handoff_web_opened', { url_scheme: 'https' });
      } catch (error) {
        logTraceEvent('naver_handoff_failed', { error: error.message });
      }
    }
  };

  const handleCapturePhoto = async (imageBase64, imageUri) => {
    setChatPhotoContext({
      imageBase64,
      imageUri,
      imageMimeType: 'image/jpeg',
      attachedAt: new Date().toISOString(),
    });
    setCameraVisible(false);
  };

  const handleMicTap = async () => {
    if (didLongPressMicRef.current) {
      didLongPressMicRef.current = false;
      return;
    }
    if (isChatLoading || isTranscribing) return;

    Keyboard.dismiss();
    isNearBottomRef.current = true;
    await addAssistantNotice('Hold to talk.', {
      speak: true,
      eventType: 'voice_hold_instruction_prompted',
    });
  };

  const handleMicLongPress = async () => {
    if (isChatLoading || isTranscribing || isRecording) return;

    didLongPressMicRef.current = true;
    micHoldActiveRef.current = true;
    Keyboard.dismiss();

    const recording = await startVoiceRecording();
    micRecordingStartedRef.current = Boolean(recording);

    if (!micHoldActiveRef.current && micRecordingStartedRef.current) {
      micRecordingStartedRef.current = false;
      await stopVoiceRecordingAndSend();
    }
  };

  const handleMicPressOut = async () => {
    micHoldActiveRef.current = false;

    if (micRecordingStartedRef.current || isRecording) {
      micRecordingStartedRef.current = false;
      await stopVoiceRecordingAndSend();
    }

    setTimeout(() => {
      didLongPressMicRef.current = false;
    }, 300);
  };

  const handleSpeakerPress = () => {
    if (isSpeaking) {
      stopSpeaking();
      return;
    }
    setVoiceModeEnabled(!voiceModeEnabled);
  };

  const handleDockChatPress = () => {
    onOutsidePress?.();

    if (!isEmbedded) {
      (onChatPress || (() => navigation.goBack()))();
      return;
    }

    if (isFullPanel) {
      pendingInputFocusRef.current = false;
      Keyboard.dismiss();
      onChatPress?.();
      return;
    }

    pendingInputFocusRef.current = true;
    onChatPress?.();
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
          <View style={[styles.msgUserPill, { backgroundColor: theme.accent }]}>
            <Text style={styles.msgTextUser}>{message.content}</Text>
            {message.attachmentType === 'image' && message.attachmentUri ? (
              <Image
                source={{ uri: message.attachmentUri }}
                style={styles.userImageAttachment}
                resizeMode="cover"
              />
            ) : message.attachmentType === 'image' && (
              <Text style={styles.userAttachmentText}>Photo attached</Text>
            )}
            {message.contextWaypoint && (
              <Text style={styles.userAttachmentText}>Context: {message.contextWaypoint.name}</Text>
            )}
          </View>
          <Text style={styles.timestampSubtextRight}>YOU • {formatTimestamp(message.timestamp)}</Text>
        </View>
      );
    }

    return (
      <View key={message.id} style={styles.buddyMessageRow}>
        <View style={[styles.avatarContainer, { backgroundColor: theme.iconSurface, borderColor: theme.assistantBorder }]}>
          <Svg width="16" height="16" fill={theme.accent} viewBox="0 0 20 20">
            <Path fillRule="evenodd" clipRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" />
          </Svg>
        </View>
        <View style={styles.msgBuddyPillContainer}>
          <View style={[
            styles.msgBuddyPill,
            { backgroundColor: theme.assistantBubble, borderColor: theme.assistantBorder, shadowColor: theme.shadow },
            message.isError && [styles.errorBubble, { backgroundColor: themeMode === 'light' ? '#fef2f2' : '#2a1111' }],
          ]}>
            <Text style={[styles.msgTextBuddy, { color: theme.text }]}>{message.content}</Text>
            {message.action === 'OPEN_NAVER_MAP' && message.actionPayload && (
              <>
                <TouchableOpacity style={styles.naverButton} onPress={() => handleOpenNaver(message.actionPayload)}>
                  <Svg width="18" height="18" fill="#ffffff" viewBox="0 0 24 24" style={styles.naverIcon}>
                    <Path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" />
                  </Svg>
                  <Text style={styles.naverButtonText}>Open in Naver</Text>
                </TouchableOpacity>
                {message.actionPayload.handoff_type === 'search' && (
                  <Text style={[styles.naverLanguageNote, { color: theme.mutedText }]}>
                    Tip: set Naver Map to English before opening. Search results may still show Korean place names.
                  </Text>
                )}
              </>
            )}
          </View>
          <Text style={styles.timestampSubtextLeft}>BUDDY • {formatTimestamp(message.timestamp)}</Text>
        </View>
      </View>
    );
  };

  const keyboardLift = Math.max(0, keyboardHeight);
  const embeddedPanelLift = isEmbedded && !isFullPanel ? keyboardLift : 0;
  const shouldLiftInputForKeyboard = keyboardLift > 0 && (!isEmbedded || isFullPanel);
  const halfPanelTop = Math.round(screenHeight * 0.5);
  const halfPanelDockTopOffset = -insets.top - 38;
  const alignFullDockToLiftedHalfPanel = isEmbedded && isFullPanel && keyboardLift > 0;
  const dockTopOffset = alignFullDockToLiftedHalfPanel
    ? halfPanelTop - keyboardLift - insets.top - 38
    : (isEmbedded && !isFullPanel ? halfPanelDockTopOffset : 28);

  return (
    <View
      style={[
        styles.deviceWrapper,
        { backgroundColor: isEmbedded && !isFullPanel ? 'transparent' : theme.background },
        isEmbedded && styles.embeddedWrapper,
        isEmbedded && (isFullPanel ? styles.embeddedFullPanel : styles.embeddedHalfPanel),
        embeddedPanelLift > 0 && { transform: [{ translateY: -embeddedPanelLift }] },
      ]}
      pointerEvents={isEmbedded && !isFullPanel ? 'box-none' : 'auto'}
      onTouchStart={onOutsidePress}
    >
      {/* UNDERLAY: fills theme.background behind the rounded corners.
          Rendered FIRST (below all siblings) so it is always in paint order
          without relying on negative z-index, which falls behind the parent
          on iOS and causes the dark wedge artifact. */}
      {isEmbedded && !isFullPanel && (
        <View
          pointerEvents="none"
          style={[
            styles.roundedSheetUnderlay,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
        />
      )}

      {/* 1. IMMERSIVE GRADIENT & GRID BACKGROUND PATTERN */}
      <View
        style={[
          styles.backgroundContainer,
          isEmbedded && !isFullPanel && styles.embeddedRoundedBackground,
        ]}
        pointerEvents="none"
      >
        <View style={[styles.radialGlowOverlay, { backgroundColor: theme.background, opacity: themeMode === 'light' ? 1 : 0.95 }]} />
        <Svg style={[styles.gridOverlay, { opacity: themeMode === 'light' ? 0.12 : 0.25 }]} pointerEvents="none">
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
        topOffset={dockTopOffset}
        onItineraryPress={onItineraryPress}
        onChatPress={handleDockChatPress}
        onSettingsPress={onSettingsPress}
        style={isEmbedded && !isFullPanel ? styles.embeddedDockFrontLayer : null}
      />

      {/* 3. SCROLLABLE CORE CHAT WINDOW */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatScrollContainer}
        contentContainerStyle={[
          styles.chatContentPadding,
          isEmbedded && !isFullPanel && styles.embeddedHalfChatPadding,
          shouldLiftInputForKeyboard && { paddingBottom: keyboardLift + 120 },
        ]}
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="always"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
      >
        <Text style={[styles.dateStamp, { color: theme.subtleText }]}>TODAY</Text>
        {chatMessages.map(renderMessage)}
        {((isChatLoading && !hasStreamingMessage) || isTranscribing) && (
          <View style={styles.buddyMessageRow}>
            <View style={[styles.avatarContainer, { backgroundColor: theme.iconSurface, borderColor: theme.assistantBorder }]}>
              <ActivityIndicator color={theme.accent} size="small" />
            </View>
            <View style={[styles.msgBuddyPill, { backgroundColor: theme.assistantBubble, borderColor: theme.assistantBorder }]}>
              <Text style={[styles.msgTextBuddy, { color: theme.text }]}>
                {isTranscribing ? 'Transcribing voice...' : 'Thinking...'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* 4. CAMERA VIEWFINDER FLOATING LIVE-PANEL OVERLAY */}
      {cameraVisible && (
        <VisionCameraPanel
          style={[
            styles.cameraViewfinder,
            isEmbedded && !isFullPanel && { top: -halfPanelTop + insets.top + 72 }
          ]}
          onCapture={handleCapturePhoto}
          onClose={() => setCameraVisible(false)}
          disabled={isChatLoading}
        />
      )}

      {/* 5. FLOATING HUD FUNCTION SIDEBAR */}
      {sidebarVisible && (
        <View
          style={[
            styles.actionSidebar,
            { backgroundColor: theme.surface, shadowColor: theme.shadow },
            shouldLiftInputForKeyboard && { bottom: keyboardLift + 100 },
          ]}
        >
          <TouchableOpacity
            style={styles.sidebarActionButton}
            onPress={() => setCameraVisible(!cameraVisible)}
          >
            <Svg width="22" height="22" fill="none" stroke={cameraVisible ? "#5c77ff" : "#9ca3af"} strokeWidth="2" viewBox="0 0 24 24">
              <Path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <Path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sidebarActionButton, (voiceModeEnabled || isSpeaking) && styles.sidebarActionButtonActive]}
            onPress={handleSpeakerPress}
          >
            <Svg width="22" height="22" fill="none" stroke={(voiceModeEnabled || isSpeaking) ? '#ffffff' : '#9ca3af'} strokeWidth="2" viewBox="0 0 24 24">
              <Path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </Svg>
          </TouchableOpacity>
        </View>
      )}

      {/* 6. BOTTOM CONTEXT INPUT FOOTER BAR */}
      <View
        style={[
          styles.bottomDockInputBar,
          { backgroundColor: theme.background, borderColor: theme.border },
          shouldLiftInputForKeyboard && { transform: [{ translateY: -keyboardLift }] },
        ]}
      >
        {chatWaypointContext && (
          <View style={[styles.contextChip, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
            <Text style={[styles.contextChipText, { color: theme.accent }]} numberOfLines={1}>
              {chatWaypointContext.name} attached
            </Text>
            <TouchableOpacity style={styles.contextChipClose} onPress={clearChatWaypointContext}>
              <Text style={[styles.contextChipCloseText, { color: theme.accent }]}>x</Text>
            </TouchableOpacity>
          </View>
        )}

        {chatPhotoContext && (
          <View style={[styles.contextChip, { backgroundColor: theme.accentSoft, borderColor: theme.accent, marginTop: chatWaypointContext ? 6 : 0 }]}>
            <Text style={[styles.contextChipText, { color: theme.accent }]} numberOfLines={1}>
              Photo taken at {(() => {
                try {
                  const d = new Date(chatPhotoContext.attachedAt);
                  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                } catch {
                  return '';
                }
              })()} attached
            </Text>
            <TouchableOpacity style={styles.contextChipClose} onPress={clearChatPhotoContext}>
              <Text style={[styles.contextChipCloseText, { color: theme.accent }]}>x</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomInputRow}>
          <View style={[styles.inputFieldContainer, { backgroundColor: theme.input, borderColor: theme.assistantBorder }]}>
            <TouchableOpacity
              style={[
                styles.voiceInputButton,
                isRecording && [styles.voiceInputButtonActive, { backgroundColor: theme.accent }],
                (isChatLoading || isTranscribing) && styles.voiceInputButtonDisabled,
              ]}
              onPress={handleMicTap}
              onLongPress={handleMicLongPress}
              onPressOut={handleMicPressOut}
              delayLongPress={240}
              disabled={isChatLoading || isTranscribing}
              activeOpacity={0.78}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Svg width="24" height="24" fill="none" stroke={isRecording ? '#ffffff' : theme.accent} strokeWidth="2.3" viewBox="0 0 24 24">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </Svg>
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              style={[styles.textInputBox, { color: theme.text }]}
              placeholder="Ask AI..."
              placeholderTextColor={theme.subtleText}
              editable={true}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[
                styles.sendActionButton,
                { backgroundColor: theme.iconSurface },
                ((!inputText.trim() && !chatPhotoContext) || isChatLoading) && styles.sendActionButtonDisabled
              ]}
              onPress={handleSend}
              disabled={(!inputText.trim() && !chatPhotoContext) || isChatLoading}
            >
              <Svg width="14" height="14" fill="none" stroke={theme.accent} strokeWidth="2.5" viewBox="0 0 24 24">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Toggle Menu Toggle Launcher */}
          <TouchableOpacity
            style={[styles.menuDockToggle, { backgroundColor: theme.accent, shadowColor: theme.accent }]}
            onPress={() => setSidebarVisible(!sidebarVisible)}
          >
            <Svg width="20" height="20" fill="none" stroke="#ffffff" strokeWidth="2.5" viewBox="0 0 24 24">
              <Path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </Svg>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deviceWrapper: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  embeddedWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 90,
  },
  embeddedHalfPanel: {
    top: Math.round(screenHeight * 0.5),
    bottom: 0,
    overflow: 'visible',
    zIndex: 90,
    elevation: 20,
  },
  embeddedFullPanel: {
    top: 0,
    bottom: 0,
  },
  embeddedDockFrontLayer: {
    zIndex: 300,
    elevation: 60,
  },
  // Underlay that deterministically paints theme.background behind the rounded
  // top corners. No negative z-index — paint order handles the layering.
  roundedSheetUnderlay: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    // overflow:'hidden' clips the background to the rounded shape so the
    // corner pixels are always the panel colour, never the dark root.
    overflow: 'hidden',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    // No zIndex here — render order determines layering.
  },
  embeddedRoundedBackground: {
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    overflow: 'hidden',
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
    paddingBottom: 170,
    paddingHorizontal: 16,
  },
  embeddedHalfChatPadding: {
    paddingTop: 88,
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
  userImageAttachment: {
    width: '100%',
    height: 132,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
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
  naverLanguageNote: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 8,
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
    borderRadius: 10,
  },
  sidebarActionButtonActive: {
    backgroundColor: 'rgba(92, 119, 255, 0.28)',
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
    gap: 8,
    zIndex: 50,
  },
  bottomInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contextChip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(92, 119, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(92, 119, 255, 0.42)',
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 4,
  },
  contextChipText: {
    color: '#c7d2fe',
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 1,
  },
  contextChipClose: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  contextChipCloseText: {
    color: '#c7d2fe',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
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
  voiceInputButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  voiceInputButtonActive: {
    shadowColor: '#5c77ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  voiceInputButtonDisabled: {
    opacity: 0.45,
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
