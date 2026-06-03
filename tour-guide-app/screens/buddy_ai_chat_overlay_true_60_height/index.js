import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  LayoutAnimation,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppStore from '../../src/store';
import VisionCameraPanel from '../../src/components/VisionCameraPanel';
import VisionImageDiagnostics from '../../src/components/VisionImageDiagnostics';
import { getTheme } from '../../src/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const HANDLE_H = 40;

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const animConfig = {
  duration: 280,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
};

export default function BuddyAIChatOverlay({
  navigation,
  bottomOffset = 108,
  sheetMode = 'folded',
  onSheetModeChange,
}) {
  const insets = useSafeAreaInsets();
  const [cameraVisible, setCameraVisible] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [inputText, setInputText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [localMode, setLocalMode] = useState(sheetMode);
  const [expandedDeveloperTraces, setExpandedDeveloperTraces] = useState({});
  const [imageLoadErrors, setImageLoadErrors] = useState({});
  const prevPropMode = useRef(sheetMode);
  const scrollViewRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const chatMessages = useAppStore((s) => s.chatMessages);
  const chatWaypointContext = useAppStore((s) => s.chatWaypointContext);
  const chatPhotoContext = useAppStore((s) => s.chatPhotoContext);
  const isChatLoading = useAppStore((s) => s.isChatLoading);
  const chatStreamStatus = useAppStore((s) => s.chatStreamStatus);
  const isRecording = useAppStore((s) => s.isRecording);
  const isTranscribing = useAppStore((s) => s.isTranscribing);
  const isSpeaking = useAppStore((s) => s.isSpeaking);
  const voiceModeEnabled = useAppStore((s) => s.voiceModeEnabled);
  const sendMessage = useAppStore((s) => s.sendMessage);
  const sendVisionMessage = useAppStore((s) => s.sendVisionMessage);
  const startVoiceRecording = useAppStore((s) => s.startVoiceRecording);
  const stopVoiceRecordingAndSend = useAppStore((s) => s.stopVoiceRecordingAndSend);
  const setVoiceModeEnabled = useAppStore((s) => s.setVoiceModeEnabled);
  const stopSpeaking = useAppStore((s) => s.stopSpeaking);
  const logTraceEvent = useAppStore((s) => s.logTraceEvent);
  const clearChatWaypointContext = useAppStore((s) => s.clearChatWaypointContext);
  const setChatPhotoContext = useAppStore((s) => s.setChatPhotoContext);
  const clearChatPhotoContext = useAppStore((s) => s.clearChatPhotoContext);
  const themeMode = useAppStore((s) => s.themeMode);
  const developerModeEnabled = useAppStore((s) => s.developerModeEnabled);
  const theme = getTheme(themeMode);
  const hasStreamingMessage = chatMessages.some((message) => message.isStreaming);

  const halfH = Math.round(SCREEN_HEIGHT * 0.5);

  const heightFor = (mode) => {
    if (mode === 'full') return SCREEN_HEIGHT;
    if (mode === 'half') return halfH;
    return HANDLE_H;
  };

  // Sync with parent prop changes
  useEffect(() => {
    if (sheetMode !== prevPropMode.current) {
      prevPropMode.current = sheetMode;
      console.log('[Overlay] Parent changed mode to:', sheetMode, 'height:', heightFor(sheetMode));
      LayoutAnimation.configureNext(animConfig);
      setLocalMode(sheetMode);
    }
  }, [sheetMode]);

  useEffect(() => {
    if (localMode === 'folded') return undefined;

    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 80);

    return () => clearTimeout(timer);
  }, [localMode]);

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

  const handleHandleTap = () => {
    const modes = ['folded', 'half', 'full'];
    const curIdx = modes.indexOf(localMode);
    const nextMode = modes[(curIdx + 1) % 3];
    console.log('[Overlay] Handle tapped, cycling to:', nextMode);
    prevPropMode.current = nextMode;
    LayoutAnimation.configureNext(animConfig);
    setLocalMode(nextMode);
    onSheetModeChange?.(nextMode);
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
      // Fall back to web URL.
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

  const handleCapturePhoto = async (imageBase64, imageUri, imageMimeType = 'image/jpeg') => {
    setChatPhotoContext({
      imageBase64,
      imageUri,
      imageMimeType,
      attachedAt: new Date().toISOString(),
    });
    setCameraVisible(false);
  };

  const handleMicPress = async () => {
    if (isRecording) {
      await stopVoiceRecordingAndSend();
      return;
    }
    await startVoiceRecording();
  };

  const handleSpeakerPress = () => {
    if (isSpeaking) {
      stopSpeaking();
      return;
    }
    setVoiceModeEnabled(!voiceModeEnabled);
  };

  const formatModelPill = (modelTrace) => [
    modelTrace.model || modelTrace.label || 'Model',
    modelTrace.latency_ms ? `${modelTrace.latency_ms}ms` : null,
    modelTrace.tokens_per_second ? `${modelTrace.tokens_per_second} tok/s` : null,
    modelTrace.usage?.prompt_tokens ? `input ${modelTrace.usage.prompt_tokens}` : null,
    modelTrace.usage?.completion_tokens ? `output ${modelTrace.usage.completion_tokens}` : null,
    modelTrace.provider ? `provider ${modelTrace.provider}` : null,
    modelTrace.fallback_used ? 'fallback' : null,
  ].filter(Boolean).join(' • ');

  const renderDeveloperTrace = (message) => {
    if (!developerModeEnabled || !message.developerTrace) return null;
    const isExpanded = Boolean(expandedDeveloperTraces[message.id]);
    const models = Array.isArray(message.developerTrace.models) ? message.developerTrace.models : [];
    const timeline = Array.isArray(message.developerTrace.timeline) ? message.developerTrace.timeline : [];

    return (
      <View style={styles.developerTraceBlock}>
        {models.length > 0 && (
          <View style={styles.developerPillRow}>
            {models.map((modelTrace, index) => (
              <View
                key={`${message.id}-model-${index}`}
                style={[styles.developerPill, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}
              >
                <Text style={[styles.developerPillText, { color: theme.accent }]}>{formatModelPill(modelTrace)}</Text>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity
          style={[styles.developerToggleRow, { borderColor: theme.border }]}
          onPress={() => setExpandedDeveloperTraces((current) => ({
            ...current,
            [message.id]: !current[message.id],
          }))}
        >
          <Text style={[styles.developerToggleText, { color: theme.mutedText }]}>
            {isExpanded ? 'v' : '>'} Developer trace
          </Text>
        </TouchableOpacity>
        {isExpanded && (
          <View style={[styles.developerTimeline, { borderColor: theme.border, backgroundColor: themeMode === 'light' ? '#f8fafc' : '#111114' }]}>
            {timeline.map((step, index) => (
              <View key={`${message.id}-trace-${index}`} style={styles.developerTimelineStep}>
                <Text style={[styles.developerTimelineTitle, { color: theme.text }]}>{step.title || step.kind || `Step ${index + 1}`}</Text>
                <Text style={[styles.developerTimelinePayload, { color: theme.mutedText }]}>
                  {JSON.stringify(step.payload || {}, null, 2)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderMessage = (message) => {
    if (message.role === 'user') {
      const imageLoadError = imageLoadErrors[message.id];

      return (
        <View key={message.id} style={styles.userRow}>
          <View style={[styles.userBubble, { backgroundColor: theme.accent }]}>
            <Text style={styles.userText}>{message.content}</Text>
            {message.attachmentType === 'image' && message.attachmentUri ? (
              <Image
                source={{ uri: message.attachmentUri }}
                style={styles.userImageAttachment}
                resizeMode="cover"
                onError={(event) => {
                  const error = event.nativeEvent?.error || 'Image preview failed to load.';
                  setImageLoadErrors((current) => ({ ...current, [message.id]: error }));
                  logTraceEvent('vision_preview_image_load_failed', {
                    message_id: message.id,
                    error,
                    attachment_mime_type: message.attachmentMimeType || null,
                    attachment_uri_prefix: String(message.attachmentUri || '').slice(0, 80),
                  });
                }}
              />
            ) : message.attachmentType === 'image' && (
              <Text style={styles.userAttachmentText}>Photo attached</Text>
            )}
            {developerModeEnabled && imageLoadError && (
              <Text style={styles.userImageDebugText}>Image preview error: {imageLoadError}</Text>
            )}
            {developerModeEnabled && message.attachmentType === 'image' && (
              <VisionImageDiagnostics
                uri={message.attachmentUri}
                mimeType={message.attachmentMimeType}
                messageId={message.id}
              />
            )}
            {message.contextWaypoint && (
              <Text style={styles.userAttachmentText}>Context: {message.contextWaypoint.name}</Text>
            )}
          </View>
        </View>
      );
    }

    return (
      <View key={message.id} style={styles.buddyRow}>
        <View style={[styles.avatar, { backgroundColor: theme.iconSurface, borderColor: theme.assistantBorder }]}>
          <Svg width="16" height="16" fill={theme.accent} viewBox="0 0 20 20">
            <Path fillRule="evenodd" clipRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" />
          </Svg>
        </View>
        <View style={styles.buddyContent}>
          <View style={[
            styles.buddyBubble,
            { backgroundColor: theme.assistantBubble, borderColor: theme.assistantBorder },
            message.isError && [styles.errorBubble, { backgroundColor: themeMode === 'light' ? '#fef2f2' : '#2a1111' }],
          ]}>
            <Text style={[styles.buddyText, { color: theme.text }]}>{message.content}</Text>
            {message.action === 'OPEN_NAVER_MAP' && message.actionPayload && (
              <>
                <TouchableOpacity style={styles.naverButton} onPress={() => handleOpenNaver(message.actionPayload)}>
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
          {renderDeveloperTrace(message)}
        </View>
      </View>
    );
  };

  const currentHeight = heightFor(localMode);
  const isExpanded = localMode !== 'folded';
  const isFullScreen = localMode === 'full';
  const keyboardLift = Math.max(0, keyboardHeight - (isFullScreen ? 0 : bottomOffset));

  return (
    <View style={styles.root} pointerEvents="box-none">

      {/* Camera viewfinder — top-right corner */}
      {cameraVisible && (
        <VisionCameraPanel
          onCapture={handleCapturePhoto}
          onClose={() => setCameraVisible(false)}
          disabled={isChatLoading}
        />
      )}

      {isExpanded && (
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.background, shadowColor: theme.shadow },
            isFullScreen
              ? [styles.fullscreenSheet, { paddingTop: insets.top }]
              : { height: currentHeight, bottom: bottomOffset },
          ]}
        >
          <TouchableOpacity
            style={[styles.handleStrip, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
            onPress={handleHandleTap}
            activeOpacity={0.7}
          >
            <View style={styles.pill} />
          </TouchableOpacity>

          <View style={[styles.content, { backgroundColor: theme.background }]}>
            <View style={styles.row}>

              {/* Messages */}
              <ScrollView
                ref={scrollViewRef}
                style={styles.scroll}
                contentContainerStyle={[
                  styles.scrollContent,
                  keyboardLift > 0 && { paddingBottom: keyboardLift + 20 },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardDismissMode="none"
                keyboardShouldPersistTaps="always"
                scrollEventThrottle={16}
                onScroll={handleScroll}
                onContentSizeChange={handleContentSizeChange}
              >
                <Text style={[styles.timeLabel, { color: theme.subtleText }]}>TODAY</Text>
                {chatMessages.map(renderMessage)}
                {((isChatLoading && !hasStreamingMessage) || isTranscribing) && (
                  <View style={styles.buddyRow}>
                    <View style={[styles.avatar, { backgroundColor: theme.iconSurface, borderColor: theme.assistantBorder }]}>
                      <ActivityIndicator color={theme.accent} size="small" />
                    </View>
                    <View style={[styles.buddyBubble, { backgroundColor: theme.assistantBubble, borderColor: theme.assistantBorder }]}>
                      <Text style={[styles.buddyText, { color: theme.text }]}>
                        {isTranscribing ? 'Transcribing voice...' : (chatStreamStatus || 'Thinking...')}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Right sidebar for media controls */}
              {sidebarVisible && (
                <View style={[styles.sidebar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TouchableOpacity
                    style={[styles.sideBtn, cameraVisible && styles.sideBtnActive]}
                    onPress={() => setCameraVisible(!cameraVisible)}
                  >
                    <Svg width="22" height="22" fill="none" stroke={cameraVisible ? '#fff' : theme.mutedText} strokeWidth="2" viewBox="0 0 24 24">
                      <Path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <Path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </Svg>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sideBtn, isRecording && styles.sideBtnActive]}
                    onPress={handleMicPress}
                    disabled={isTranscribing}
                  >
                    <Svg width="22" height="22" fill="none" stroke={isRecording ? '#fff' : theme.mutedText} strokeWidth="2" viewBox="0 0 24 24">
                      <Path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </Svg>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sideBtn, (voiceModeEnabled || isSpeaking) && styles.sideBtnActive]}
                    onPress={handleSpeakerPress}
                  >
                    <Svg width="22" height="22" fill="none" stroke={(voiceModeEnabled || isSpeaking) ? '#fff' : theme.mutedText} strokeWidth="2" viewBox="0 0 24 24">
                      <Path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </Svg>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Input bar */}
            <View
              style={[
                styles.inputBar,
                { backgroundColor: theme.background, borderColor: theme.border },
                isFullScreen && { paddingBottom: insets.bottom + 10 },
                keyboardLift > 0 && { transform: [{ translateY: -keyboardLift }] },
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
              <View style={styles.inputRow}>
                <View style={[styles.inputInner, { backgroundColor: theme.input, borderColor: theme.assistantBorder }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Ask Buddy AI..."
                    placeholderTextColor={theme.subtleText}
                    editable
                    value={inputText}
                    onChangeText={setInputText}
                    onSubmitEditing={handleSend}
                    returnKeyType="send"
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendBtn,
                      ((!inputText.trim() && !chatPhotoContext) || isChatLoading) && styles.sendBtnDisabled
                    ]}
                    onPress={handleSend}
                    disabled={(!inputText.trim() && !chatPhotoContext) || isChatLoading}
                  >
                    <Svg width="16" height="16" fill="none" stroke={theme.accent} strokeWidth="2.5" viewBox="0 0 24 24">
                      <Path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </Svg>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.menuBtn, { backgroundColor: theme.accent }, sidebarVisible && styles.menuBtnActive]}
                  onPress={() => setSidebarVisible(!sidebarVisible)}
                >
                  <Svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24">
                    <Path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
                  </Svg>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
  },
  // Camera
  camera: {
    position: 'absolute',
    top: 190,
    right: 16,
    width: 120,
    height: 160,
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 2,
    borderColor: '#5c77ff',
    overflow: 'hidden',
    zIndex: 210,
  },
  liveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444', marginRight: 4 },
  liveText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  cameraImg: { width: '100%', height: '100%', opacity: 0.85 },
  // Sheet
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#0d0d12',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    zIndex: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 20,
  },
  fullscreenSheet: {
    top: 0,
    bottom: 0,
    height: undefined,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  // Handle
  handleStrip: {
    height: HANDLE_H,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28, 28, 35, 0.98)',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  pill: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#5c77ff',
    shadowColor: '#5c77ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  // Content
  content: {
    flex: 1,
    backgroundColor: 'rgba(15, 15, 20, 0.98)',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  timeLabel: {
    textAlign: 'center',
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  buddyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2d2d44',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  buddyContent: {
    maxWidth: '78%',
  },
  buddyBubble: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2d2d44',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 12,
    maxWidth: '100%',
  },
  errorBubble: {
    borderColor: '#7f1d1d',
    backgroundColor: '#2a1111',
  },
  buddyText: { color: '#e2e8f0', fontSize: 13, lineHeight: 19 },
  developerTraceBlock: {
    marginTop: 8,
    maxWidth: '100%',
  },
  developerPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  developerPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
    maxWidth: '100%',
  },
  developerPillText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  developerToggleRow: {
    borderTopWidth: 1,
    paddingTop: 6,
  },
  developerToggleText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  developerTimeline: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 6,
    padding: 8,
    gap: 8,
  },
  developerTimelineStep: {
    gap: 3,
  },
  developerTimelineTitle: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  developerTimelinePayload: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: 'Courier',
  },
  naverButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#00c73c',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  naverButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  naverLanguageNote: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: 6,
    maxWidth: 220,
  },
  userRow: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: '#5c77ff',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    padding: 12,
    maxWidth: '78%',
  },
  userText: { color: '#fff', fontSize: 13, lineHeight: 19 },
  userAttachmentText: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  userImageAttachment: {
    width: 260,
    aspectRatio: 4 / 3,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  userImageDebugText: {
    color: 'rgba(255, 255, 255, 0.86)',
    fontSize: 10,
    fontFamily: 'Courier',
    lineHeight: 14,
    marginTop: 6,
  },
  // Sidebar
  sidebar: {
    width: 52,
    backgroundColor: '#111118',
    borderLeftWidth: 1,
    borderColor: '#1f1f2e',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 12,
  },
  sideBtn: { padding: 6, borderRadius: 10 },
  sideBtnActive: { backgroundColor: 'rgba(92,119,255,0.25)' },
  // Input
  inputBar: {
    gap: 8,
    backgroundColor: '#0d0d12',
    borderTopWidth: 1,
    borderColor: '#1f1f2e',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  inputInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2d2d44',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  input: { flex: 1, color: '#cbd5e1', fontSize: 14 },
  sendBtn: { marginLeft: 8, padding: 4 },
  sendBtnDisabled: { opacity: 0.45 },
  menuBtn: {
    padding: 11,
    borderRadius: 999,
    backgroundColor: '#5c77ff',
  },
  menuBtnActive: { backgroundColor: '#3d52cc' },
});
