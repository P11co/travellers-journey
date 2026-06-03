# Developer Mode Live Traces

## Objective

Implement the approved live-only developer diagnostics layer from `docs/superpowers/specs/2026-06-03-developer-mode-live-traces-design.md`. New chat and vision responses should include a frontend-safe `developer_trace` only when developer mode is enabled, while normal user mode stays clean. The same work should fix provider-level vision fallback so OpenRouter uses MiMo and NVIDIA uses its own configurable fallback model, defaulting to `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`.

## Implementation Plan

- [ ] 1. Extend backend configuration in `server/config.py:75` with provider-specific vision model constants, preserving the current OpenRouter MiMo default and adding the NVIDIA Nemotron Omni fallback default.

- [ ] 2. Extend request and response schemas in `server/models.py:122` and `server/models.py:194` so chat and vision requests accept developer mode and responses can optionally carry `developer_trace`.

- [ ] 3. Refactor the backend LLM helper around `server/routers/chat.py:577` to return provider/model/timing/usage metadata internally while preserving existing caller behavior where plain text is enough.

- [ ] 4. Add a small trace-building helper in `server/routers/chat.py` that records ordered timeline steps, model pills, artifact references, sanitized fallback errors, and total request latency only when developer mode is requested.

- [ ] 5. Update normal text chat preparation and completion around `server/routers/chat.py:1270` and `server/routers/chat.py:1709` to populate `developer_trace` for live responses without exposing raw base64 or secrets.

- [ ] 6. Update `/chat/vision` around `server/routers/chat.py:1987` so first-pass image analysis uses an ordered provider plan: OpenRouter MiMo first, NVIDIA Nemotron Omni fallback second.

- [ ] 7. Update map-snapshot vision handling around `server/routers/chat.py:1560` so developer traces identify map artifacts and the vision model used without changing normal map behavior.

- [ ] 8. Update API request plumbing in `tour-guide-app/src/services/apiService.js:130` and `tour-guide-app/src/services/apiService.js:253` so chat and vision requests can send `developer_mode`.

- [ ] 9. Add `developerModeEnabled` store state and setter in `tour-guide-app/src/store.js:556`, reset it predictably, and attach returned `developer_trace` metadata to assistant messages.

- [ ] 10. Add a top-level Developer Mode toggle in `tour-guide-app/screens/settings_configuration_animated/index.js:141`, matching existing settings row patterns.

- [ ] 11. Render developer pills and collapsed chevron details under assistant messages in `tour-guide-app/screens/buddy_ai_chat_fullscreen_open_in_naver/index.js:285`, hiding the UI when developer mode is off.

- [ ] 12. Mirror the same developer trace display in `tour-guide-app/screens/buddy_ai_chat_overlay_true_60_height/index.js:233` if that overlay remains part of the active chat path.

- [ ] 13. Add backend tests in `tests/test_chat.py:86` and `tests/test_vision.py:62` covering developer trace gating, provider-specific fallback model selection, sanitized artifacts, and missing usage metrics.

- [ ] 14. Run targeted backend tests, Expo bundle validation, and a focused manual UI check or simulator check where feasible to verify settings toggle, request flag, model pills, and collapsed details.

## Verification Criteria

- Normal chat and vision responses do not include `developer_trace`.
- Developer-mode chat and vision responses include a structured `developer_trace` with summary, models, timeline, artifacts, and sanitized errors where relevant.
- OpenRouter vision requests use `xiaomi/mimo-v2.5`; NVIDIA fallback requests use `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` unless overridden by environment.
- Frontend sends `developer_mode: true` only when Developer Mode is enabled.
- Assistant messages show model pills and collapsed details only when Developer Mode is enabled and a trace exists.
- Raw base64 image payloads, API keys, raw headers, and long provider error bodies are absent from frontend traces.
- Existing normal chat, vision chat, map snapshot, quick replies, and voice behavior remain functional.

## Potential Risks and Mitigations

1. **Refactoring the shared LLM helper could break existing callers.**
   Mitigation: keep a compatibility wrapper or return path for callers that only need text, and cover fallback behavior with tests.

2. **Provider usage metrics may be missing or inconsistent.**
   Mitigation: treat token counts and token rate as optional trace fields and never block responses on missing metrics.

3. **Nemotron reasoning output could leak thinking traces.**
   Mitigation: preserve the existing thinking-strip behavior and add provider-specific request options where appropriate.

4. **Developer trace payloads could become too large for mobile rendering.**
   Mitigation: include compact summaries, artifact references instead of base64, and truncate large text fields in developer trace details.

5. **Duplicating trace UI across chat surfaces could drift.**
   Mitigation: factor shared formatting/rendering helpers if the two active chat surfaces both need the feature.

## Alternative Approaches

1. Return `debug_trace` for all users and hide it in frontend: less backend branching, but poor privacy and bandwidth behavior.
2. Persist full traces and add retrieval endpoints: better for post-hoc analysis, but outside the approved live-only scope.
3. Add only model pills without blackbox details: quicker UI work, but misses the requested input/output and step-latency diagnostics.
