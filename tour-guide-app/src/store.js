import { create } from 'zustand';
import {
  AudioModule,
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  setIsAudioActiveAsync,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import {
  generateItinerary as generateItineraryRequest,
  getItinerary as getItineraryRequest,
  reorderItinerary as reorderItineraryRequest,
  deleteItinerary as deleteItineraryRequest,
  getNaverMapLink,
  logActivity as logActivityRequest,
  logTraceEvent as logTraceEventRequest,
  sendChatMessage,
  sendChatMessageStream,
  sendVisionChat,
  synthesizeSpeech,
  requestTtsStreamTicket,
  transcribeAudio,
} from './services/apiService';
import hotspotsData from './data/hotspots.json';

let activeTtsPlayer = null;
let activeTtsSubscription = null;

const releaseActiveTtsPlayer = () => {
  if (activeTtsSubscription) {
    activeTtsSubscription.remove?.();
    activeTtsSubscription = null;
  }
  if (activeTtsPlayer) {
    try {
      activeTtsPlayer.pause?.();
      activeTtsPlayer.remove?.();
    } catch {
      // Audio player may already be released by the native layer.
    }
    activeTtsPlayer = null;
  }
};

const LEGACY_ACTIVITY_HOTSPOTS = {
  mmca: 'MMCA Seoul',
  detailedPalace: 'Gyeongbokgung Palace',
  kyobo: 'Kyobo Bookstore Gwanghwamun',
  hanok: 'Bukchon Hanok Village',
};

const HOTSPOTS_BY_ID = new Map(hotspotsData.map((hotspot) => [hotspot.id, hotspot]));
const DEFAULT_SELECTED_HOTSPOTS = new Set(['h_001', 'h_007']);

const buildInitialActivities = () =>
  Object.fromEntries(
    hotspotsData.map((hotspot) => [hotspot.id, DEFAULT_SELECTED_HOTSPOTS.has(hotspot.id)]),
  );

const createInitialDraft = () => ({
  primaryLocation: 'Gyeongbokgung Palace',
  budgetLevel: '$50',
  availableTime: 'Full Day (8 hrs)',
  startTime: '09:00',
  allowAiFill: false,
  activities: buildInitialActivities(),
  stops: [],
});

const DEFAULT_NAVER_TARGET = {
  placeName: 'Gyeongbokgung Palace',
  lat: 37.5796,
  lng: 126.977,
};

const NAVER_APP_NAME = 'com.seoulwalk.tourguide';

const WAYPOINT_NAVER_QUERIES = {
  main_gate: '광화문 경복궁',
  ticket_booth: '경복궁 매표소',
  geunjeongjeon: '근정전 경복궁',
  gyeonghoeru: '경회루 경복궁',
  national_palace_museum: '국립고궁박물관',
  heungnyemun: '흥례문 경복궁',
  sajeongjeon: '사정전 경복궁',
  gangnyeongjeon: '강녕전 경복궁',
  gyotaejeon: '교태전 경복궁',
  amisan: '아미산 경복궁',
  hyangwonjeong: '향원정 경복궁',
  national_folk_museum: '국립민속박물관',
  sinmumun: '신무문 경복궁',
  yeonchumun: '영추문 경복궁',
  geonchunmun: '건춘문 경복궁',
  sejong_statue: '세종대왕 동상 광화문광장',
  yi_sun_sin_statue: '이순신 장군 동상 광화문광장',
  cheonggyecheon_plaza: '청계천 광장',
  gwanghwamun_station_9: '광화문역 9번 출구',
  sejong_center: '세종문화회관',
};

const AMENITY_SEARCH_TERMS = [
  {
    triggers: ['bathroom', 'bathrooms', 'restroom', 'restrooms', 'toilet', 'toilets', 'washroom', 'wc'],
    query: 'bathroom',
    naverQuery: '화장실',
  },
  {
    triggers: ['pharmacy', 'pharmacies', 'drugstore', 'medicine'],
    query: 'pharmacy',
    naverQuery: '약국',
  },
  {
    triggers: ['convenience store', 'convenience stores', '7-eleven', 'cu store', 'gs25'],
    query: 'convenience store',
    naverQuery: '편의점',
  },
  {
    triggers: ['cafe', 'cafes', 'coffee', 'coffee shop'],
    query: 'cafe',
    naverQuery: '카페',
  },
  {
    triggers: ['subway', 'subways', 'metro', 'station', 'stations', 'train', 'trains', 'transit'],
    query: 'subway station',
    naverQuery: '지하철역',
  },
];

const detectAmenitySearch = (message) => {
  const normalized = String(message || '').toLowerCase();
  return AMENITY_SEARCH_TERMS.find(({ triggers }) => (
    triggers.some((trigger) => normalized.includes(trigger))
  )) || null;
};

const buildAmenityNaverPayload = ({ message, lat, lng }) => {
  const amenity = detectAmenitySearch(message);
  if (!amenity) return null;

  const encodedQuery = encodeURIComponent(amenity.naverQuery || amenity.query);
  return {
    place_name: amenity.query,
    query: amenity.query,
    naver_query: amenity.naverQuery || amenity.query,
    latitude: lat ?? null,
    longitude: lng ?? null,
    handoff_type: 'search',
    naver_app_url: `nmap://search?query=${encodedQuery}&appname=${NAVER_APP_NAME}`,
    naver_web_url: lat != null && lng != null
      ? `https://map.naver.com/v5/search/${encodedQuery}/@${lng},${lat},17z`
      : `https://map.naver.com/v5/search/${encodedQuery}`,
  };
};

const buildWaypointNaverPayload = ({ waypoint, lat, lng }) => {
  if (!waypoint?.name) return null;

  const searchQuery = WAYPOINT_NAVER_QUERIES[waypoint.id] || `${waypoint.name} 경복궁`;
  const encodedQuery = encodeURIComponent(searchQuery);
  const resolvedLat = lat ?? waypoint.lat ?? waypoint.latitude ?? waypoint.coordinates?.latitude ?? null;
  const resolvedLng = lng ?? waypoint.lng ?? waypoint.longitude ?? waypoint.coordinates?.longitude ?? null;
  return {
    place_name: waypoint.name,
    query: searchQuery,
    naver_query: searchQuery,
    latitude: resolvedLat,
    longitude: resolvedLng,
    handoff_type: 'search',
    naver_app_url: `nmap://search?query=${encodedQuery}&appname=${NAVER_APP_NAME}`,
    naver_web_url: resolvedLat != null && resolvedLng != null
      ? `https://map.naver.com/v5/search/${encodedQuery}/@${resolvedLng},${resolvedLat},17z`
      : `https://map.naver.com/v5/search/${encodedQuery}`,
  };
};

const createLocalSessionId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const createClientId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const USD_TO_KRW_BUDGET_RATE = 1350;

const parseAvailableHours = (value) => {
  const match = String(value || '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 8;
};

const parseBudgetKrw = (value) => {
  const normalized = String(value || '').toLowerCase();
  const usdMatch = normalized.match(/\$?\s*(\d+(?:\.\d+)?)/);
  if (usdMatch) return Math.round(Number(usdMatch[1]) * USD_TO_KRW_BUDGET_RATE);

  // Backward compatibility for any in-memory or persisted draft using old labels.
  if (normalized.includes('budget')) return 30000;
  if (normalized.includes('premium')) return 150000;
  if (normalized.includes('luxury')) return 300000;
  if (normalized.includes('standard')) return 70000;
  return undefined;
};

const formatDuration = (minutes) => {
  if (!minutes) return 'Flexible';
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} hour${hours === 1 ? '' : 's'}` : `${hours.toFixed(1)} hours`;
};

const parseTimeToMinutes = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return 9 * 60;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

const formatMinutesAsTime = (totalMinutes) => {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${meridiem}`;
};

const getStopCoords = (stop) => {
  if (!stop?.latitude || !stop?.longitude) return null;
  return {
    latitude: stop.latitude,
    longitude: stop.longitude,
  };
};

const getLocationCoords = (location) => {
  if (!location?.lat || !location?.lng) return null;
  return {
    latitude: location.lat,
    longitude: location.lng,
  };
};

const getDistanceInMeters = (a, b) => {
  const earthRadius = 6371000;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const deltaLat = (b.latitude - a.latitude) * Math.PI / 180;
  const deltaLng = (b.longitude - a.longitude) * Math.PI / 180;

  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const getNearestStop = (stops, currentLocation) => {
  const currentCoords = getLocationCoords(currentLocation);
  if (!currentCoords) return null;

  return (stops || []).reduce((nearest, stop) => {
    const stopCoords = getStopCoords(stop);
    if (!stopCoords) return nearest;

    const distance = getDistanceInMeters(currentCoords, stopCoords);
    if (!nearest || distance < nearest.distance) {
      return { stop, distance };
    }

    return nearest;
  }, null)?.stop || null;
};

/**
 * A travel leg is structurally identified by:
 *   1. Null latitude AND null longitude (real destinations always have coords)
 *   2. Place name starts with "Walk to " or "Taxi to " (case-insensitive)
 *
 * Using structural properties means this works correctly after GET/reorder
 * responses even though routing_source is not persisted to the database.
 */
const isTravelLeg = (stop) => {
  if (stop.latitude != null || stop.longitude != null) return false;
  const place = (stop.place || stop.name || '').toLowerCase();
  return place.startsWith('walk to ') || place.startsWith('taxi to ');
};


const getDraftHotspots = (draft) => {
  const selected = Object.entries(draft.activities || {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => HOTSPOTS_BY_ID.get(key)?.name || LEGACY_ACTIVITY_HOTSPOTS[key])
    .filter(Boolean);

  return selected.length ? selected : [draft.primaryLocation];
};

const normalizeServerItinerary = (itinerary) => {
  const items = itinerary?.items || [];
  const totalMinutes = items.reduce(
    (sum, item) => sum + (Number(item.duration_minutes) || 0),
    0,
  );
  const stops = items.map((item) => ({
    id: `${itinerary.session_id}-${item.order}`,
    order: item.order,
    name: item.place,
    place: item.place,
    time: item.time,
    description: item.activity,
    activity: item.activity,
    duration: formatDuration(item.duration_minutes),
    durationMinutes: item.duration_minutes,
    estimatedCostKrw: item.estimated_cost_krw,
    latitude: item.latitude,
    longitude: item.longitude,
    naverMapUrl: item.naver_map_url,
    routingSource: item.routing_source ?? null,
    isTravelLeg: isTravelLeg({
      place: item.place,
      latitude: item.latitude,
      longitude: item.longitude,
    }),
    tags: item.estimated_cost_krw ? [`${item.estimated_cost_krw.toLocaleString()} KRW`] : ['FREE'],
  }));

  return {
    id: itinerary.session_id,
    sessionId: itinerary.session_id,
    name: `${itinerary.location || 'Seoul'} Tour`,
    location: itinerary.location || 'Gwanghwamun',
    duration: totalMinutes ? formatDuration(totalMinutes) : 'Flexible',
    stopCount: stops.filter((stop) => !stop.isTravelLeg).length,
    stops,
    items,
    totalEstimatedCostKrw: itinerary.total_estimated_cost_krw || 0,
    createdAt: itinerary.created_at || new Date().toISOString(),
  };
};

const buildItemFromStop = (stop, order) => ({
  order,
  time: stop.time,
  place: stop.place || stop.name,
  activity: stop.activity || stop.description || '',
  duration_minutes: stop.durationMinutes || 60,
  estimated_cost_krw: stop.estimatedCostKrw || 0,
  latitude: stop.latitude ?? null,
  longitude: stop.longitude ?? null,
  naver_map_url: stop.naverMapUrl || null,
});

const applyStopOrder = (itinerary, orderedStops) => {
  const itemByOrder = new Map((itinerary.items || []).map((item) => [item.order, item]));
  const sessionId = itinerary.sessionId || itinerary.id;
  let runningTimeMinutes = parseTimeToMinutes(itinerary.stops?.[0]?.time || orderedStops[0]?.time);
  const stops = orderedStops.map((stop, index) => ({
    ...stop,
    id: `${sessionId}-${index + 1}`,
    order: index + 1,
    time: formatMinutesAsTime(
      orderedStops.slice(0, index).reduce(
        (minutes, previousStop) => minutes + (Number(previousStop.durationMinutes) || 0),
        runningTimeMinutes,
      ),
    ),
  }));
  const items = orderedStops.map((stop, index) => ({
    ...(itemByOrder.get(stop.order) || buildItemFromStop(stop, index + 1)),
    order: index + 1,
    time: stops[index].time,
  }));

  return {
    ...itinerary,
    stops,
    items,
  };
};

const upsertById = (items, nextItem) => {
  const existingIndex = items.findIndex((item) => item.id === nextItem.id);
  if (existingIndex === -1) {
    return [nextItem, ...items];
  }
  return items.map((item, index) => (index === existingIndex ? nextItem : item));
};

const initialAssistantMessage = {
  id: 'initial-assistant',
  role: 'assistant',
  content: 'Hi, I am SeoulWalk. Ask me about the palace, nearby places, or where to go next.',
  timestamp: new Date().toISOString(),
};

const useAppStore = create((set, get) => ({
  // Session
  sessionId: null,

  // Itineraries
  itineraries: [],
  generatedItinerary: null,
  isLoadingItinerary: false,
  itineraryError: null,

  // Draft
  draft: createInitialDraft(),

  // Chat
  chatMessages: [initialAssistantMessage],
  chatWaypointContext: null,
  chatPhotoContext: null,
  isChatLoading: false,
  chatStreamStatus: null,
  chatError: null,

  // Active tour
  activeTourId: null,
  currentLocation: null,
  activityError: null,

  // Voice + appearance
  themeMode: 'dark',
  hotspotSuggestionsEnabled: false,
  voiceModeEnabled: false,
  voiceOutputProvider: 'deepgram',
  isRecording: false,
  isTranscribing: false,
  isSpeaking: false,
  voiceError: null,
  lastTranscript: null,
  voiceRecording: null,

  setThemeMode: (themeMode) => set({ themeMode }),
  setHotspotSuggestionsEnabled: (hotspotSuggestionsEnabled) => {
    set({ hotspotSuggestionsEnabled });
    get().logTraceEvent('hotspot_suggestions_toggled', { enabled: hotspotSuggestionsEnabled });
  },
  setVoiceModeEnabled: (voiceModeEnabled) => {
    set({ voiceModeEnabled });
    get().logTraceEvent('voice_mode_toggled', { enabled: voiceModeEnabled });
    if (!voiceModeEnabled) {
      get().stopSpeaking();
    }
  },
  setVoiceOutputProvider: (voiceOutputProvider) => {
    const normalized = voiceOutputProvider === 'system' ? 'system' : 'deepgram';
    set({ voiceOutputProvider: normalized });
    get().logTraceEvent('voice_output_provider_selected', { provider: normalized });
  },
  testVoiceOutput: async () => {
    await get().speakAssistantReply('Voice mode is ready.');
  },

  resetStudySession: async () => {
    const previousSessionId = get().sessionId;

    if (previousSessionId) {
      try {
        await get().logTraceEvent('study_session_ended', {
          previous_session_id: previousSessionId,
          ended_at: new Date().toISOString(),
        });
      } catch (error) {
        console.warn('Failed to log study session end', error);
      }
    }

    get().stopSpeaking();

    set({
      sessionId: null,
      itineraries: [],
      generatedItinerary: null,
      isLoadingItinerary: false,
      itineraryError: null,
      draft: createInitialDraft(),
      chatMessages: [{ ...initialAssistantMessage, timestamp: new Date().toISOString() }],
      chatWaypointContext: null,
      chatPhotoContext: null,
      isChatLoading: false,
      chatStreamStatus: null,
      chatError: null,
      activeTourId: null,
      currentLocation: null,
      activityError: null,
      isRecording: false,
      isTranscribing: false,
      isSpeaking: false,
      voiceError: null,
      lastTranscript: null,
      voiceRecording: null,
    });
  },

  addItinerary: (itinerary) => {
    const id = itinerary.id || itinerary.sessionId || createClientId('itinerary');
    const createdAt = itinerary.createdAt || new Date().toISOString();
    const nextItinerary = { id, createdAt, ...itinerary };

    set((state) => ({
      itineraries: upsertById(state.itineraries, nextItinerary),
    }));

    return id;
  },

  removeItinerary: async (id) => {
    set((state) => ({
      itineraries: state.itineraries.filter((it) => it.id !== id),
    }));

    try {
      await deleteItineraryRequest(id);
    } catch (error) {
      set({ itineraryError: error.message });
    }
  },

  startTour: (id) => {
    const itinerary = get().itineraries.find((item) => item.id === id);
    set({
      activeTourId: id,
      sessionId: itinerary?.sessionId || id || get().sessionId,
    });
  },

  endTour: () => set({ activeTourId: null, generatedItinerary: null }),

  getActiveItinerary: () => {
    const { itineraries, activeTourId, generatedItinerary } = get();
    return itineraries.find((it) => it.id === activeTourId) || generatedItinerary || null;
  },

  updateDraft: (updates) =>
    set((state) => ({
      generatedItinerary: null,
      draft: { ...state.draft, ...updates, stops: updates.stops || [] },
    })),

  toggleDraftActivity: (key) =>
    set((state) => ({
      generatedItinerary: null,
      draft: {
        ...state.draft,
        stops: [],
        activities: {
          ...state.draft.activities,
          [key]: !state.draft.activities[key],
        },
      },
    })),

  generateItinerary: async (overrides = {}) => {
    const { draft, sessionId } = get();

    set({ isLoadingItinerary: true, itineraryError: null });

    try {
      const response = await generateItineraryRequest({
        location: overrides.location || draft.primaryLocation,
        hotspots: overrides.hotspots || getDraftHotspots(draft),
        budgetKrw: overrides.budgetKrw ?? parseBudgetKrw(draft.budgetLevel),
        availableHours: overrides.availableHours ?? parseAvailableHours(draft.availableTime),
        startTime: overrides.startTime || draft.startTime,
        sessionId: overrides.sessionId || sessionId,
        allowAiFill: overrides.allowAiFill ?? draft.allowAiFill,
      });

      const normalized = normalizeServerItinerary(response);
      set((state) => ({
        sessionId: response.session_id,
        generatedItinerary: normalized,
        draft: {
          ...state.draft,
          stops: normalized.stops,
        },
      }));

      return normalized;
    } catch (error) {
      set({ itineraryError: error.message });
      throw error;
    } finally {
      set({ isLoadingItinerary: false });
    }
  },

  commitItinerary: (id) => {
    const { generatedItinerary, itineraries } = get();
    const itinerary = generatedItinerary || itineraries.find((item) => item.id === id);
    if (!itinerary) return null;

    set((state) => ({
      sessionId: itinerary.sessionId || itinerary.id,
      generatedItinerary: null,
      itineraries: upsertById(state.itineraries, itinerary),
    }));

    return itinerary.id;
  },

  finalizeDraft: async () => {
    const { generatedItinerary, generateItinerary } = get();
    if (generatedItinerary) {
      set({ sessionId: generatedItinerary.sessionId });
      return generatedItinerary.id;
    }

    const itinerary = await generateItinerary();
    return itinerary.id;
  },

  loadItinerary: async (sessionId) => {
    set({ isLoadingItinerary: true, itineraryError: null });

    try {
      const response = await getItineraryRequest(sessionId);
      const normalized = normalizeServerItinerary(response);
      set((state) => ({
        sessionId: response.session_id,
        generatedItinerary: normalized,
        itineraries: upsertById(state.itineraries, normalized),
      }));
      return normalized;
    } catch (error) {
      set({ itineraryError: error.message });
      throw error;
    } finally {
      set({ isLoadingItinerary: false });
    }
  },

  reorderGeneratedStop: async (fromDestIndex, toDestIndex) => {
    const { generatedItinerary } = get();
    const allStops = generatedItinerary?.stops || [];
    if (!generatedItinerary) return null;

    // Calculated travel legs must be regenerated by the backend if the
    // destination order changes. The legacy reorder endpoint only shuffles
    // existing rows, so block it for generated route skeletons.
    if (allStops.some((s) => isTravelLeg(s))) {
      return null;
    }

    // Split the flat stop list into destination stops. For legacy/generated
    // routes without calculated travel legs, this remains the full list.
    const destStops = allStops.filter((s) => !isTravelLeg(s));

    if (
      fromDestIndex === toDestIndex ||
      fromDestIndex < 0 ||
      toDestIndex < 0 ||
      fromDestIndex >= destStops.length ||
      toDestIndex >= destStops.length
    ) {
      return null;
    }

    // Reorder destination stops only.
    const reorderedDests = [...destStops];
    const [movedDest] = reorderedDests.splice(fromDestIndex, 1);
    reorderedDests.splice(toDestIndex, 0, movedDest);

    const serverOrder = reorderedDests.map((s) => s.order);
    const optimisticItinerary = applyStopOrder(generatedItinerary, reorderedDests);
    set((state) => ({
      generatedItinerary: optimisticItinerary,
      draft: {
        ...state.draft,
        stops: optimisticItinerary.stops,
      },
      itineraryError: null,
    }));

    try {
      const response = await reorderItineraryRequest(
        generatedItinerary.sessionId || generatedItinerary.id,
        serverOrder,
      );
      const normalized = normalizeServerItinerary(response);
      set((state) => ({
        generatedItinerary: normalized,
        draft: {
          ...state.draft,
          stops: normalized.stops,
        },
      }));
      return normalized;
    } catch (error) {
      set({ itineraryError: error.message });
      return optimisticItinerary;
    }
  },

  setCurrentLocation: ({ lat, lng, waypointId }) =>
    set({
      currentLocation: {
        lat,
        lng,
        waypointId: waypointId || null,
        timestamp: new Date().toISOString(),
      },
    }),

  logTraceEvent: async (eventType, eventPayload = {}) => {
    if (!eventType) return null;
    const sessionId = get().sessionId || createLocalSessionId();
    set({ sessionId });

    try {
      return await logTraceEventRequest({
        sessionId,
        eventType,
        eventPayload: {
          ...eventPayload,
          client_timestamp: new Date().toISOString(),
        },
      });
    } catch {
      return null;
    }
  },

  setChatWaypointContext: (waypoint) => {
    const nextContext = waypoint
      ? {
          id: waypoint.id,
          name: waypoint.name,
          summary: waypoint.summary || waypoint.knowledgeSummary || '',
          lat: waypoint.lat ?? waypoint.latitude ?? waypoint.coordinates?.latitude,
          lng: waypoint.lng ?? waypoint.longitude ?? waypoint.coordinates?.longitude,
          attachedAt: new Date().toISOString(),
        }
      : null;

    set({
      chatWaypointContext: nextContext,
    });

    if (nextContext) {
      get().logTraceEvent('waypoint_context_attached', {
        waypoint_id: nextContext.id,
        waypoint_name: nextContext.name,
        latitude: nextContext.lat,
        longitude: nextContext.lng,
      });
    }
  },

  clearChatWaypointContext: () => {
    const previous = get().chatWaypointContext;
    set({ chatWaypointContext: null });
    if (previous) {
      get().logTraceEvent('waypoint_context_removed', {
        waypoint_id: previous.id,
        waypoint_name: previous.name,
      });
    }
  },

  setChatPhotoContext: (photo) => {
    const nextContext = photo
      ? {
          imageBase64: photo.imageBase64,
          imageUri: photo.imageUri,
          imageMimeType: photo.imageMimeType || 'image/jpeg',
          attachedAt: photo.attachedAt || new Date().toISOString(),
        }
      : null;
    set({ chatPhotoContext: nextContext });
    if (nextContext) {
      get().logTraceEvent('photo_context_attached', {
        image_uri: nextContext.imageUri,
      });
    }
  },

  clearChatPhotoContext: () => {
    const previous = get().chatPhotoContext;
    set({ chatPhotoContext: null });
    if (previous) {
      get().logTraceEvent('photo_context_removed', {
        image_uri: previous.imageUri,
      });
    }
  },

  addAssistantNotice: async (content, { speak = false, eventType = 'assistant_notice_added' } = {}) => {
    const message = String(content || '').trim();
    if (!message) return null;

    const assistantMessage = {
      id: createClientId('assistant-notice'),
      role: 'assistant',
      content: message,
      timestamp: new Date().toISOString(),
    };

    set((current) => ({
      chatMessages: [...current.chatMessages, assistantMessage],
    }));

    get().logTraceEvent(eventType, {
      message_length: message.length,
      spoke: Boolean(speak),
    });

    if (speak) {
      await get().speakAssistantReply(message);
    }

    return assistantMessage;
  },

  speakSystemAssistantReply: async (text, { fallbackFrom } = {}) => {
    const content = String(text || '').trim();
    if (!content) return;

    try {
      await Speech.stop();
      releaseActiveTtsPlayer();
      await setIsAudioActiveAsync(true);
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
      });
      set({ isSpeaking: true, voiceError: null });
      get().logTraceEvent('voice_tts_started', {
        provider: 'system',
        fallback_from: fallbackFrom || null,
        text_length: content.length,
      });
      Speech.speak(content.replace(/[*_`~]/g, ''), {
        language: 'en-US',
        rate: 0.95,
        pitch: 1,
        volume: 1,
        onStart: () => {
          get().logTraceEvent('voice_tts_native_started', { provider: 'system' });
        },
        onDone: () => {
          set({ isSpeaking: false });
          get().logTraceEvent('voice_tts_completed', { provider: 'system', text_length: content.length });
        },
        onStopped: () => set({ isSpeaking: false }),
        onError: (error) => {
          set({
            isSpeaking: false,
            voiceError: error?.message || 'Text-to-speech failed.',
          });
        },
      });
    } catch (error) {
      set({
        isSpeaking: false,
        voiceError: error.message || 'Text-to-speech failed.',
      });
    }
  },

  speakDeepgramAssistantReply: async (text) => {
    const content = String(text || '').trim();
    if (!content) return;

    try {
      await Speech.stop();
      releaseActiveTtsPlayer();
      await setIsAudioActiveAsync(true);
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
      });

      set({ isSpeaking: true, voiceError: null });
      get().logTraceEvent('voice_tts_started', {
        provider: 'deepgram',
        text_length: content.length,
      });

      // --- Attempt 1: ticketed streaming path ---
      let streamTicket = null;
      try {
        streamTicket = await requestTtsStreamTicket({
          text: content.replace(/[*_`~]/g, ''),
          sessionId: get().sessionId,
        });
        get().logTraceEvent('voice_tts_stream_ticket_created', {
          provider: 'deepgram',
          model: streamTicket.model,
          stream_url: streamTicket.stream_url,
        });
      } catch (ticketError) {
        get().logTraceEvent('voice_tts_stream_ticket_failed', {
          provider: 'deepgram',
          error: ticketError.message || 'Stream ticket request failed',
          fallback_to: 'artifact',
        });
      }

      const audioSource = streamTicket
        ? { uri: streamTicket.stream_url }
        : null;

      // --- Attempt 2: saved-MP3 artifact fallback ---
      let artifactResponse = null;
      if (!audioSource) {
        artifactResponse = await synthesizeSpeech({
          text: content.replace(/[*_`~]/g, ''),
          sessionId: get().sessionId,
        });
      }

      const finalSource = audioSource || { uri: artifactResponse.audio_url };
      const resolvedModel = streamTicket?.model || artifactResponse?.model;
      const resolvedProvider = streamTicket ? 'deepgram_stream' : 'deepgram';

      activeTtsPlayer = createAudioPlayer(
        finalSource,
        { updateInterval: 250, keepAudioSessionActive: true },
      );
      activeTtsPlayer.volume = 1;
      let didLogLoaded = false;
      let didLogPlaying = false;
      let didHandlePlaybackError = false;
      activeTtsSubscription = activeTtsPlayer.addListener?.('playbackStatusUpdate', (status) => {
        if (status?.error && !didHandlePlaybackError) {
          didHandlePlaybackError = true;
          const playbackError = typeof status.error === 'string'
            ? status.error
            : 'Deepgram audio playback failed.';
          get().logTraceEvent('voice_tts_playback_failed', {
            provider: resolvedProvider,
            model: resolvedModel,
            audio_source: finalSource.uri,
            error: playbackError,
          });
          releaseActiveTtsPlayer();
          set({
            isSpeaking: false,
            voiceError: `${playbackError} Falling back to default voice.`,
          });
          get().speakSystemAssistantReply(content, { fallbackFrom: 'deepgram_playback' });
          return;
        }
        if (status?.isLoaded && !didLogLoaded) {
          didLogLoaded = true;
          get().logTraceEvent('voice_tts_playback_loaded', {
            provider: resolvedProvider,
            model: resolvedModel,
            duration: status.duration ?? null,
          });
        }
        if (status?.playing && !didLogPlaying) {
          didLogPlaying = true;
          get().logTraceEvent('voice_tts_playback_started', {
            provider: resolvedProvider,
            model: resolvedModel,
            current_time: status.currentTime ?? null,
          });
        }
        if (status?.didJustFinish) {
          releaseActiveTtsPlayer();
          set({ isSpeaking: false });
          get().logTraceEvent('voice_tts_completed', {
            provider: resolvedProvider,
            model: resolvedModel,
            text_length: content.length,
          });
        }
      });
      activeTtsPlayer.play();
      get().logTraceEvent('voice_tts_native_started', {
        provider: resolvedProvider,
        model: resolvedModel,
        audio_source: finalSource.uri,
      });
    } catch (error) {
      get().logTraceEvent('voice_tts_failed', {
        provider: 'deepgram',
        error: error.message || 'Deepgram text-to-speech failed.',
      });
      set({
        voiceError: `${error.message || 'Deepgram text-to-speech failed.'} Falling back to default voice.`,
      });
      await get().speakSystemAssistantReply(content, { fallbackFrom: 'deepgram' });
    }
  },

  speakAssistantReply: async (text) => {
    if (get().voiceOutputProvider === 'system') {
      return get().speakSystemAssistantReply(text);
    }
    return get().speakDeepgramAssistantReply(text);
  },

  stopSpeaking: async () => {
    try {
      await Speech.stop();
      releaseActiveTtsPlayer();
    } finally {
      set({ isSpeaking: false });
    }
  },

  startVoiceRecording: async () => {
    const current = get();
    if (current.isRecording || current.isTranscribing) return null;

    try {
      await get().stopSpeaking();
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Microphone permission was not granted.');
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      const recording = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await recording.prepareToRecordAsync();
      recording.record();
      set({
        voiceRecording: recording,
        isRecording: true,
        voiceError: null,
      });
      get().logTraceEvent('voice_recording_started', {});
      return recording;
    } catch (error) {
      set({
        isRecording: false,
        voiceRecording: null,
        voiceError: error.message || 'Could not start voice recording.',
      });
      return null;
    }
  },

  stopVoiceRecordingAndSend: async () => {
    const { voiceRecording, sessionId } = get();
    if (!voiceRecording) return null;

    set({ isRecording: false, isTranscribing: true, voiceError: null });
    try {
      await voiceRecording.stop();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      const uri = voiceRecording.uri || voiceRecording.getStatus?.()?.url;
      if (!uri) {
        throw new Error('Recording file was not created.');
      }

      get().logTraceEvent('voice_recording_stopped', { uri });
      const response = await transcribeAudio({
        uri,
        mimeType: 'audio/m4a',
        sessionId,
      });
      const transcript = response.transcript?.trim();
      if (!transcript) {
        throw new Error('No speech was detected.');
      }

      set({
        sessionId: response.session_id || sessionId,
        lastTranscript: transcript,
        voiceRecording: null,
        isTranscribing: false,
      });
      get().logTraceEvent('voice_transcription_received', {
        provider: response.provider,
        transcript_length: transcript.length,
        duration_ms: response.duration_ms,
      });
      return await get().sendMessage(transcript);
    } catch (error) {
      set({
        voiceRecording: null,
        isTranscribing: false,
        voiceError: error.message || 'Voice transcription failed.',
      });
      get().logTraceEvent('voice_transcription_failed', {
        error: error.message || 'Voice transcription failed.',
      });
      return null;
    }
  },

  sendMessage: async (text, context = {}) => {
    const message = text.trim();
    if (!message) return null;

    const state = get();
    const sessionId = context.sessionId || state.sessionId || createLocalSessionId();
    if (!state.sessionId) set({ sessionId });
    const location = context.location || state.currentLocation || {};
    const waypointContext = context.waypoint || state.chatWaypointContext || null;
    const waypointLat = waypointContext?.lat ?? waypointContext?.latitude ?? waypointContext?.coordinates?.latitude;
    const waypointLng = waypointContext?.lng ?? waypointContext?.longitude ?? waypointContext?.coordinates?.longitude;
    const userMessage = {
      id: createClientId('user'),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      contextWaypoint: waypointContext
        ? { id: waypointContext.id, name: waypointContext.name }
        : null,
    };
    const assistantId = createClientId('assistant-stream');
    const updateAssistantMessage = (patch) => {
      set((current) => ({
        chatMessages: current.chatMessages.map((chatMessage) => (
          chatMessage.id === assistantId
            ? {
                ...chatMessage,
                ...(typeof patch === 'function' ? patch(chatMessage) : patch),
              }
            : chatMessage
        )),
      }));
    };

    set((current) => ({
      chatMessages: [
        ...current.chatMessages,
        userMessage,
        {
          id: assistantId,
          role: 'assistant',
          content: 'Preparing context...',
          timestamp: new Date().toISOString(),
          isStreaming: true,
          isStatus: true,
        },
      ],
      isChatLoading: true,
      chatStreamStatus: 'Preparing context',
      chatError: null,
    }));

    get().logTraceEvent('chat_message_submitted', {
      message,
      message_length: message.length,
      waypoint_id: waypointContext?.id || location.waypointId || null,
      waypoint_name: waypointContext?.name || null,
      has_coordinates: Boolean((waypointLat ?? location.lat) && (waypointLng ?? location.lng)),
    });

    try {
      let streamedReply = '';
      const response = await sendChatMessageStream({
        message,
        sessionId,
        lat: context.lat ?? waypointLat ?? location.lat,
        lng: context.lng ?? waypointLng ?? location.lng,
        waypointId: context.waypointId || waypointContext?.id || location.waypointId,
        onEvent: (event) => {
          if (event.type === 'status') {
            const label = event.label || 'Thinking';
            set({ chatStreamStatus: label });
            if (!streamedReply) {
              updateAssistantMessage({
                content: `${label}...`,
                isStatus: true,
              });
            }
            return;
          }

          if (event.type === 'meta') {
            if (event.session_id) {
              set({ sessionId: event.session_id });
            }
            return;
          }

          if (event.type === 'delta' && event.text) {
            streamedReply += event.text;
            updateAssistantMessage({
              content: streamedReply,
              isStreaming: true,
              isStatus: false,
            });
          }
        },
      });

      const actionLat = context.lat ?? waypointLat ?? location.lat;
      const actionLng = context.lng ?? waypointLng ?? location.lng;
      let actionPayload = response.action_payload || null;
      if (response.action === 'OPEN_NAVER_MAP' && !actionPayload) {
        actionPayload = buildAmenityNaverPayload({
          message,
          lat: actionLat,
          lng: actionLng,
        }) || buildWaypointNaverPayload({
          waypoint: waypointContext,
          lat: actionLat,
          lng: actionLng,
        }) || await get().buildNaverActionPayload();
      }

      const assistantMessage = {
        id: assistantId,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toISOString(),
        action: response.action,
        actionPayload,
        waypointId: response.waypoint_id,
        webSearchUsed: response.web_search_used,
      };

      set(() => ({
        sessionId: response.session_id,
        chatStreamStatus: null,
        chatMessages: get().chatMessages.map((chatMessage) => (
          chatMessage.id === assistantId ? assistantMessage : chatMessage
        )),
      }));

      if (get().voiceModeEnabled && !context.suppressSpeech) {
        get().speakAssistantReply(response.reply);
      }

      get().logTraceEvent('chat_message_response_received', {
        response_waypoint_id: response.waypoint_id,
        action: response.action,
        web_search_used: response.web_search_used,
        reply_length: response.reply?.length || 0,
        backend_intent: response.debug_trace?.intent,
      });

      return assistantMessage;
    } catch (error) {
      get().logTraceEvent('chat_stream_failed_falling_back', {
        message,
        error: error.message,
        waypoint_id: waypointContext?.id || location.waypointId || null,
      });

      try {
        updateAssistantMessage({
          content: 'Finishing response...',
          isStreaming: true,
          isStatus: true,
        });

        const response = await sendChatMessage({
          message,
          sessionId,
          lat: context.lat ?? waypointLat ?? location.lat,
          lng: context.lng ?? waypointLng ?? location.lng,
          waypointId: context.waypointId || waypointContext?.id || location.waypointId,
        });

        const actionLat = context.lat ?? waypointLat ?? location.lat;
        const actionLng = context.lng ?? waypointLng ?? location.lng;
        let actionPayload = response.action_payload || null;
        if (response.action === 'OPEN_NAVER_MAP' && !actionPayload) {
          actionPayload = buildAmenityNaverPayload({
            message,
            lat: actionLat,
            lng: actionLng,
          }) || buildWaypointNaverPayload({
            waypoint: waypointContext,
            lat: actionLat,
            lng: actionLng,
          }) || await get().buildNaverActionPayload();
        }

        const assistantMessage = {
          id: assistantId,
          role: 'assistant',
          content: response.reply,
          timestamp: new Date().toISOString(),
          action: response.action,
          actionPayload,
          waypointId: response.waypoint_id,
          webSearchUsed: response.web_search_used,
        };

        set(() => ({
          sessionId: response.session_id,
          chatStreamStatus: null,
          chatMessages: get().chatMessages.map((chatMessage) => (
            chatMessage.id === assistantId ? assistantMessage : chatMessage
          )),
        }));

        if (get().voiceModeEnabled && !context.suppressSpeech) {
          get().speakAssistantReply(response.reply);
        }

        get().logTraceEvent('chat_message_response_received', {
          response_waypoint_id: response.waypoint_id,
          action: response.action,
          web_search_used: response.web_search_used,
          reply_length: response.reply?.length || 0,
          backend_intent: response.debug_trace?.intent,
          fallback_from_stream: true,
        });

        return assistantMessage;
      } catch (fallbackError) {
      const errorMessage = {
        id: assistantId,
        role: 'assistant',
        content: `I could not reach the SeoulWalk server. ${fallbackError.message}`,
        timestamp: new Date().toISOString(),
        isError: true,
      };
      set((current) => ({
        chatError: fallbackError.message,
        chatStreamStatus: null,
        chatMessages: current.chatMessages.map((chatMessage) => (
          chatMessage.id === assistantId ? errorMessage : chatMessage
        )),
      }));
      get().logTraceEvent('chat_message_failed', {
        message,
        error: fallbackError.message,
        waypoint_id: waypointContext?.id || location.waypointId || null,
      });
      return errorMessage;
      }
    } finally {
      set({ isChatLoading: false, chatStreamStatus: null });
    }
  },

  sendVisionMessage: async (imageBase64, text = 'What is this?', context = {}) => {
    const message = text.trim() || 'What is this?';
    const state = get();
    const location = context.location || state.currentLocation || {};
    const waypointContext = context.waypoint || state.chatWaypointContext || null;
    const waypointLat = waypointContext?.lat ?? waypointContext?.latitude ?? waypointContext?.coordinates?.latitude;
    const waypointLng = waypointContext?.lng ?? waypointContext?.longitude ?? waypointContext?.coordinates?.longitude;
    const imageMimeType = context.imageMimeType || 'image/jpeg';
    const imagePreviewUri = context.imageUri || (
      imageBase64 ? `data:${imageMimeType};base64,${imageBase64}` : null
    );
    const userMessage = {
      id: createClientId('user-vision'),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      attachmentType: 'image',
      attachmentUri: imagePreviewUri,
      attachmentMimeType: imageMimeType,
      contextWaypoint: waypointContext
        ? { id: waypointContext.id, name: waypointContext.name }
        : null,
    };

    set((current) => ({
      chatMessages: [...current.chatMessages, userMessage],
      isChatLoading: true,
      chatError: null,
    }));

    get().logTraceEvent('vision_message_submitted', {
      message,
      waypoint_id: waypointContext?.id || location.waypointId || null,
      waypoint_name: waypointContext?.name || null,
      has_coordinates: Boolean((waypointLat ?? location.lat) && (waypointLng ?? location.lng)),
      image_base64_chars: imageBase64?.length || 0,
    });

    try {
      const response = await sendVisionChat({
        imageBase64,
        message,
        sessionId: context.sessionId || state.sessionId,
        lat: context.lat ?? waypointLat ?? location.lat,
        lng: context.lng ?? waypointLng ?? location.lng,
        waypointId: context.waypointId || waypointContext?.id || location.waypointId,
        imageMimeType,
      });

      const actionLat = context.lat ?? waypointLat ?? location.lat;
      const actionLng = context.lng ?? waypointLng ?? location.lng;
      let actionPayload = response.action_payload || null;
      if (response.action === 'OPEN_NAVER_MAP' && !actionPayload) {
        actionPayload = buildAmenityNaverPayload({
          message,
          lat: actionLat,
          lng: actionLng,
        }) || buildWaypointNaverPayload({
          waypoint: waypointContext,
          lat: actionLat,
          lng: actionLng,
        }) || await get().buildNaverActionPayload();
      }

      const assistantMessage = {
        id: createClientId('assistant-vision'),
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toISOString(),
        action: response.action,
        actionPayload,
        waypointId: response.waypoint_id,
        identifiedSubject: response.identified_subject,
      };

      set((current) => ({
        sessionId: response.session_id,
        chatMessages: [...current.chatMessages, assistantMessage],
      }));

      if (get().voiceModeEnabled && !context.suppressSpeech) {
        get().speakAssistantReply(response.reply);
      }

      get().logTraceEvent('vision_message_response_received', {
        response_waypoint_id: response.waypoint_id,
        identified_subject: response.identified_subject,
        action: response.action,
        has_action_payload: Boolean(actionPayload),
        reply_length: response.reply?.length || 0,
      });

      return assistantMessage;
    } catch (error) {
      const errorMessage = {
        id: createClientId('assistant-vision-error'),
        role: 'assistant',
        content: `I could not process the image. ${error.message}`,
        timestamp: new Date().toISOString(),
        isError: true,
      };
      set((current) => ({
        chatError: error.message,
        chatMessages: [...current.chatMessages, errorMessage],
      }));
      get().logTraceEvent('vision_message_failed', {
        message,
        error: error.message,
        waypoint_id: waypointContext?.id || location.waypointId || null,
      });
      return errorMessage;
    } finally {
      set({ isChatLoading: false });
    }
  },

  buildNaverActionPayload: async () => {
    const { currentLocation, getActiveItinerary } = get();
    const activeItinerary = getActiveItinerary();
    const nearestStopWithCoords = getNearestStop(activeItinerary?.stops, currentLocation);
    const firstStopWithCoords = activeItinerary?.stops?.find(
      (stop) => stop.latitude && stop.longitude,
    );
    const stopTarget = nearestStopWithCoords || firstStopWithCoords;
    const target = stopTarget
      ? {
          placeName: stopTarget.name,
          lat: stopTarget.latitude,
          lng: stopTarget.longitude,
        }
      : currentLocation?.lat && currentLocation?.lng
        ? {
            placeName: 'Current SeoulWalk location',
            lat: currentLocation.lat,
            lng: currentLocation.lng,
          }
        : DEFAULT_NAVER_TARGET;

    try {
      const payload = await getNaverMapLink(target);
      get().logTraceEvent('naver_handoff_payload_created', {
        place_name: target.placeName,
        latitude: target.lat,
        longitude: target.lng,
      });
      return payload;
    } catch {
      get().logTraceEvent('naver_handoff_payload_fallback', {
        place_name: target.placeName,
        latitude: target.lat,
        longitude: target.lng,
      });
      return {
        place_name: target.placeName,
        naver_web_url: `https://map.naver.com/v5/search/${encodeURIComponent(target.placeName)}`,
      };
    }
  },

  logActivity: async (lat, lng) => {
    const sessionId = get().sessionId || createLocalSessionId();
    set({ sessionId, activityError: null });

    try {
      const response = await logActivityRequest({ sessionId, lat, lng });
      get().setCurrentLocation({
        lat,
        lng,
        waypointId: response.matched_waypoint_id,
      });
      return response;
    } catch (error) {
      set({ activityError: error.message });
      throw error;
    }
  },
}));

export default useAppStore;
