import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import * as Speech from 'expo-speech';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL, healthCheck } from '../../src/services/apiService';
import useAppStore from '../../src/store';
import { getTheme } from '../../src/theme';
import AppleBackButton from '../../src/components/AppleBackButton';

const sortVoicesForDisplay = (voices) => voices.filter((voice) => (
  String(voice.language || '').toLowerCase() === 'en-us'
)).sort((a, b) => {
  const aEnhanced = a.quality === Speech.VoiceQuality.Enhanced ? 0 : 1;
  const bEnhanced = b.quality === Speech.VoiceQuality.Enhanced ? 0 : 1;
  if (aEnhanced !== bEnhanced) return aEnhanced - bEnhanced;

  return `${a.language || ''} ${a.name || ''}`.localeCompare(`${b.language || ''} ${b.name || ''}`);
});

export default function SettingsConfigurationView({ navigation }) {
  const insets = useSafeAreaInsets();
  const [serverStatus, setServerStatus] = useState('checking');
  const [unavailableExpanded, setUnavailableExpanded] = useState(false);
  const [systemVoices, setSystemVoices] = useState([]);
  const [systemVoicesStatus, setSystemVoicesStatus] = useState('loading');
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const developerModeEnabled = useAppStore((s) => s.developerModeEnabled);
  const setDeveloperModeEnabled = useAppStore((s) => s.setDeveloperModeEnabled);
  const hotspotSuggestionsEnabled = useAppStore((s) => s.hotspotSuggestionsEnabled);
  const setHotspotSuggestionsEnabled = useAppStore((s) => s.setHotspotSuggestionsEnabled);
  const voiceModeEnabled = useAppStore((s) => s.voiceModeEnabled);
  const setVoiceModeEnabled = useAppStore((s) => s.setVoiceModeEnabled);
  const voiceOutputProvider = useAppStore((s) => s.voiceOutputProvider);
  const systemVoiceIdentifier = useAppStore((s) => s.systemVoiceIdentifier);
  const setVoiceOutputProvider = useAppStore((s) => s.setVoiceOutputProvider);
  const testVoiceOutput = useAppStore((s) => s.testVoiceOutput);
  const isSpeaking = useAppStore((s) => s.isSpeaking);
  const voiceError = useAppStore((s) => s.voiceError);
  const resetStudySession = useAppStore((s) => s.resetStudySession);
  const theme = getTheme(themeMode);
  const sortedSystemVoices = useMemo(() => sortVoicesForDisplay(systemVoices), [systemVoices]);

  useEffect(() => {
    let mounted = true;

    healthCheck()
      .then((response) => {
        if (mounted) {
          setServerStatus(response?.status === 'ok' ? 'online' : 'degraded');
        }
      })
      .catch(() => {
        if (mounted) {
          setServerStatus('offline');
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (mounted) {
          setSystemVoices(Array.isArray(voices) ? voices : []);
          setSystemVoicesStatus('ready');
        }
      })
      .catch(() => {
        if (mounted) {
          setSystemVoices([]);
          setSystemVoicesStatus('failed');
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const handleResetStudySession = () => {
    Alert.alert(
      'End current participant?',
      'This clears the local itinerary, chat, active tour, and session ID on this phone. Existing backend logs stay saved under the previous session.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End & Reset',
          style: 'destructive',
          onPress: async () => {
            await resetStudySession();
            navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ height: insets.top }} />

      {/* 1. FIXED CONTENT TOP APPLICATION BAR */}
      <View style={[styles.header, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <AppleBackButton onPress={handleGoBack} />
      </View>

      {/* 2. CORE INTERACTION SCROLL SYSTEM WORKSPACE */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollPadding}
        showsVerticalScrollIndicator={false}
      >
        {/* Screen Identity Intro */}
        <View style={styles.headlineGroupSection}>
          <Text style={[styles.screenHeadlineText, { color: theme.text }]}>Configuration</Text>
          <Text style={[styles.screenSubtextHelper, { color: theme.mutedText }]}>Manage developer preferences, data telemetry, and core settings.</Text>
        </View>

        <View style={[styles.sectionContainerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionTitleHeaderRow}>
            <View style={[styles.iconWrapperBoxMuted, { backgroundColor: theme.iconSurface }]}>
              <Svg width="20" height="20" fill="none" stroke="#5c77ff" strokeWidth="2" viewBox="0 0 24 24">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0L16.95 7.05M7.05 16.95l-1.414 1.414" />
              </Svg>
            </View>
            <Text style={[styles.sectionHeadlineTitle, { color: theme.text }]}>User Settings</Text>
          </View>

          <View style={styles.toggleClusterContainerList}>
            <View style={styles.toggleActionRowLine}>
              <View style={styles.toggleRowTextLeftDesc}>
                <Text style={[styles.toggleRowTitleHeader, { color: theme.text }]}>Developer Mode</Text>
                <Text style={[styles.toggleRowSubtitleCaption, { color: theme.mutedText }]}>Show model, latency, and blackbox traces on new responses.</Text>
              </View>
              <Switch
                value={developerModeEnabled}
                onValueChange={setDeveloperModeEnabled}
                trackColor={{ false: '#3f3f46', true: '#5c77ff' }}
                thumbColor="#ffffff"
              />
            </View>
            <View style={styles.toggleActionRowLine}>
              <View style={styles.toggleRowTextLeftDesc}>
                <Text style={[styles.toggleRowTitleHeader, { color: theme.text }]}>Hotspot Suggestions</Text>
                <Text style={[styles.toggleRowSubtitleCaption, { color: theme.mutedText }]}>Receive real-time intelligence on high-activity areas.</Text>
              </View>
              <Switch
                value={hotspotSuggestionsEnabled}
                onValueChange={setHotspotSuggestionsEnabled}
                trackColor={{ false: '#3f3f46', true: '#5c77ff' }}
                thumbColor="#ffffff"
              />
            </View>
            <View style={styles.toggleActionRowLine}>
              <View style={styles.toggleRowTextLeftDesc}>
                <Text style={[styles.toggleRowTitleHeader, { color: theme.text }]}>Light Mode</Text>
                <Text style={[styles.toggleRowSubtitleCaption, { color: theme.mutedText }]}>Switch the app chrome to a brighter study mode.</Text>
              </View>
              <Switch
                value={themeMode === 'light'}
                onValueChange={(enabled) => setThemeMode(enabled ? 'light' : 'dark')}
                trackColor={{ false: '#3f3f46', true: '#5c77ff' }}
                thumbColor="#ffffff"
              />
            </View>
            <View style={styles.toggleActionRowLine}>
              <View style={styles.toggleRowTextLeftDesc}>
                <Text style={[styles.toggleRowTitleHeader, { color: theme.text }]}>Voice Mode</Text>
                <Text style={[styles.toggleRowSubtitleCaption, { color: theme.mutedText }]}>Speak assistant replies after push-to-talk questions.</Text>
              </View>
              <Switch
                value={voiceModeEnabled}
                onValueChange={setVoiceModeEnabled}
                trackColor={{ false: '#3f3f46', true: '#5c77ff' }}
                thumbColor="#ffffff"
              />
            </View>
            <View style={styles.voiceProviderBlock}>
              <Text style={[styles.subsectionLabel, { color: theme.mutedText }]}>Voice Output</Text>
              <View style={styles.radioBlockClusterStack}>
                <TouchableOpacity
                  style={[
                    styles.radioSelectionCardBase,
                    voiceOutputProvider === 'deepgram' ? styles.radioCardActive : styles.radioCardMuted,
                    {
                      backgroundColor: voiceOutputProvider === 'deepgram' ? theme.accentSoft : theme.background,
                      borderColor: voiceOutputProvider === 'deepgram' ? theme.accent : theme.border,
                    },
                  ]}
                  onPress={() => setVoiceOutputProvider('deepgram')}
                  activeOpacity={0.82}
                >
                  <View style={styles.radioSplitFlexRow}>
                    <View style={styles.radioCardTextCoreArea}>
                      <Text style={[styles.radioCardTitleMain, { color: theme.text }]}>Deepgram Aura (Deprecated)</Text>
                      <Text style={[styles.radioCardDescriptionLabel, { color: theme.mutedText }]}>Neural server voice. Falls back to the default device voice if unavailable.</Text>
                    </View>
                    {voiceOutputProvider === 'deepgram' && (
                      <Svg width="20" height="20" fill={theme.accent} viewBox="0 0 20 20">
                        <Path fillRule="evenodd" clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.7a1 1 0 00-1.4-1.4L9 10.17 7.7 8.88a1 1 0 10-1.4 1.42l2 2a1 1 0 001.4 0l4-4z" />
                      </Svg>
                    )}
                  </View>
                </TouchableOpacity>
                {systemVoicesStatus === 'loading' && (
                  <Text style={[styles.radioCardDescriptionLabel, { color: theme.mutedText }]}>Loading installed US voices...</Text>
                )}
                {systemVoicesStatus === 'failed' && (
                  <Text style={[styles.voiceErrorText, { color: theme.danger }]}>Could not load installed device voices.</Text>
                )}
                {systemVoicesStatus === 'ready' && sortedSystemVoices.length === 0 && (
                  <Text style={[styles.radioCardDescriptionLabel, { color: theme.mutedText }]}>No en-US device voices are installed.</Text>
                )}
                {sortedSystemVoices.map((voice) => {
                  const isSelected = voiceOutputProvider === 'system' && systemVoiceIdentifier === voice.identifier;
                  return (
                    <TouchableOpacity
                      key={voice.identifier}
                      style={[
                        styles.radioSelectionCardBase,
                        isSelected ? styles.radioCardActive : styles.radioCardMuted,
                        {
                          backgroundColor: isSelected ? theme.accentSoft : theme.background,
                          borderColor: isSelected ? theme.accent : theme.border,
                        },
                      ]}
                      onPress={() => setVoiceOutputProvider('system', voice.identifier)}
                      activeOpacity={0.82}
                    >
                      <View style={styles.radioSplitFlexRow}>
                        <View style={styles.radioCardTextCoreArea}>
                          <Text style={[styles.radioCardTitleMain, { color: theme.text }]}>{voice.name || 'Unnamed Voice'}</Text>
                          <View style={styles.voiceMetaRow}>
                            <Text style={[styles.voiceMetaText, { color: theme.mutedText }]}>{voice.language || 'Unknown language'}</Text>
                            <View style={[
                              styles.voiceQualityBadge,
                              { borderColor: voice.quality === Speech.VoiceQuality.Enhanced ? theme.accent : theme.border },
                            ]}>
                              <Text style={[
                                styles.voiceQualityText,
                                { color: voice.quality === Speech.VoiceQuality.Enhanced ? theme.accent : theme.mutedText },
                              ]}>
                                {voice.quality || 'Default'}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.voiceIdentifierText, { color: theme.mutedText }]} numberOfLines={1}>
                            {voice.identifier}
                          </Text>
                        </View>
                        {isSelected && (
                          <Svg width="20" height="20" fill={theme.accent} viewBox="0 0 20 20">
                            <Path fillRule="evenodd" clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.7a1 1 0 00-1.4-1.4L9 10.17 7.7 8.88a1 1 0 10-1.4 1.42l2 2a1 1 0 001.4 0l4-4z" />
                          </Svg>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {voiceError && (
                <Text style={[styles.voiceErrorText, { color: theme.danger }]}>{voiceError}</Text>
              )}
              <TouchableOpacity
                style={[styles.testVoiceButton, { borderColor: theme.accent, backgroundColor: themeMode === 'light' ? '#eef2ff' : 'rgba(92, 119, 255, 0.12)' }]}
                onPress={testVoiceOutput}
                disabled={isSpeaking}
                activeOpacity={0.82}
              >
                <Text style={[styles.testVoiceButtonText, { color: theme.accent }]}>
                  {isSpeaking ? 'Playing Voice...' : 'Test Voice Output'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={[styles.sectionContainerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionTitleHeaderRow}>
            <View style={[styles.iconWrapperBoxMuted, { backgroundColor: theme.iconSurface }]}>
              <Svg width="20" height="20" fill="none" stroke="#34d399" strokeWidth="2" viewBox="0 0 24 24">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M4 17l6-6 4 4 6-8" />
              </Svg>
            </View>
            <Text style={[styles.sectionHeadlineTitle, { color: theme.text }]}>Admin Settings</Text>
          </View>

          <View style={styles.adminStack}>
            <View style={styles.adminBlock}>
              <Text style={[styles.subsectionLabel, { color: theme.mutedText }]}>API Connection</Text>
              <View style={styles.statusRow}>
                <View style={[
                  styles.statusDot,
                  serverStatus === 'online' && styles.statusDotOnline,
                  serverStatus === 'offline' && styles.statusDotOffline,
                ]} />
                <View style={styles.statusTextWrap}>
                  <Text style={[styles.toggleRowTitleHeader, { color: theme.text }]}>{serverStatus.toUpperCase()}</Text>
                  <Text style={[styles.toggleRowSubtitleCaption, { color: theme.mutedText }]}>{API_BASE_URL}</Text>
                </View>
              </View>
            </View>

            <View style={styles.adminBlock}>
              <Text style={[styles.subsectionLabel, { color: theme.mutedText }]}>User Study Session</Text>
              <Text style={[styles.resetSessionHelper, { color: theme.mutedText }]}>
                End the current participant and return this phone to a clean start state.
              </Text>
              <TouchableOpacity
                style={[styles.resetSessionButton, { borderColor: theme.danger, backgroundColor: themeMode === 'light' ? '#fef2f2' : 'rgba(248, 113, 113, 0.12)' }]}
                onPress={handleResetStudySession}
              >
                <Text style={[styles.resetSessionButtonText, { color: theme.danger }]}>End Participant & Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={[styles.sectionContainerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TouchableOpacity
            style={styles.unavailableHeader}
            onPress={() => setUnavailableExpanded((expanded) => !expanded)}
            activeOpacity={0.82}
          >
            <View style={styles.unavailableHeaderLeft}>
              <View style={[styles.iconWrapperBoxMuted, { backgroundColor: theme.iconSurface }]}>
                <Svg width="20" height="20" fill="none" stroke={theme.mutedText} strokeWidth="2" viewBox="0 0 24 24">
                  <Path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </Svg>
              </View>
              <View style={styles.unavailableTitleWrap}>
                <Text style={[styles.sectionHeadlineTitle, { color: theme.text }]}>Unavailable</Text>
                <Text style={[styles.toggleRowSubtitleCaption, { color: theme.mutedText }]}>Placeholder controls kept for reference.</Text>
              </View>
            </View>
            <Text style={[styles.chevronArrowIndicatorChar, { color: theme.mutedText }]}>
              {unavailableExpanded ? '⌃' : '⌄'}
            </Text>
          </TouchableOpacity>

          {unavailableExpanded && (
            <View style={styles.unavailableBody}>
              <View style={[styles.unavailablePanel, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <Text style={[styles.subsectionLabel, { color: theme.mutedText }]}>Neural Synthesis Profile</Text>
                <View style={styles.radioBlockClusterStack}>
                  <TouchableOpacity
                    disabled
                    style={[
                      styles.radioSelectionCardBase,
                      styles.disabledOption,
                      { backgroundColor: theme.background, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.radioCardTitleMain, { color: theme.mutedText }]}>Nova (Default)</Text>
                    <Text style={[styles.radioCardDescriptionLabel, { color: theme.mutedText }]}>Disabled until model profile selection is connected.</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled
                    style={[
                      styles.radioSelectionCardBase,
                      styles.disabledOption,
                      { backgroundColor: theme.background, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.radioCardTitleMain, { color: theme.mutedText }]}>Echo (Beta)</Text>
                    <Text style={[styles.radioCardDescriptionLabel, { color: theme.mutedText }]}>Disabled until voice profile routing is implemented.</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.sectionCardLowerMetadataRow, { borderColor: theme.border, opacity: 0.45 }]}>
                  <Text style={[styles.monoVersionText, { color: theme.mutedText }]}>Model version: v2.4.1-stable</Text>
                  <Text style={[styles.accentTriggerTextAction, { color: theme.mutedText }]}>Test Output</Text>
                </View>
              </View>

              <View style={[styles.unavailablePanel, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <Text style={[styles.subsectionLabel, { color: theme.mutedText }]}>Telemetry & Sync</Text>
                <View style={styles.toggleClusterContainerList}>
                  <View style={[styles.toggleActionRowLine, styles.disabledOption]}>
                    <View style={styles.toggleRowTextLeftDesc}>
                      <Text style={[styles.toggleRowTitleHeader, { color: theme.mutedText }]}>Background Sync</Text>
                      <Text style={[styles.toggleRowSubtitleCaption, { color: theme.mutedText }]}>Not wired to a background task yet.</Text>
                    </View>
                    <Switch disabled value={false} trackColor={{ false: '#3f3f46', true: '#5c77ff' }} thumbColor="#d4d4d8" />
                  </View>
                  <View style={[styles.toggleActionRowLine, styles.disabledOption]}>
                    <View style={styles.toggleRowTextLeftDesc}>
                      <Text style={[styles.toggleRowTitleHeader, { color: theme.mutedText }]}>Offline Caching</Text>
                      <Text style={[styles.toggleRowSubtitleCaption, { color: theme.mutedText }]}>Map tile caching is not available in this build.</Text>
                    </View>
                    <Switch disabled value={false} trackColor={{ false: '#3f3f46', true: '#5c77ff' }} thumbColor="#d4d4d8" />
                  </View>
                </View>
              </View>

              <View style={[styles.unavailablePanel, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <Text style={[styles.subsectionLabel, { color: theme.mutedText }]}>Privacy Protocols</Text>
                <View style={styles.linkButtonStackGroup}>
                  <TouchableOpacity disabled style={[styles.rowLinkCardContainer, styles.disabledOption, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <View style={styles.rowLinkLeftContentGroup}>
                      <Svg width="20" height="20" fill="none" stroke={theme.mutedText} strokeWidth="2" viewBox="0 0 24 24" style={styles.inlineIconSpace}>
                        <Path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </Svg>
                      <Text style={[styles.rowLinkMainTextTitle, { color: theme.mutedText }]}>Clear Routing History</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity disabled style={[styles.rowLinkCardContainer, styles.disabledOption, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <View style={styles.rowLinkLeftContentGroup}>
                      <Svg width="20" height="20" fill="none" stroke={theme.mutedText} strokeWidth="2" viewBox="0 0 24 24" style={styles.inlineIconSpace}>
                        <Path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </Svg>
                      <Text style={[styles.rowLinkMainTextTitle, { color: theme.mutedText }]}>Manage Voice Recordings</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.unavailablePanel, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <Text style={[styles.subsectionLabel, { color: theme.mutedText }]}>Rendering Engine</Text>
                <View style={styles.segmentedControlGridCols3}>
                  {['Obsidian', 'Satellite', 'Vector Wire'].map((label) => (
                    <TouchableOpacity
                      key={label}
                      disabled
                      style={[styles.segmentBtnItem, styles.disabledOption, { backgroundColor: theme.background, borderColor: theme.border }]}
                    >
                      <Text style={[styles.segmentButtonTextLabel, { color: theme.mutedText }]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

      </ScrollView>

    </View>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#0F0F12',
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
    paddingBottom: 32,
  },
  headlineGroupSection: {
    marginBottom: 24,
  },
  screenHeadlineText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#e4e4e7',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  screenSubtextHelper: {
    fontSize: 14,
    color: '#a1a1aa',
    lineHeight: 20,
  },
  sectionContainerCard: {
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  sectionTitleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconWrapperBoxMuted: {
    backgroundColor: '#27272A',
    borderRadius: 8,
    padding: 8,
    marginRight: 12,
  },
  sectionHeadlineTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e4e4e7',
  },
  adminStack: {
    gap: 22,
  },
  adminBlock: {
    gap: 10,
  },
  subsectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f59e0b',
    marginRight: 12,
  },
  statusDotOnline: {
    backgroundColor: '#34d399',
  },
  statusDotOffline: {
    backgroundColor: '#f87171',
  },
  statusTextWrap: {
    flex: 1,
  },
  radioBlockClusterStack: {
    gap: 12,
  },
  radioSelectionCardBase: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  radioCardActive: {
    borderColor: '#5c77ff',
    backgroundColor: 'rgba(92, 119, 255, 0.1)',
  },
  radioCardMuted: {
    borderColor: '#27272A',
    backgroundColor: '#0F0F12',
  },
  radioSplitFlexRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  radioCardTextCoreArea: {
    flex: 1,
    paddingRight: 16,
  },
  radioCardTitleMain: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 4,
  },
  radioCardDescriptionLabel: {
    fontSize: 14,
    color: '#a1a1aa',
    lineHeight: 20,
  },
  voiceProviderBlock: {
    gap: 12,
  },
  voiceErrorText: {
    fontSize: 13,
    lineHeight: 18,
  },
  voiceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
    marginBottom: 4,
  },
  voiceMetaText: {
    fontSize: 12,
    lineHeight: 16,
  },
  voiceQualityBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  voiceQualityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  voiceIdentifierText: {
    fontSize: 11,
    lineHeight: 15,
  },
  testVoiceButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  testVoiceButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  activeCheckBadgeAnchor: {
    marginTop: 2,
  },
  sectionCardLowerMetadataRow: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: '#27272A',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monoVersionText: {
    fontSize: 12,
    fontFamily: 'Courier',
    color: '#a1a1aa',
  },
  accentTriggerTextAction: {
    color: '#5c77ff',
    fontSize: 12,
    fontWeight: '500',
  },
  toggleClusterContainerList: {
    gap: 20,
  },
  toggleActionRowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleRowTextLeftDesc: {
    flex: 1,
    paddingRight: 16,
  },
  toggleRowTitleHeader: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  toggleRowSubtitleCaption: {
    fontSize: 14,
    color: '#a1a1aa',
    marginTop: 2,
  },
  resetSessionHelper: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  resetSessionButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  resetSessionButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  linkButtonStackGroup: {
    gap: 12,
  },
  rowLinkCardContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#0F0F12',
  },
  rowLinkLeftContentGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineIconSpace: {
    marginRight: 12,
  },
  rowLinkMainTextTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  chevronArrowIndicatorChar: {
    color: '#a1a1aa',
    fontSize: 18,
  },
  unavailableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unavailableHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  unavailableTitleWrap: {
    flex: 1,
  },
  unavailableBody: {
    gap: 14,
    marginTop: 18,
  },
  unavailablePanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 14,
  },
  disabledOption: {
    opacity: 0.48,
  },
  segmentedControlGridCols3: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  segmentBtnItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  segmentBtnActive: {
    borderColor: '#5c77ff',
    backgroundColor: 'rgba(92, 119, 255, 0.1)',
  },
  segmentBtnInactive: {
    borderColor: '#27272A',
    backgroundColor: '#0F0F12',
  },
  segmentIconCharEmoji: {
    fontSize: 18,
    marginBottom: 4,
  },
  segmentButtonTextLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  textActiveLabel: {
    color: '#5c77ff',
  },
  textMutedLabel: {
    color: '#a1a1aa',
  },
});
