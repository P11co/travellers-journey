import { create } from 'zustand';
import {
  generateItinerary as generateItineraryRequest,
  getItinerary as getItineraryRequest,
  deleteItinerary as deleteItineraryRequest,
  getNaverMapLink,
  logActivity as logActivityRequest,
  sendChatMessage,
  sendVisionChat,
} from './services/apiService';

const ACTIVITY_HOTSPOTS = {
  mmca: 'MMCA Seoul',
  detailedPalace: 'Gyeongbokgung Palace',
  kyobo: 'Kyobo Bookstore Gwanghwamun',
  hanok: 'Bukchon Hanok Village',
};

const DEFAULT_NAVER_TARGET = {
  placeName: 'Gyeongbokgung Palace',
  lat: 37.5796,
  lng: 126.977,
};

const createLocalSessionId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const parseAvailableHours = (value) => {
  const match = String(value || '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 8;
};

const parseBudgetKrw = (value) => {
  const normalized = String(value || '').toLowerCase();
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

const getDraftHotspots = (draft) => {
  const selected = Object.entries(draft.activities || {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => ACTIVITY_HOTSPOTS[key])
    .filter(Boolean);

  return selected.length ? selected : [draft.primaryLocation];
};

const normalizeServerItinerary = (itinerary) => {
  const items = itinerary?.items || [];
  const totalMinutes = items.reduce(
    (sum, item) => sum + (Number(item.duration_minutes) || 0),
    0,
  );

  return {
    id: itinerary.session_id,
    sessionId: itinerary.session_id,
    name: `${itinerary.location || 'Seoul'} Tour`,
    location: itinerary.location || 'Gwanghwamun',
    duration: totalMinutes ? formatDuration(totalMinutes) : 'Flexible',
    stopCount: items.length,
    stops: items.map((item) => ({
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
      tags: item.estimated_cost_krw ? [`${item.estimated_cost_krw.toLocaleString()} KRW`] : ['FREE'],
    })),
    items,
    totalEstimatedCostKrw: itinerary.total_estimated_cost_krw || 0,
    createdAt: itinerary.created_at || new Date().toISOString(),
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
  draft: {
    primaryLocation: 'Gyeongbokgung Palace',
    budgetLevel: 'Standard',
    availableTime: 'Full Day (8 hrs)',
    startTime: '09:00',
    activities: {
      mmca: false,
      detailedPalace: true,
      kyobo: false,
      hanok: true,
    },
    stops: [],
  },

  // Chat
  chatMessages: [initialAssistantMessage],
  isChatLoading: false,
  chatError: null,

  // Active tour
  activeTourId: null,
  currentLocation: null,
  activityError: null,

  addItinerary: (itinerary) => {
    const id = itinerary.id || itinerary.sessionId || Date.now().toString();
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

  endTour: () => set({ activeTourId: null }),

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
      });

      const normalized = normalizeServerItinerary(response);
      set((state) => ({
        sessionId: response.session_id,
        generatedItinerary: normalized,
        itineraries: upsertById(state.itineraries, normalized),
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

  setCurrentLocation: ({ lat, lng, waypointId }) =>
    set({
      currentLocation: {
        lat,
        lng,
        waypointId: waypointId || null,
        timestamp: new Date().toISOString(),
      },
    }),

  sendMessage: async (text, context = {}) => {
    const message = text.trim();
    if (!message) return null;

    const state = get();
    const location = context.location || state.currentLocation || {};
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    set((current) => ({
      chatMessages: [...current.chatMessages, userMessage],
      isChatLoading: true,
      chatError: null,
    }));

    try {
      const response = await sendChatMessage({
        message,
        sessionId: context.sessionId || state.sessionId,
        lat: context.lat ?? location.lat,
        lng: context.lng ?? location.lng,
        waypointId: context.waypointId || location.waypointId,
      });

      let actionPayload = response.action_payload || null;
      if (response.action === 'OPEN_NAVER_MAP' && !actionPayload) {
        actionPayload = await get().buildNaverActionPayload();
      }

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toISOString(),
        action: response.action,
        actionPayload,
        waypointId: response.waypoint_id,
        webSearchUsed: response.web_search_used,
      };

      set((current) => ({
        sessionId: response.session_id,
        chatMessages: [...current.chatMessages, assistantMessage],
      }));

      return assistantMessage;
    } catch (error) {
      const errorMessage = {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        content: `I could not reach the SeoulWalk server. ${error.message}`,
        timestamp: new Date().toISOString(),
        isError: true,
      };
      set((current) => ({
        chatError: error.message,
        chatMessages: [...current.chatMessages, errorMessage],
      }));
      throw error;
    } finally {
      set({ isChatLoading: false });
    }
  },

  sendVisionMessage: async (imageBase64, text = 'What is this?', context = {}) => {
    const message = text.trim() || 'What is this?';
    const state = get();
    const location = context.location || state.currentLocation || {};
    const userMessage = {
      id: `user-vision-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      attachmentType: 'image',
    };

    set((current) => ({
      chatMessages: [...current.chatMessages, userMessage],
      isChatLoading: true,
      chatError: null,
    }));

    try {
      const response = await sendVisionChat({
        imageBase64,
        message,
        sessionId: context.sessionId || state.sessionId,
        lat: context.lat ?? location.lat,
        lng: context.lng ?? location.lng,
        waypointId: context.waypointId || location.waypointId,
        imageMimeType: context.imageMimeType,
      });

      const assistantMessage = {
        id: `assistant-vision-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toISOString(),
        waypointId: response.waypoint_id,
        identifiedSubject: response.identified_subject,
      };

      set((current) => ({
        sessionId: response.session_id,
        chatMessages: [...current.chatMessages, assistantMessage],
      }));

      return assistantMessage;
    } catch (error) {
      const errorMessage = {
        id: `assistant-vision-error-${Date.now()}`,
        role: 'assistant',
        content: `I could not process the image. ${error.message}`,
        timestamp: new Date().toISOString(),
        isError: true,
      };
      set((current) => ({
        chatError: error.message,
        chatMessages: [...current.chatMessages, errorMessage],
      }));
      throw error;
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
      return await getNaverMapLink(target);
    } catch {
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
