# Developer Mode Live Traces Design

## Context

The app needs a developer mode that exposes model behavior and request internals without showing those details to regular users. The current backend already saves some artifacts and trace events: uploaded vision photos are written under `data/trace_artifacts/<session_id>/`, map snapshots are cached at `data/latest_map.png` and also saved as trace artifacts when attached to chat context, and selected backend events are persisted in SQLite.

Those existing artifacts are not the same as a developer-mode product. They are useful for logs and analysis, but the mobile chat UI does not currently request, store, or render a consistent per-response blackbox trace. Current responses can include `debug_trace`, but the shape is route-specific and always part of the response object when present rather than gated by a developer-mode request flag.

This design also folds in the provider-level vision fallback issue. OpenRouter can use `xiaomi/mimo-v2.5`, but NVIDIA NIM cannot use that model ID. The backend needs provider-specific model selection so the fallback uses a NVIDIA-compatible vision model, and developer mode should make the actual selected provider/model visible.

## Goal

Add a live-only developer diagnostics layer:

- Regular user mode shows the normal chat experience with no rich internals.
- Developer mode sends a backend flag for new chat and vision requests.
- Backend includes a structured `developer_trace` only when the flag is enabled.
- Frontend stores the trace on the returned assistant message.
- Chat UI shows compact model pills and a collapsed chevron section per traced assistant message.
- The expanded section displays request and response blackbox details in insertion order.
- Traces are not reconstructed from existing DB logs and are not added as a new persisted history feature.

## Recommended Approach

Use a live response trace envelope.

Backend responses keep their normal fields and add `developer_trace` only when the request explicitly asks for developer mode. The trace is attached to the current response and does not require database schema changes, migrations, retention policy changes, or a historical trace retrieval endpoint.

This approach is lower risk than always returning debug traces because normal users do not receive large internal payloads. It is also smaller than a persistence-first design because existing artifact saving can be referenced by path without building a new trace archive system.

## Settings UX

Add a `Developer Mode` toggle at the top of the Settings page, above or at the top of the current user settings cluster.

When disabled:

- Requests do not include the developer-mode flag.
- Existing assistant messages preserve trace data in local message state, but the trace UI is hidden while the global toggle is off.
- New responses do not include `developer_trace`.

When enabled:

- New chat and vision requests include `developer_mode: true`.
- New assistant responses can show model pills.
- Each traced assistant response gets a collapsed chevron row for detailed blackbox inspection.

## Backend Data Shape

The backend should return a structured, frontend-safe `developer_trace` object with these conceptual sections:

- `summary`: route type, total latency, fallback-used state, and final action if any.
- `models`: one pill per LLM or VLM call, including display label, provider, model, latency, token counts, token rate if available, and fallback role.
- `timeline`: ordered steps matching execution order. Examples: user prompt, user image artifact, user context, waypoint context, intent classification, web search, local search, geocode context, map snapshot artifact, VLM call, final text LLM call, final response.
- `artifacts`: saved image references such as `vision-upload.jpg` and `map-snapshot.png`; never raw base64.
- `errors`: sanitized provider or step errors relevant to fallback; no API keys, raw headers, or long provider error bodies.

Token usage and token-per-second values should be included only when the provider response exposes enough data. Missing token metrics should be omitted or displayed as unavailable, not guessed.

## Backend Flow

Add a `developer_mode` field to chat and vision request schemas. The frontend sends it only when the setting is enabled.

For text chat:

- Track request start time, context-building steps, model calls, fallback attempts, and final response timing.
- Return the normal `ChatResponse`.
- Add `developer_trace` only when `developer_mode` is true.

For vision chat:

- Track the uploaded image artifact reference.
- Track first-pass VLM provider/model, including fallback from OpenRouter to NVIDIA if it happens.
- Track the final text policy pass separately from the image-analysis pass.
- Return the normal `VisionChatResponse`.
- Add `developer_trace` only when `developer_mode` is true.

For provider-level vision fallback:

- Split vision model configuration by provider.
- Keep OpenRouter primary vision model configurable and defaulting to the current MiMo model.
- Add an explicit NVIDIA vision fallback model configuration. The practical default should be `google/gemma-4-31b-it` because NVIDIA lists it as a vision-language model with image input support. `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` is also multimodal and can be tested as an override, but its reasoning behavior should be handled deliberately before using it as the default.
- Ensure the NVIDIA request receives the NVIDIA model ID, not the OpenRouter model ID.
- Record both attempted and successful provider/model values in developer trace.

## Frontend Data Flow

Add `developerModeEnabled` to the app store with a setter and reset behavior.

Update chat and vision API calls to include `developer_mode: true` when the store setting is enabled.

When the backend returns `developer_trace`, attach it to the assistant message object. This keeps trace details tied to the response that produced them.

Developer-mode UI should not try to reconstruct traces for old messages from SQLite logs. Existing saved images can appear only when the live response trace references their artifact paths.

## Chat UI

For each assistant message:

- If developer mode is disabled, render normal chat only.
- If developer mode is enabled and the message has `developerTrace`, render compact model pills under the assistant bubble.
- The pills should show text such as model name, latency, provider, token counts, and fallback state when available.
- Render a chevron row for details, collapsed by default.
- Expanding the chevron shows the blackbox timeline in insertion order.

The UI should stay dense and utilitarian. Developer information belongs under the relevant assistant response, not in a separate full-screen debug page for this version.

## Error Handling

Developer trace collection should never break the user-facing response. If a timing field, token count, or artifact reference is missing, the backend should return the normal response and omit the missing trace field.

Provider fallback errors should be sanitized before being sent to the frontend. The trace can say that OpenRouter failed and NVIDIA handled the request, but it should not expose raw headers, API keys, raw base64, or long provider error bodies.

If developer mode is enabled but the backend cannot produce a trace, the frontend should simply render the normal response with no developer section.

## Testing

Backend tests should verify:

- Normal chat and vision requests omit `developer_trace`.
- Developer-mode chat and vision requests include `developer_trace`.
- Vision fallback retries NVIDIA with a NVIDIA-specific model ID.
- Developer trace records the successful provider/model and fallback-used state.
- Raw base64 images are not included in developer trace.
- Missing usage metrics do not fail the response.

Frontend tests or focused manual QA should verify:

- Settings shows a top-level Developer Mode toggle.
- Developer mode sends the backend flag for new chat and vision requests.
- Assistant messages store returned traces.
- Model pills render only when developer mode is enabled and a message has trace metadata.
- Chevron details are collapsed by default and expand to show timeline details.
- Normal mode remains visually clean.

## Scope

In scope:

- Live-only developer traces for new responses.
- Settings toggle.
- Request flag.
- Structured backend trace envelope.
- Provider-specific vision fallback model routing.
- Per-message frontend model pills and collapsed details.
- Tests for backend response gating and fallback model selection.

Out of scope:

- Historical trace reconstruction from database logs.
- New trace retrieval endpoints.
- Database schema changes.
- Persisting full blackbox traces for later inspection.
- Exposing raw uploaded image base64 in frontend traces.
- A separate developer dashboard screen.

## NVIDIA Model Selection

Use a configurable NVIDIA fallback model value. Default it to `google/gemma-4-31b-it` for the first implementation because NVIDIA documents it as supporting text and image inputs. Keep the value overrideable so `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` or another enabled NIM model can be selected after smoke testing without touching application logic.
