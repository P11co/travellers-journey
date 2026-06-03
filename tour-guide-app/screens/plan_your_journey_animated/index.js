import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppStore from '../../src/store';
import { getTheme } from '../../src/theme';
import hotspotsData from '../../src/data/hotspots.json';
import AppleBackButton from '../../src/components/AppleBackButton';
import RemoteImage from '../../src/components/RemoteImage';

const primaryLocationImage = 'assets/images/hotspots/gyeongbokgung-primary-location.png';

const BUDGET_OPTIONS = ['$25', '$50', '$100', '$200'];
const TIME_OPTIONS = ['Half Day (4 hrs)', 'Full Day (8 hrs)', 'Two Days (16 hrs)'];
const START_TIME_HOURS = Array.from({ length: 12 }, (_, idx) => String(idx + 1));
const START_TIME_MINUTES = ['00', '15', '30', '45'];
const START_TIME_PERIODS = ['AM', 'PM'];

const getPlanColors = (theme, themeMode) => ({
  background: theme.background,
  headerBg: themeMode === 'light' ? 'rgba(248, 250, 252, 0.94)' : 'rgba(19, 19, 19, 0.9)',
  surface: theme.surface,
  elevated: theme.elevated,
  panel: theme.panel,
  border: theme.border,
  text: theme.text,
  muted: theme.mutedText,
  subtle: theme.subtleText,
  accent: theme.accent,
  accentSoft: theme.accentSoft,
  iconSurface: theme.iconSurface,
  input: theme.input,
  shadow: theme.shadow,
  danger: theme.danger,
  success: theme.success,
  overlay: themeMode === 'light' ? 'rgba(15, 23, 42, 0.42)' : 'rgba(0, 0, 0, 0.75)',
  heroOverlay: themeMode === 'light' ? 'rgba(15, 23, 42, 0.25)' : 'rgba(19, 19, 19, 0.4)',
  onAccent: '#ffffff',
});

const getSelectedActivityIds = (activityMap = {}) =>
  Object.entries(activityMap)
    .filter(([, enabled]) => enabled)
    .map(([id]) => id);

const parseStartTimeParts = (value) => {
  const match = String(value || '09:00')
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);

  if (!match) {
    return { hour: '9', minute: '00', period: 'AM' };
  }

  let hour = Number(match[1]);
  const minute = START_TIME_MINUTES.includes(match[2]) ? match[2] : '00';
  let period = match[3]?.toUpperCase();

  if (!period) {
    period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
  }

  if (!START_TIME_HOURS.includes(String(hour))) {
    hour = 9;
    period = 'AM';
  }

  return { hour: String(hour), minute, period };
};

const formatStartTimeLabel = (value) => {
  const parts = parseStartTimeParts(value);
  return `${parts.hour}:${parts.minute} ${parts.period}`;
};

const toStartTimeValue = ({ hour, minute, period }) => {
  const hourNumber = Number(hour);
  const hour24 = period === 'PM'
    ? (hourNumber === 12 ? 12 : hourNumber + 12)
    : (hourNumber === 12 ? 0 : hourNumber);
  return `${String(hour24).padStart(2, '0')}:${minute}`;
};

function PreferenceDropdown({
  label,
  value,
  onChange,
  options,
  type,
  disabled,
}) {
  const themeMode = useAppStore((s) => s.themeMode);
  const colors = getPlanColors(getTheme(themeMode), themeMode);
  const [modalVisible, setModalVisible] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isPreset = options.includes(value);

  const handleOpen = () => {
    if (disabled) return;
    if (isPreset) {
      setIsCustomMode(false);
      setCustomValue('');
    } else {
      setIsCustomMode(true);
      const match = String(value || '').match(/(\d+(?:\.\d+)?)/);
      setCustomValue(match ? match[1] : '');
    }
    setErrorMsg('');
    setModalVisible(true);
  };

  const handleSelectPreset = (preset) => {
    onChange(preset);
    setModalVisible(false);
  };

  const handleSelectCustomTrigger = () => {
    setIsCustomMode(true);
    if (isPreset) {
      setCustomValue('');
    } else {
      const match = String(value || '').match(/(\d+(?:\.\d+)?)/);
      setCustomValue(match ? match[1] : '');
    }
    setErrorMsg('');
  };

  const handleSaveCustom = () => {
    const num = parseFloat(customValue);
    if (isNaN(num) || num <= 0) {
      setErrorMsg('Please enter a positive number.');
      return;
    }

    if (type === 'time') {
      if (num < 1 || num > 48) {
        setErrorMsg('Please enter a value between 1 and 48 hours.');
        return;
      }
      onChange(`Custom (${num} hrs)`);
    } else {
      onChange(`$${Math.round(num)}`);
    }

    setModalVisible(false);
  };

  return (
    <View>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.customSelectTrigger,
          { backgroundColor: colors.input, borderColor: colors.border },
          disabled && styles.lockedControl,
        ]}
        onPress={handleOpen}
        disabled={disabled}
      >
        <Text style={[styles.selectText, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.dropdownCarat, { color: colors.muted }]}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select {label}</Text>

            {!isCustomMode ? (
              <View style={styles.optionsList}>
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.optionItem,
                      { backgroundColor: colors.background, borderColor: colors.border },
                      value === opt && styles.optionItemActive,
                      value === opt && { backgroundColor: colors.accentSoft, borderColor: colors.accent },
                    ]}
                    onPress={() => handleSelectPreset(opt)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: colors.muted },
                        value === opt && styles.optionTextActive,
                        value === opt && { color: colors.accent },
                      ]}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    !isPreset && styles.optionItemActive,
                    !isPreset && { backgroundColor: colors.accentSoft, borderColor: colors.accent },
                  ]}
                  onPress={handleSelectCustomTrigger}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: colors.muted },
                      !isPreset && styles.optionTextActive,
                      !isPreset && { color: colors.accent },
                    ]}
                  >
                    Custom... {!isPreset && `(${value})`}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.customInputContainer}>
                <Text style={[styles.customInputLabel, { color: colors.muted }]}>
                  {type === 'budget' ? 'Enter budget in USD:' : 'Enter duration in hours (1-48):'}
                </Text>
                <TextInput
                  style={[
                    styles.modalTextInput,
                    { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
                  ]}
                  keyboardType="numeric"
                  value={customValue}
                  onChangeText={(txt) => {
                    setCustomValue(txt);
                    setErrorMsg('');
                  }}
                  placeholder={type === 'budget' ? 'e.g. 75' : 'e.g. 6'}
                  placeholderTextColor={colors.subtle}
                  autoFocus={true}
                />

                {Boolean(errorMsg) && (
                  <Text style={[styles.modalErrorText, { color: colors.danger }]}>{errorMsg}</Text>
                )}

                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonRowItem, styles.modalButtonCancel]}
                    onPress={() => setIsCustomMode(false)}
                  >
                    <Text style={[styles.modalButtonTextCancel, { color: colors.muted }]}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.modalButtonRowItem,
                      styles.modalButtonSave,
                      { backgroundColor: colors.accent },
                    ]}
                    onPress={handleSaveCustom}
                  >
                    <Text style={[styles.modalButtonTextSave, { color: colors.onAccent }]}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!isCustomMode && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.closeButtonText, { color: colors.muted }]}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StartTimePicker({
  label,
  value,
  onChange,
  disabled,
}) {
  const themeMode = useAppStore((s) => s.themeMode);
  const colors = getPlanColors(getTheme(themeMode), themeMode);
  const [modalVisible, setModalVisible] = useState(false);
  const [draftParts, setDraftParts] = useState(() => parseStartTimeParts(value));

  const openPicker = () => {
    if (disabled) return;
    setDraftParts(parseStartTimeParts(value));
    setModalVisible(true);
  };

  const selectPart = (patch) => {
    setDraftParts((current) => ({ ...current, ...patch }));
  };

  const handleDone = () => {
    onChange(toStartTimeValue(draftParts));
    setModalVisible(false);
  };

  const renderChip = (text, active, onPress, extraStyle) => (
    <TouchableOpacity
      key={text}
      style={[
        styles.timePickerChip,
        { backgroundColor: colors.background, borderColor: colors.border },
        extraStyle,
        active && styles.timePickerChipActive,
        active && { backgroundColor: colors.accentSoft, borderColor: colors.accent },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.timePickerChipText, { color: colors.muted }, active && styles.timePickerChipTextActive, active && { color: colors.accent }]}>
        {text}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.customSelectTrigger,
          { backgroundColor: colors.input, borderColor: colors.border },
          disabled && styles.lockedControl,
        ]}
        onPress={openPicker}
        disabled={disabled}
      >
        <Text style={[styles.selectText, { color: colors.text }]}>{formatStartTimeLabel(value)}</Text>
        <Text style={[styles.dropdownCarat, { color: colors.muted }]}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, styles.startTimeModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.timePickerHeaderRow}>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Text style={[styles.timePickerActionText, { color: colors.muted }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.timePickerHeaderTitle, { color: colors.text }]}>Start Time</Text>
              <TouchableOpacity onPress={handleDone} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Text style={[styles.timePickerActionText, styles.timePickerDoneText, { color: colors.accent }]}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.timePreviewPill, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
              <Text style={[styles.timePreviewText, { color: colors.accent }]}>
                {`${draftParts.hour}:${draftParts.minute} ${draftParts.period}`}
              </Text>
            </View>

            <Text style={[styles.timePickerSectionLabel, { color: colors.muted }]}>Hour</Text>
            <View style={styles.timePickerHourGrid}>
              {START_TIME_HOURS.map((hour) => renderChip(
                hour,
                draftParts.hour === hour,
                () => selectPart({ hour }),
                styles.timePickerHourChip,
              ))}
            </View>

            <View style={styles.timePickerSplitRow}>
              <View style={styles.timePickerSplitColumn}>
                <Text style={[styles.timePickerSectionLabel, { color: colors.muted }]}>Minute</Text>
                <View style={styles.timePickerOptionRow}>
                  {START_TIME_MINUTES.map((minute) => renderChip(
                    minute,
                    draftParts.minute === minute,
                    () => selectPart({ minute }),
                    styles.timePickerSmallChip,
                  ))}
                </View>
              </View>

              <View style={styles.timePickerSplitColumn}>
                <Text style={[styles.timePickerSectionLabel, { color: colors.muted }]}>Period</Text>
                <View style={styles.timePickerOptionRow}>
                  {START_TIME_PERIODS.map((period) => renderChip(
                    period,
                    draftParts.period === period,
                    () => selectPart({ period }),
                    styles.timePickerSmallChip,
                  ))}
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TimeBudgetWarningModal({ visible, detail, onClose }) {
  const themeMode = useAppStore((s) => s.themeMode);
  const colors = getPlanColors(getTheme(themeMode), themeMode);

  if (!detail) return null;

  const formatMins = (mins) => {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
  };

  const budgetStr = formatMins(detail.available_minutes);
  const totalStr = formatMins(detail.required_minutes);
  const overStr = formatMins(detail.over_by_minutes);
  const travelStr = formatMins(detail.travel_minutes || detail.travel_buffer_minutes);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Not Enough Time</Text>
          
          <Text style={[styles.modalWarningText, { color: colors.text }]}>
            Your {budgetStr} budget is too short.
          </Text>

          <View style={[styles.stopsListContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
            {detail.stops?.map((stop, idx) => (
              <View key={idx} style={styles.stopDurationRow}>
                <Text style={[styles.stopNameText, { color: colors.text }]}>{stop.name}</Text>
                <Text style={[styles.stopDurationText, { color: colors.muted }]}>{formatMins(stop.duration_minutes)}</Text>
              </View>
            ))}
            <View style={styles.stopDurationRow}>
              <Text style={[styles.stopNameTextSubtle, { color: colors.subtle }]}>Travel time</Text>
              <Text style={[styles.stopDurationTextSubtle, { color: colors.subtle }]}>{travelStr}</Text>
            </View>
          </View>

          <View style={[styles.budgetSummaryContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabelText, { color: colors.muted }]}>Estimated total:</Text>
              <Text style={[styles.summaryValueText, { color: colors.text }]}>{totalStr}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabelTextAlert, { color: colors.danger }]}>Over budget by:</Text>
              <Text style={[styles.summaryValueTextAlert, { color: colors.danger }]}>{overStr}</Text>
            </View>
          </View>

          <Text style={[styles.modalWarningSubText, { color: colors.muted }]}>
            Please increase your time budget or remove a stop.
          </Text>

          <TouchableOpacity
            style={[styles.timeWarningButton, { backgroundColor: colors.accent }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={[styles.timeWarningButtonText, { color: colors.onAccent }]}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function PlanYourJourneyView({ navigation }) {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = getTheme(themeMode);
  const colors = useMemo(() => getPlanColors(theme, themeMode), [theme, themeMode]);
  const draft = useAppStore((s) => s.draft);
  const updateDraft = useAppStore((s) => s.updateDraft);
  const toggleDraftActivity = useAppStore((s) => s.toggleDraftActivity);
  const generateItinerary = useAppStore((s) => s.generateItinerary);
  const reorderGeneratedStop = useAppStore((s) => s.reorderGeneratedStop);
  const commitItinerary = useAppStore((s) => s.commitItinerary);
  const generatedItinerary = useAppStore((s) => s.generatedItinerary);
  const isLoadingItinerary = useAppStore((s) => s.isLoadingItinerary);
  const itineraryError = useAppStore((s) => s.itineraryError);
  const [reviewError, setReviewError] = useState(null);
  const [timeBudgetWarning, setTimeBudgetWarning] = useState(null);

  const activities = draft.activities;
  const hasGeneratedRoute = Boolean(generatedItinerary);
  const isPlanLocked = isLoadingItinerary || hasGeneratedRoute;
  const routeStops = hasGeneratedRoute ? generatedItinerary.stops || [] : [];
  const routeHasTravelLegs = routeStops.some((stop) => stop.isTravelLeg);
  const bottomError = reviewError || itineraryError;
  const selectedActivityIds = getSelectedActivityIds(activities);
  const hasSelectedActivities = selectedActivityIds.length > 0;

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const toggleActivity = (hotspot) => {
    if (isPlanLocked) return;
    if (hotspot?.opening_hours?.status === 'unavailable') {
      setReviewError(`${hotspot.name} is closed to public visits and cannot be added.`);
      return;
    }
    setReviewError(null);
    toggleDraftActivity(hotspot.id);
  };

  const cycleDraftOption = (field, options) => {
    if (isPlanLocked) return;
    const currentIndex = options.indexOf(draft[field]);
    const nextValue = options[(currentIndex + 1) % options.length];
    updateDraft({ [field]: nextValue });
  };

  const handleSaveAndViewItineraries = () => {
    setReviewError(null);
    if (!generatedItinerary) {
      setReviewError('Generate an itinerary before saving the route.');
      return;
    }
    const committedId = commitItinerary(generatedItinerary.id);
    if (!committedId) {
      setReviewError('Unable to save this itinerary. Please try generating again.');
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const handleGenerateItinerary = async () => {
    setReviewError(null);
    if (!hasSelectedActivities) {
      setReviewError('Select at least one nearby activity before generating an itinerary.');
      return;
    }

    try {
      await generateItinerary();
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 80);
    } catch (err) {
      if (err?.payload?.detail?.code === 'itinerary_time_budget_exceeded') {
        setTimeBudgetWarning(err.payload.detail);
      } else if (err?.message) {
        setReviewError(err.message);
      }
    }
  };

  const handlePrimaryAction = () => {
    if (hasGeneratedRoute) {
      handleSaveAndViewItineraries();
      return;
    }
    handleGenerateItinerary();
  };

  const toggleAiFill = () => {
    if (isPlanLocked) return;
    updateDraft({ allowAiFill: !draft.allowAiFill });
  };

  // Destination-only index: how many destination stops are before this flat index.
  // Travel legs are skipped so the index passed to reorderGeneratedStop is
  // relative to the destination-only list the store now operates on.
  const destIndexOf = (flatIndex) =>
    routeStops.slice(0, flatIndex).filter((s) => !s.isTravelLeg).length;

  const destCount = routeStops.filter((s) => !s.isTravelLeg).length;

  const renderMoveControls = (flatIndex, destIdx) => {
    if (routeHasTravelLegs) return null;

    return (
      <View style={styles.reorderControls}>
        <TouchableOpacity
          style={[
            styles.reorderMoveButton,
            { backgroundColor: colors.elevated, borderColor: colors.border },
            destIdx === 0 && styles.reorderMoveButtonDisabled,
          ]}
          onPress={() => reorderGeneratedStop(destIdx, destIdx - 1)}
          disabled={destIdx === 0}
          activeOpacity={0.75}
          accessibilityLabel="Move stop up"
        >
          <Text style={[styles.reorderMoveText, { color: colors.accent }, destIdx === 0 && styles.reorderMoveTextDisabled]}>↑</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.reorderMoveButton,
            { backgroundColor: colors.elevated, borderColor: colors.border },
            destIdx === destCount - 1 && styles.reorderMoveButtonDisabled,
          ]}
          onPress={() => reorderGeneratedStop(destIdx, destIdx + 1)}
          disabled={destIdx === destCount - 1}
          activeOpacity={0.75}
          accessibilityLabel="Move stop down"
        >
          <Text style={[styles.reorderMoveText, { color: colors.accent }, destIdx === destCount - 1 && styles.reorderMoveTextDisabled]}>↓</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRouteStop = (stop, flatIndex) => {
    if (stop.isTravelLeg) {
      const isTaxi = /^taxi to /i.test(stop.name || stop.place || '');

      return (
        <View key={stop.id || `${stop.name}-${flatIndex}`} style={styles.stopsTimelineRow}>
          <View style={[styles.travelNodeCircle, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
            <Text style={[styles.travelNodeText, { color: colors.muted }]}>{isTaxi ? 'T' : 'W'}</Text>
          </View>
          <View style={[styles.stopInfoDataCard, styles.travelInfoDataCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.stopInfoCardCoreBody}>
              <View style={styles.stopCardHeaderSplitRow}>
                <Text style={[styles.travelNodeTitle, { color: colors.muted }]}>{stop.name}</Text>
                <Text style={[styles.stopNodeTimeLabel, { color: colors.subtle }]}>{stop.time}</Text>
              </View>
              <Text style={[styles.stopCardTextExcerpt, { color: colors.muted }]} numberOfLines={2}>
                {stop.description || stop.activity || (isTaxi ? 'Taxi to the next stop.' : 'Walk to the next stop.')}
              </Text>
              <View style={styles.tagPillsContainerCluster}>
                <View style={[styles.travelCardTagPill, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                  <Text style={[styles.interiorPillText, { color: colors.muted }]}>{stop.duration}</Text>
                </View>
                <View style={[styles.travelCardTagPill, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                  <Text style={[styles.interiorPillText, { color: colors.muted }]}>{isTaxi ? 'TAXI' : 'WALK'}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      );
    }

    const destIdx = destIndexOf(flatIndex);
    const isLunch = /lunch|food|meal|restaurant/i.test(`${stop.name} ${stop.description || ''}`);

    if (isLunch) {
      return (
        <View key={stop.id || `${stop.name}-${flatIndex}`} style={styles.stopsTimelineRow}>
          <View style={[styles.lunchIconCircleNodeElement, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <Text style={styles.lunchIconChar}>🍴</Text>
          </View>
          <View style={[styles.lunchSegmentBannerBox, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            {renderMoveControls(flatIndex, destIdx)}
            <View style={styles.lunchBannerTextWrap}>
              <Text style={[styles.lunchBannerMainText, { color: colors.text }]}>{stop.name}</Text>
              <Text style={[styles.lunchBannerTimeText, { color: colors.accent }]}>{stop.time}</Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View key={stop.id || `${stop.name}-${flatIndex}`} style={styles.stopsTimelineRow}>
        <View style={[
          styles.circleNodeCountElement,
          { backgroundColor: colors.surface, borderColor: colors.border },
          destIdx === 0 && styles.activeBorderHighlightCircle,
          destIdx === 0 && { borderColor: colors.accent },
        ]}>
          <Text style={[destIdx === 0 ? styles.nodeCountActiveText : styles.nodeCountMutedText, { color: destIdx === 0 ? colors.accent : colors.muted }]}>
            {String(destIdx + 1).padStart(2, '0')}
          </Text>
        </View>
        <View style={[styles.stopInfoDataCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {renderMoveControls(flatIndex, destIdx)}
          <View style={styles.stopInfoCardCoreBody}>
            <View style={styles.stopCardHeaderSplitRow}>
              <Text style={[styles.stopNodeTitle, { color: colors.text }]}>{stop.name}</Text>
              <Text style={[styles.stopNodeTimeLabel, { color: colors.subtle }]}>{stop.time}</Text>
            </View>
            <Text style={[styles.stopCardTextExcerpt, { color: colors.muted }]} numberOfLines={2}>
              {stop.description}
            </Text>
            <View style={styles.tagPillsContainerCluster}>
              <View style={[styles.interiorCardTagPill, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                <Text style={[styles.interiorPillText, { color: colors.muted }]}>{stop.duration}</Text>
              </View>
              {(stop.tags || []).slice(0, 1).map((tag) => (
                <View key={tag} style={[styles.interiorCardTagPill, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                  <Text style={[styles.interiorPillText, { color: colors.muted }]}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderHotspotActivity = (hotspot) => {
    const selected = Boolean(activities[hotspot.id]);
    const isUnavailable = hotspot.opening_hours?.status === 'unavailable';

    return (
      <View
        key={hotspot.id}
        style={[
          styles.activityRowCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
          selected && styles.activityRowCardActive,
          selected && { backgroundColor: colors.accentSoft, borderColor: colors.accent },
          (isPlanLocked || isUnavailable) && styles.lockedSelectionCard,
        ]}
      >
        <TouchableOpacity
          style={styles.activityPressArea}
          onPress={() => navigation.navigate('HotspotDetail', { hotspotId: hotspot.id })}
          activeOpacity={0.85}
        >
          <View style={styles.activityCardLeftInfo}>
            <View style={[styles.activityIconBox, { backgroundColor: colors.iconSurface }]}>
              {hotspot.image_url && (
                <RemoteImage sourcePath={hotspot.image_url} style={styles.activityImage} />
              )}
            </View>
            <View style={styles.activityTextWrap}>
              <Text style={[styles.activityMainTitleText, { color: colors.text }]} numberOfLines={2}>
                {hotspot.name}
              </Text>
              <Text style={[styles.activityCategoryText, { color: colors.subtle }]} numberOfLines={2}>
                {hotspot.category} • {hotspot.est_duration_mins} min
              </Text>
              <Text style={[styles.activityDescriptionText, { color: colors.muted }]} numberOfLines={3}>
                {hotspot.short_desc}
              </Text>
              {isUnavailable && (
                <Text style={[styles.activityAvailabilityText, { color: colors.danger }]}>
                  Closed to public visits
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.activityActionColumn}>
          <TouchableOpacity
            style={styles.checkboxTapTarget}
            onPress={() => toggleActivity(hotspot)}
            disabled={isPlanLocked}
            activeOpacity={0.8}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected, disabled: isPlanLocked }}
            accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${hotspot.name} from itinerary`}
          >
            <View style={[
              styles.nativeCheckboxOutline,
              { backgroundColor: colors.input, borderColor: colors.border },
              selected && styles.checkboxActiveState,
              selected && { borderColor: colors.accent },
              isPlanLocked && styles.lockedCheckbox,
            ]}>
              {selected && <Text style={[styles.checkboxCheckSymbol, { color: colors.accent }]}>✓</Text>}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ height: insets.top }} />

      {/* 1. STICKY TOP APP HEADER */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderColor: colors.border }]}>
        <View style={styles.headerLeftRow}>
          <AppleBackButton onPress={handleGoBack} />
        </View>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Settings')}>
          <Svg width="20" height="20" fill="none" stroke={colors.muted} strokeWidth="2" viewBox="0 0 24 24">
            <Path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <Path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* 2. CORE UTILITY FLOW WORKSPACE */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollPadding}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Hero Block */}
        <View style={styles.heroBlock}>
          <Text style={[styles.mainHeadline, { color: colors.text }]}>Plan Your Journey</Text>
          <Text style={[styles.heroSubtitle, { color: colors.muted }]}>
            Select your preferred destinations and customize your itinerary settings to generate a personalized route.
          </Text>
        </View>

        {/* PREFERENCES CONFIGURATION SELECT PANEL */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <Svg width="16" height="16" fill="none" stroke={colors.accent} strokeWidth="2" viewBox="0 0 24 24" style={styles.inlineIconMargin}>
              <Path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </Svg>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Preferences</Text>
          </View>

          <View style={styles.formGroupSpacing}>
            <PreferenceDropdown
              label="Budget (USD)"
              value={draft.budgetLevel}
              onChange={(val) => updateDraft({ budgetLevel: val })}
              options={BUDGET_OPTIONS}
              type="budget"
              disabled={isPlanLocked}
            />

            <PreferenceDropdown
              label="Available Time"
              value={draft.availableTime}
              onChange={(val) => updateDraft({ availableTime: val })}
              options={TIME_OPTIONS}
              type="time"
              disabled={isPlanLocked}
            />

            <StartTimePicker
              label="Start Tour Time"
              value={draft.startTime}
              onChange={(val) => updateDraft({ startTime: val })}
              disabled={isPlanLocked}
            />
          </View>
        </View>

        {/* PRIMARY LOCATION SELECT HIGHLIGHT */}
        <View style={styles.sectionContainerMargin}>
          <View style={styles.sectionHeaderRow}>
            <Svg width="16" height="16" fill="none" stroke={colors.accent} strokeWidth="2" viewBox="0 0 24 24" style={styles.inlineIconMargin}>
              <Path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <Path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </Svg>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Primary Location</Text>
          </View>

          <View style={[styles.parallaxCardWrapper, { borderColor: colors.accent, shadowColor: colors.accent }]}>
            <RemoteImage
              sourcePath={primaryLocationImage}
              style={styles.parallaxHeroImage}
              resizeMode="cover"
            />
            <View style={[styles.imageDimOverlay, { backgroundColor: colors.heroOverlay }]} />
            <View style={styles.parallaxCardTextOverlay}>
              <View style={styles.flexSplitRow}>
                <View>
                  <Text style={styles.parallaxCardHeadline}>Gyeongbokgung Palace</Text>
                  <Text style={[styles.parallaxAccentSubtext, { color: colors.accent }]}>The Heart of Old Seoul</Text>
                </View>
                <View style={[styles.whiteCheckCircle, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.blueCheckChar, { color: colors.accent }]}>✓</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* NEARBY ACTIVITIES SELECTION STACK */}
        <View style={styles.sectionContainerMargin}>
          <View style={styles.sectionHeaderRow}>
            <Svg width="16" height="16" fill="none" stroke={colors.accent} strokeWidth="2" viewBox="0 0 24 24" style={styles.inlineIconMargin}>
              <Path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </Svg>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Nearby Activities</Text>
          </View>

          <View style={styles.activityListContainer}>
            {hotspotsData.map(renderHotspotActivity)}
          </View>
          {isPlanLocked && (
            <Text style={[styles.lockedSelectionText, { color: colors.subtle }]}>
              Route inputs are locked after generation. Open locations to learn more, or save this route and create a new journey.
            </Text>
          )}

        </View>

        {hasGeneratedRoute && (
          <>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />

            {/* GENERATED ROUTE REAL-TIME PREVIEW TILES */}
            <View style={styles.sectionContainerMargin}>
              <View style={styles.routeSplitHeaderRow}>
                <View style={styles.routeHeaderMain}>
                  <View style={styles.badgeLabelContainerAlign}>
                  <Text style={[styles.routeHeadlineText, { color: colors.text }]}>Generated Route</Text>
                  <View style={[styles.aiBadgeTag, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                    <Text style={[styles.aiBadgeText, { color: colors.accent }]}>AI OPTIMIZED</Text>
                    </View>
                  </View>
                  <Text style={[styles.dragSubtextHelper, { color: colors.subtle }]}>
                    {routeHasTravelLegs ? 'Travel time is included between stops.' : 'Use the move controls to reorder your schedule.'}
                  </Text>
                </View>
                <View style={styles.rightAlignSummaryBlock}>
                  <Text style={[styles.durationSummaryText, { color: colors.text }]}>
                    {generatedItinerary?.duration || draft.availableTime.replace(/[()]/g, '')}
                  </Text>
                  <Text style={[styles.dragSubtextHelper, { color: colors.subtle }]}>Estimated Duration</Text>
                </View>
              </View>

              <View style={styles.timelineStructuralTrack}>
                <View style={[styles.timelineLine, { backgroundColor: colors.border }]} pointerEvents="none" />
                {routeStops.length ? (
                  routeStops.map(renderRouteStop)
                ) : (
                  <View style={styles.emptyRoutePreview}>
                    <Text style={[styles.dragSubtextHelper, { color: colors.subtle }]}>
                      The itinerary was created, but no stops were returned.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}

      </ScrollView>

      {/* 3. PERSISTENT LOWER HORIZONTAL FOOTER INTERACTION UTILITY DOCK */}
      <View style={[styles.bottomStickyActionTray, { backgroundColor: colors.panel, borderColor: colors.border }]}>
        {!hasGeneratedRoute && (
          <TouchableOpacity
            style={styles.aiFillToggleRow}
            onPress={toggleAiFill}
            activeOpacity={0.8}
          >
            <View style={[
              styles.aiFillCheckbox,
              { backgroundColor: colors.input, borderColor: colors.border },
              draft.allowAiFill && styles.aiFillCheckboxActive,
              draft.allowAiFill && { backgroundColor: colors.accentSoft, borderColor: colors.accent },
            ]}>
              {draft.allowAiFill && <Text style={[styles.aiFillCheckText, { color: colors.accent }]}>✓</Text>}
            </View>
            <Text style={[styles.aiFillToggleText, { color: colors.muted }]}>
              AI can fill if timeslots are too free
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.bottomHorizontalDockAlignRow}>
          <TouchableOpacity
            style={[
              styles.finalizePrimaryActionButton,
              { backgroundColor: colors.accent, shadowColor: colors.accent },
              isLoadingItinerary && styles.disabledButton,
            ]}
            onPress={handlePrimaryAction}
            disabled={isLoadingItinerary}
          >
            {isLoadingItinerary ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={[styles.finalizeButtonText, { color: colors.onAccent }]}>
                {hasGeneratedRoute ? 'Save & View Itineraries' : '✨ Generate Itinerary'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        {bottomError && !timeBudgetWarning && (
          <Text style={[styles.errorText, styles.finalizeErrorText, { color: colors.danger }]}>{bottomError}</Text>
        )}
      </View>

      {isLoadingItinerary && (
        <View style={[styles.generationNoticeOverlay, { top: insets.top + 68 }]} pointerEvents="none">
          <View style={[styles.generationNoticePanel, { backgroundColor: colors.panel, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <View style={[styles.generationNoticeIcon, { backgroundColor: colors.accentSoft }]}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
            <View style={styles.generationNoticeTextWrap}>
              <Text style={[styles.generationNoticeTitle, { color: colors.text }]}>Generating itinerary</Text>
              <Text style={[styles.generationNoticeSubtitle, { color: colors.muted }]}>
                This may take a while. Click into (...) to learn more
              </Text>
            </View>
          </View>
        </View>
      )}

      <TimeBudgetWarningModal
        visible={Boolean(timeBudgetWarning)}
        detail={timeBudgetWarning}
        onClose={() => setTimeBudgetWarning(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131313',
  },
  header: {
    backgroundColor: 'rgba(19, 19, 19, 0.9)',
    borderBottomWidth: 1,
    borderColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBrandText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5c77ff',
  },
  menuButton: {
    padding: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollPadding: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 180,
  },
  heroBlock: {
    alignItems: 'center',
    marginBottom: 40,
  },
  mainHeadline: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  sectionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  inlineIconMargin: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  formGroupSpacing: {
    gap: 16,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 6,
  },
  customSelectTrigger: {
    backgroundColor: '#131313',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lockedControl: {
    opacity: 0.55,
  },
  selectText: {
    color: '#ffffff',
    fontSize: 14,
  },
  dropdownCarat: {
    color: '#9ca3af',
    fontSize: 10,
  },
  sectionContainerMargin: {
    marginBottom: 24,
  },
  parallaxCardWrapper: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#5c77ff',
    height: 128,
    shadowColor: '#5c77ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  parallaxHeroImage: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  imageDimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(19, 19, 19, 0.4)',
  },
  parallaxCardTextOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  flexSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  parallaxCardHeadline: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 24,
  },
  parallaxAccentSubtext: {
    fontSize: 12,
    color: '#5c77ff',
    marginTop: 4,
  },
  whiteCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blueCheckChar: {
    color: '#5c77ff',
    fontSize: 12,
    fontWeight: '700',
  },
  activityListContainer: {
    gap: 8,
  },
  activityRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    padding: 12,
  },
  activityPressArea: {
    flex: 1,
    minWidth: 0,
  },
  activityRowCardActive: {
    borderColor: 'rgba(92, 119, 255, 0.72)',
    backgroundColor: 'rgba(92, 119, 255, 0.08)',
  },
  lockedSelectionCard: {
    opacity: 0.82,
  },
  activityCardLeftInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 12,
  },
  activityIconBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    overflow: 'hidden',
  },
  activityImage: {
    width: '100%',
    height: '100%',
  },
  activityTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  activityMainTitleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
    lineHeight: 18,
    flexShrink: 1,
  },
  activityCategoryText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    lineHeight: 16,
    flexShrink: 1,
  },
  activityDescriptionText: {
    fontSize: 11,
    color: '#9ca3af',
    lineHeight: 15,
    marginTop: 5,
    flexShrink: 1,
  },
  activityAvailabilityText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  activityActionColumn: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  checkboxTapTarget: {
    width: 34,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeCheckboxOutline: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#374151',
    backgroundColor: '#131313',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActiveState: {
    borderColor: '#5c77ff',
  },
  lockedCheckbox: {
    backgroundColor: '#202126',
  },
  checkboxCheckSymbol: {
    color: '#5c77ff',
    fontSize: 12,
    fontWeight: '700',
  },
  lockedSelectionText: {
    color: '#71717a',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
  },
  generationNoticeOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 80,
    alignItems: 'center',
  },
  generationNoticePanel: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(24, 24, 27, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
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
  generationNoticeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(92, 119, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(92, 119, 255, 0.28)',
  },
  generationNoticeTextWrap: {
    flex: 1,
    minWidth: 0,
    marginLeft: 16,
  },
  generationNoticeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  generationNoticeSubtitle: {
    fontSize: 12,
    color: '#a1a1aa',
    lineHeight: 17,
    marginTop: 4,
  },
  disabledButton: {
    opacity: 0.65,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 10,
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginVertical: 32,
  },
  routeSplitHeaderRow: {
    marginBottom: 32,
    gap: 12,
  },
  routeHeaderMain: {
    width: '100%',
    minWidth: 0,
  },
  badgeLabelContainerAlign: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  routeHeadlineText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 30,
    flexShrink: 1,
    minWidth: 0,
  },
  aiBadgeTag: {
    backgroundColor: 'rgba(6, 78, 59, 0.4)',
    borderColor: '#047857',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  aiBadgeText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '700',
  },
  dragSubtextHelper: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
    marginTop: 4,
    flexShrink: 1,
  },
  rightAlignSummaryBlock: {
    width: '100%',
    minWidth: 0,
    alignItems: 'flex-start',
  },
  durationSummaryText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 24,
    flexShrink: 1,
  },
  timelineStructuralTrack: {
    position: 'relative',
    paddingLeft: 40,
    width: '100%',
    minWidth: 0,
  },
  emptyRoutePreview: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    padding: 16,
  },
  timelineLine: {
    position: 'absolute',
    left: 20,
    top: 12,
    bottom: 24,
    width: 1,
    backgroundColor: '#333333',
  },
  stopsTimelineRow: {
    flexDirection: 'row',
    position: 'relative',
    marginBottom: 24,
    width: '100%',
    minWidth: 0,
    zIndex: 2,
  },
  circleNodeCountElement: {
    position: 'absolute',
    left: -40,
    top: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4b5563',
    backgroundColor: '#131313',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  activeBorderHighlightCircle: {
    borderColor: '#5c77ff',
    shadowColor: '#5c77ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  nodeCountActiveText: {
    color: '#5c77ff',
    fontWeight: '700',
    fontSize: 14,
  },
  nodeCountMutedText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  travelNodeCircle: {
    position: 'absolute',
    left: -34,
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#202126',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  travelNodeText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '800',
  },
  stopInfoDataCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    zIndex: 3,
  },
  travelInfoDataCard: {
    backgroundColor: '#151515',
    borderColor: '#242936',
    paddingVertical: 12,
  },
  reorderControls: {
    width: 36,
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  reorderMoveButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#131313',
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderMoveButtonDisabled: {
    opacity: 0.32,
  },
  reorderMoveText: {
    color: '#d1d5db',
    fontSize: 16,
    fontWeight: '800',
  },
  reorderMoveTextDisabled: {
    color: '#6b7280',
  },
  stopInfoCardCoreBody: {
    flex: 1,
    minWidth: 0,
  },
  stopCardHeaderSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 8,
    minWidth: 0,
  },
  stopNodeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
    minWidth: 0,
    lineHeight: 20,
  },
  travelNodeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d5db',
    flex: 1,
    minWidth: 0,
    lineHeight: 18,
  },
  stopNodeTimeLabel: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'right',
    maxWidth: 72,
    lineHeight: 15,
  },
  stopCardTextExcerpt: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 12,
    lineHeight: 18,
  },
  tagPillsContainerCluster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interiorCardTagPill: {
    backgroundColor: '#131313',
    borderColor: '#374151',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  travelCardTagPill: {
    backgroundColor: '#101113',
    borderColor: '#2f3746',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  interiorPillText: {
    color: '#d1d5db',
    fontSize: 10,
  },
  lunchIconCircleNodeElement: {
    position: 'absolute',
    left: -40,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#047857',
    backgroundColor: 'rgba(6, 78, 59, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  lunchIconChar: {
    fontSize: 14,
  },
  lunchSegmentBannerBox: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#131313',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 3,
  },
  lunchBannerTextWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  lunchBannerMainText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 18,
  },
  lunchBannerTimeText: {
    fontSize: 11,
    color: '#6b7280',
    marginLeft: 8,
  },
  bottomStickyActionTray: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(19, 19, 19, 0.95)',
    borderTopWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
    paddingBottom: 24,
    zIndex: 50,
  },
  bottomHorizontalDockAlignRow: {
    flexDirection: 'row',
    gap: 12,
  },
  aiFillToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
    maxWidth: '100%',
  },
  aiFillCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#374151',
    backgroundColor: '#131313',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  aiFillCheckboxActive: {
    borderColor: '#5c77ff',
    backgroundColor: 'rgba(92, 119, 255, 0.18)',
  },
  aiFillCheckText: {
    color: '#8ca1ff',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
  },
  aiFillToggleText: {
    color: '#d4d4d8',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    flexShrink: 1,
  },
  finalizeErrorText: {
    textAlign: 'center',
    marginTop: 8,
  },
  finalizePrimaryActionButton: {
    flex: 1,
    backgroundColor: '#5c77ff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5c77ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  finalizeButtonText: {
    color: '#131313',
    fontWeight: '700',
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1e1e1e',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  startTimeModalContent: {
    maxWidth: 360,
    padding: 20,
  },
  timePickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  timePickerHeaderTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  timePickerActionText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 56,
  },
  timePickerDoneText: {
    color: '#5c77ff',
    textAlign: 'right',
  },
  timePreviewPill: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(92, 119, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(92, 119, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  timePreviewText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  timePickerSectionLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  timePickerHourGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  timePickerChip: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePickerHourChip: {
    width: '22.5%',
  },
  timePickerSmallChip: {
    flex: 1,
  },
  timePickerChipActive: {
    backgroundColor: 'rgba(92, 119, 255, 0.16)',
    borderColor: '#5c77ff',
  },
  timePickerChipText: {
    color: '#d1d5db',
    fontSize: 15,
    fontWeight: '700',
  },
  timePickerChipTextActive: {
    color: '#6d85ff',
  },
  timePickerSplitRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timePickerSplitColumn: {
    flex: 1,
  },
  timePickerOptionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionsList: {
    gap: 8,
    marginBottom: 8,
  },
  optionItem: {
    backgroundColor: '#262626',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  optionItemActive: {
    borderColor: '#5c77ff',
    backgroundColor: 'rgba(92, 119, 255, 0.1)',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#d1d5db',
  },
  optionTextActive: {
    color: '#5c77ff',
    fontWeight: '600',
  },
  customInputContainer: {
    marginTop: 4,
  },
  customInputLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 12,
  },
  modalTextInput: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 12,
  },
  modalErrorText: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 12,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonRowItem: {
    flex: 1,
  },
  timeWarningButton: {
    marginTop: 16,
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#5c77ff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  timeWarningButtonText: {
    color: '#131313',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  modalButtonCancel: {
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalButtonSave: {
    backgroundColor: '#5c77ff',
  },
  modalButtonTextCancel: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonTextSave: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  modalWarningText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  stopsListContainer: {
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#262626',
    marginBottom: 16,
    gap: 8,
  },
  stopDurationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stopNameText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  stopDurationText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  stopNameTextSubtle: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  stopDurationTextSubtle: {
    fontSize: 13,
    color: '#6b7280',
  },
  budgetSummaryContainer: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#262626',
    paddingVertical: 12,
    marginBottom: 16,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabelText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  summaryValueText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  summaryLabelTextAlert: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
  summaryValueTextAlert: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '700',
  },
  modalWarningSubText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
  },
});
