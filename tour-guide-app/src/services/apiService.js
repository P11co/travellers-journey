const DEFAULT_BASE_URL = 'http://localhost:8000';
const DEFAULT_TIMEOUT_MS = 120000;

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || DEFAULT_BASE_URL
).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status, payload } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

const buildUrl = (path) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

const normalizeErrorMessage = (payload, fallback) => {
  if (!payload) return fallback;
  if (typeof payload.detail === 'string') return payload.detail;
  if (payload.detail) return JSON.stringify(payload.detail);
  if (typeof payload.message === 'string') return payload.message;
  return fallback;
};

async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers,
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildUrl(path), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { detail: text };
      }
    }

    if (!response.ok) {
      throw new ApiError(
        normalizeErrorMessage(payload, `Request failed with status ${response.status}`),
        { status: response.status, payload },
      );
    }

    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError('Request timed out. The AI service may still be generating a response.');
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || 'Unable to reach the SeoulWalk API.');
  } finally {
    clearTimeout(timeout);
  }
}

export function healthCheck() {
  return request('/health', { timeoutMs: 8000 });
}

export function sendChatMessage({
  message,
  sessionId,
  lat,
  lng,
  waypointId,
  provider,
  modelOverride,
}) {
  return request('/chat', {
    method: 'POST',
    body: {
      message,
      session_id: sessionId || undefined,
      latitude: lat ?? undefined,
      longitude: lng ?? undefined,
      waypoint_id: waypointId || undefined,
      provider: provider || undefined,
      model_override: modelOverride || undefined,
    },
  });
}

export function sendVisionChat({
  imageBase64,
  message = 'What is this?',
  sessionId,
  lat,
  lng,
  waypointId,
  imageMimeType = 'image/jpeg',
}) {
  return request('/chat/vision', {
    method: 'POST',
    body: {
      message,
      image_base64: imageBase64,
      image_mime_type: imageMimeType,
      session_id: sessionId || undefined,
      latitude: lat ?? undefined,
      longitude: lng ?? undefined,
      waypoint_id: waypointId || undefined,
    },
  });
}

export function generateItinerary({
  location,
  hotspots,
  budgetKrw,
  availableHours,
  startTime = '10:00',
  sessionId,
  allowAiFill = false,
}) {
  return request('/itinerary/generate', {
    method: 'POST',
    body: {
      location,
      hotspots,
      budget_krw: budgetKrw ?? undefined,
      available_hours: availableHours,
      start_time: startTime,
      session_id: sessionId || undefined,
      allow_ai_fill: allowAiFill,
    },
  });
}

export function getItinerary(sessionId) {
  return request(`/itinerary/${encodeURIComponent(sessionId)}`);
}

export function reorderItinerary(sessionId, newOrder) {
  return request(`/itinerary/${encodeURIComponent(sessionId)}/reorder`, {
    method: 'PUT',
    body: {
      item_order: newOrder,
    },
  });
}

export function deleteItinerary(sessionId) {
  return request(`/itinerary/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
}

export function getNaverMapLink({ placeName, lat, lng }) {
  return request('/handoff/naver-map', {
    method: 'POST',
    body: {
      place_name: placeName,
      latitude: lat,
      longitude: lng,
    },
  });
}

export function logActivity({ sessionId, lat, lng, timestamp }) {
  return request('/activity/log', {
    method: 'POST',
    body: {
      session_id: sessionId,
      latitude: lat,
      longitude: lng,
      timestamp: timestamp || undefined,
    },
  });
}

export function getActivitySummary(sessionId) {
  return request(`/activity/${encodeURIComponent(sessionId)}/summary`);
}

export default {
  API_BASE_URL,
  healthCheck,
  sendChatMessage,
  sendVisionChat,
  generateItinerary,
  getItinerary,
  reorderItinerary,
  deleteItinerary,
  getNaverMapLink,
  logActivity,
  getActivitySummary,
};
