import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Dimensions
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL, healthCheck } from '../../src/services/apiService';

const { width: screenWidth } = Dimensions.get('window');

export default function SettingsConfigurationView({ navigation }) {
  const insets = useSafeAreaInsets();
  const [neuralProfile, setNeuralProfile] = useState('nova');
  const [bgSync, setBgSync] = useState(true);
  const [offlineCaching, setOfflineCaching] = useState(false);
  const [hotspotSuggestions, setHotspotSuggestions] = useState(false);
  const [renderingEngine, setRenderingEngine] = useState('obsidian');
  const [serverStatus, setServerStatus] = useState('checking');

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

      {/* 1. FIXED CONTENT TOP APPLICATION BAR */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Svg width="18" height="18" fill="none" stroke="#a1a1aa" strokeWidth="2" viewBox="0 0 24 24">
            <Path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* 2. CORE INTERACTION SCROLL SYSTEM WORKSPACE */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollPadding}
        showsVerticalScrollIndicator={false}
      >
        {/* Screen Identity Intro */}
        <View style={styles.headlineGroupSection}>
          <Text style={styles.screenHeadlineText}>Configuration</Text>
          <Text style={styles.screenSubtextHelper}>Manage developer preferences, data telemetry, and core settings.</Text>
        </View>

        <View style={styles.sectionContainerCard}>
          <View style={styles.sectionTitleHeaderRow}>
            <View style={styles.iconWrapperBoxMuted}>
              <Svg width="20" height="20" fill="none" stroke="#34d399" strokeWidth="2" viewBox="0 0 24 24">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M4 17l6-6 4 4 6-8" />
              </Svg>
            </View>
            <Text style={styles.sectionHeadlineTitle}>API Connection</Text>
          </View>
          <View style={styles.statusRow}>
            <View style={[
              styles.statusDot,
              serverStatus === 'online' && styles.statusDotOnline,
              serverStatus === 'offline' && styles.statusDotOffline,
            ]} />
            <View style={styles.statusTextWrap}>
              <Text style={styles.toggleRowTitleHeader}>{serverStatus.toUpperCase()}</Text>
              <Text style={styles.toggleRowSubtitleCaption}>{API_BASE_URL}</Text>
            </View>
          </View>
        </View>

        {/* NEURAL SYNTHESIS RADIO CARD SELECT SECTION */}
        <View style={styles.sectionContainerCard}>
          <View style={styles.sectionTitleHeaderRow}>
            <View style={styles.iconWrapperBoxMuted}>
              <Svg width="20" height="20" fill="none" stroke="#5c77ff" strokeWidth="2" viewBox="0 0 24 24">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </Svg>
            </View>
            <Text style={styles.sectionHeadlineTitle}>Neural Synthesis Profile</Text>
          </View>

          <View style={styles.radioBlockClusterStack}>
            {/* Active Choice Card: Nova */}
            <TouchableOpacity
              style={[styles.radioSelectionCardBase, neuralProfile === 'nova' ? styles.radioCardActive : styles.radioCardMuted]}
              onPress={() => setNeuralProfile('nova')}
            >
              <View style={styles.radioSplitFlexRow}>
                <View style={styles.radioCardTextCoreArea}>
                  <Text style={styles.radioCardTitleMain}>Nova (Default)</Text>
                  <Text style={styles.radioCardDescriptionLabel}>Energetic, clear, slightly robotic undertone. Optimized for navigation.</Text>
                </View>
                {neuralProfile === 'nova' && (
                  <View style={styles.activeCheckBadgeAnchor}>
                    <Svg width="20" height="20" fill="#5c77ff" viewBox="0 0 20 20">
                      <Path fillRule="evenodd" clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                    </Svg>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {/* Inactive Choice Card: Echo */}
            <TouchableOpacity
              style={[styles.radioSelectionCardBase, neuralProfile === 'echo' ? styles.radioCardActive : styles.radioCardMuted]}
              onPress={() => setNeuralProfile('echo')}
            >
              <View style={styles.radioSplitFlexRow}>
                <View style={styles.radioCardTextCoreArea}>
                  <Text style={styles.radioCardTitleMain}>Echo (Beta)</Text>
                  <Text style={styles.radioCardDescriptionLabel}>Deep, resonant, calm. Requires persistent network connection.</Text>
                </View>
                {neuralProfile === 'echo' && (
                  <View style={styles.activeCheckBadgeAnchor}>
                    <Svg width="20" height="20" fill="#5c77ff" viewBox="0 0 20 20">
                      <Path fillRule="evenodd" clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                    </Svg>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCardLowerMetadataRow}>
            <Text style={styles.monoVersionText}>Model version: v2.4.1-stable</Text>
            <TouchableOpacity><Text style={styles.accentTriggerTextAction}>Test Output</Text></TouchableOpacity>
          </View>
        </View>

        {/* TELEMETRY ENGINE SYNC PREFERENCES (TOGGLE LIST) */}
        <View style={styles.sectionContainerCard}>
          <View style={styles.sectionTitleHeaderRow}>
            <View style={styles.iconWrapperBoxMuted}>
              <Svg width="20" height="20" fill="none" stroke="#ffffff" strokeWidth="2" viewBox="0 0 24 24">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </Svg>
            </View>
            <Text style={styles.sectionHeadlineTitle}>Telemetry & Sync</Text>
          </View>

          <View style={styles.toggleClusterContainerList}>
            {/* Switch Input Row 1 */}
            <View style={styles.toggleActionRowLine}>
              <View style={styles.toggleRowTextLeftDesc}>
                <Text style={styles.toggleRowTitleHeader}>Background Sync</Text>
                <Text style={styles.toggleRowSubtitleCaption}>Continuous location processing</Text>
              </View>
              <Switch
                value={bgSync}
                onValueChange={(val) => setBgSync(val)}
                trackColor={{ false: '#3f3f46', true: '#5c77ff' }}
                thumbColor="#ffffff"
              />
            </View>

            {/* Switch Input Row 2 */}
            <View style={styles.toggleActionRowLine}>
              <View style={styles.toggleRowTextLeftDesc}>
                <Text style={styles.toggleRowTitleHeader}>Offline Caching</Text>
                <Text style={styles.toggleRowSubtitleCaption}>Store maps up to 2GB</Text>
              </View>
              <Switch
                value={offlineCaching}
                onValueChange={(val) => setOfflineCaching(val)}
                trackColor={{ false: '#3f3f46', true: '#5c77ff' }}
                thumbColor="#ffffff"
              />
            </View>

            {/* Switch Input Row 3 */}
            <View style={styles.toggleActionRowLine}>
              <View style={styles.toggleRowTextLeftDesc}>
                <Text style={styles.toggleRowTitleHeader}>Hot-Spot Suggestions</Text>
                <Text style={styles.toggleRowSubtitleCaption}>Receive real-time intelligence on high-activity areas.</Text>
              </View>
              <Switch
                value={hotspotSuggestions}
                onValueChange={(val) => setHotspotSuggestions(val)}
                trackColor={{ false: '#3f3f46', true: '#5c77ff' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </View>

        {/* PRIVACY SAFETY BUTTON PROTOCOLS */}
        <View style={styles.sectionContainerCard}>
          <View style={styles.sectionTitleHeaderRow}>
            <View style={styles.iconWrapperBoxMuted}>
              <Svg width="20" height="20" fill="none" stroke="#f87171" strokeWidth="2" viewBox="0 0 24 24">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </Svg>
            </View>
            <Text style={styles.sectionHeadlineTitle}>Privacy Protocols</Text>
          </View>

          <View style={styles.linkButtonStackGroup}>
            {/* Action Action Trigger 1 */}
            <TouchableOpacity style={styles.rowLinkCardContainer} onPress={() => console.log('Trigger clear pipeline data index')}>
              <View style={styles.rowLinkLeftContentGroup}>
                <Svg width="20" height="20" fill="none" stroke="#a1a1aa" strokeWidth="2" viewBox="0 0 24 24" style={styles.inlineIconSpace}>
                  <Path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </Svg>
                <Text style={styles.rowLinkMainTextTitle}>Clear Routing History</Text>
              </View>
              <Text style={styles.chevronArrowIndicatorChar}>❯</Text>
            </TouchableOpacity>

            {/* Action Action Trigger 2 */}
            <TouchableOpacity style={styles.rowLinkCardContainer} onPress={() => console.log('Trigger manifest data portal adjustment')}>
              <View style={styles.rowLinkLeftContentGroup}>
                <Svg width="20" height="20" fill="none" stroke="#a1a1aa" strokeWidth="2" viewBox="0 0 24 24" style={styles.inlineIconSpace}>
                  <Path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </Svg>
                <Text style={styles.rowLinkMainTextTitle}>Manage Voice Recordings</Text>
              </View>
              <Text style={styles.chevronArrowIndicatorChar}>❯</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* RENDERING MATRIX GRAPHICS SELECTOR BAR (SEGMENTED GRID MATRIX) */}
        <View style={styles.sectionContainerCard}>
          <View style={styles.sectionTitleHeaderRow}>
            <View style={styles.iconWrapperBoxMuted}>
              <Svg width="20" height="20" fill="none" stroke="#34d399" strokeWidth="2" viewBox="0 0 24 24">
                <Path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </Svg>
            </View>
            <Text style={styles.sectionHeadlineTitle}>Rendering Engine</Text>
          </View>

          <View style={styles.segmentedControlGridCols3}>
            {/* Tab Section Item 1 */}
            <TouchableOpacity
              style={[styles.segmentBtnItem, renderingEngine === 'obsidian' ? styles.segmentBtnActive : styles.segmentBtnInactive]}
              onPress={() => setRenderingEngine('obsidian')}
            >
              <Text style={styles.segmentIconCharEmoji}>🌑</Text>
              <Text style={[styles.segmentButtonTextLabel, renderingEngine === 'obsidian' ? styles.textActiveLabel : styles.textMutedLabel]}>Obsidian</Text>
            </TouchableOpacity>

            {/* Tab Section Item 2 */}
            <TouchableOpacity
              style={[styles.segmentBtnItem, renderingEngine === 'satellite' ? styles.segmentBtnActive : styles.segmentBtnInactive]}
              onPress={() => setRenderingEngine('satellite')}
            >
              <Text style={styles.segmentIconCharEmoji}>🛰️</Text>
              <Text style={[styles.segmentButtonTextLabel, renderingEngine === 'satellite' ? styles.textActiveLabel : styles.textMutedLabel]}>Satellite</Text>
            </TouchableOpacity>

            {/* Tab Section Item 3 */}
            <TouchableOpacity
              style={[styles.segmentBtnItem, renderingEngine === 'vector' ? styles.segmentBtnActive : styles.segmentBtnInactive]}
              onPress={() => setRenderingEngine('vector')}
            >
              <Text style={styles.segmentIconCharEmoji}>🕸️</Text>
              <Text style={[styles.segmentButtonTextLabel, renderingEngine === 'vector' ? styles.textActiveLabel : styles.textMutedLabel]}>Vector Wire</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* 3. OVERLAY LAYER CORE HORIZONTAL RUN FLOATING NAVIGATION DOCK PILL */}
      <View style={styles.floatingNavContainer}>
        <View style={styles.navDockPillLayoutRow}>

          <TouchableOpacity style={styles.tabMutedActionItem} onPress={() => navigation.navigate('ConfirmItinerary')}>
            <Svg width="24" height="24" fill="none" stroke="#a1a1aa" strokeWidth="2" viewBox="0 0 24 24">
              <Path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabMutedActionItem} onPress={() => navigation.navigate('Chat')}>
            <Svg width="24" height="24" fill="none" stroke="#a1a1aa" strokeWidth="2" viewBox="0 0 24 24">
              <Path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabBubbleActiveIconWrapper} onPress={() => navigation.navigate('Settings')}>
            <Svg width="24" height="24" fill="none" stroke="#ffffff" strokeWidth="2" viewBox="0 0 24 24">
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
    paddingBottom: 120,
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
    fontSize: 12,
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
  floatingNavContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 60,
    alignItems: 'center',
  },
  navDockPillLayoutRow: {
    backgroundColor: 'rgba(22, 22, 24, 0.9)',
    borderWidth: 1,
    borderColor: '#27272A',
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
  tabMutedActionItem: {
    padding: 4,
  },
  tabBubbleActiveIconWrapper: {
    backgroundColor: '#5c77ff',
    padding: 12,
    borderRadius: 9999,
    shadowColor: '#5c77ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
});
