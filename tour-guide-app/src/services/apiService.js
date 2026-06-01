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

export const buildApiUrl = (pathOrUrl) => {
  if (!pathOrUrl) return pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return buildUrl(pathOrUrl);
};

const normalizeErrorMessage = (payload, fallback) => {
  if (!payload) return fallback;
  if (typeof payload.detail === 'string') return payload.detail;
  if (payload.detail && typeof payload.detail === 'object' && typeof payload.detail.message === 'string') {
    return payload.detail.message;
  }
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

export function sendChatMessageStream({
  message,
  sessionId,
  lat,
  lng,
  waypointId,
  provider,
  modelOverride,
  onEvent,
}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let seenLength = 0;
    let buffer = '';
    let finalPayload = null;

    const processText = (text) => {
      buffer += text;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let event;
        try {
          event = JSON.parse(trimmed);
        } catch {
          return;
        }
        onEvent?.(event);
        if (event.type === 'done') {
          finalPayload = event;
        }
        if (event.type === 'error') {
          throw new ApiError(event.message || 'Streaming chat failed.');
        }
      });
    };

    xhr.open('POST', buildUrl('/chat/stream'));
    xhr.setRequestHeader('Accept', 'application/x-ndjson');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = DEFAULT_TIMEOUT_MS;

    xhr.onprogress = () => {
      try {
        const nextText = xhr.responseText.slice(seenLength);
        seenLength = xhr.responseText.length;
        processText(nextText);
      } catch (error) {
        xhr.abort();
        reject(error);
      }
    };

    xhr.onload = () => {
      try {
        const nextText = xhr.responseText.slice(seenLength);
        seenLength = xhr.responseText.length;
        processText(nextText);
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new ApiError(`Streaming chat failed with status ${xhr.status}.`, { status: xhr.status }));
          return;
        }
        if (!finalPayload) {
          reject(new ApiError('Streaming chat ended before the assistant finished.'));
          return;
        }
        resolve(finalPayload);
      } catch (error) {
        reject(error);
      }
    };

    xhr.onerror = () => reject(new ApiError('Unable to reach the SeoulWalk streaming API.'));
    xhr.ontimeout = () => reject(new ApiError('Streaming chat timed out.'));

    xhr.send(JSON.stringify({
      message,
      session_id: sessionId || undefined,
      latitude: lat ?? undefined,
      longitude: lng ?? undefined,
      waypoint_id: waypointId || undefined,
      provider: provider || undefined,
      model_override: modelOverride || undefined,
    }));
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

export async function transcribeAudio({
  uri,
  mimeType = 'audio/m4a',
  sessionId,
}) {
  const formData = new FormData();
  formData.append('audio', {
    uri,
    name: `seoulwalk-voice-${Date.now()}.m4a`,
    type: mimeType,
  });
  if (sessionId) {
    formData.append('session_id', sessionId);
  }

  try {
    const response = await fetch(buildUrl('/voice/transcribe'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      body: formData,
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
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || 'Unable to transcribe voice recording.');
  }
}

export async function synthesizeSpeech({
  text,
  sessionId,
  model,
}) {
  const payload = await request('/voice/synthesize', {
    method: 'POST',
    timeoutMs: 60000,
    body: {
      text,
      session_id: sessionId || undefined,
      model: model || undefined,
    },
  });

  return {
    ...payload,
    audio_url: buildApiUrl(payload?.audio_url),
  };
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

export function logTraceEvent({ sessionId, eventType, eventPayload = {}, source = 'frontend' }) {
  return request('/activity/trace', {
    method: 'POST',
    timeoutMs: 8000,
    body: {
      session_id: sessionId || undefined,
      event_type: eventType,
      event_payload: eventPayload,
      source,
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
  sendChatMessageStream,
  sendVisionChat,
  transcribeAudio,
  generateItinerary,
  getItinerary,
  reorderItinerary,
  deleteItinerary,
  getNaverMapLink,
  logActivity,
  logTraceEvent,
  getActivitySummary,
};
