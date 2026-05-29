"""
debug_dashboard.py — SeoulWalk Backend Debugger

Tests Chat, Vision, RAG, and Web Search endpoints.
Supports live model switching between OpenRouter and NVIDIA NIM.

Run:
    python scripts/debug_dashboard.py
"""

import gradio as gr
import httpx
import base64
import uuid
import json
from datetime import datetime

API_BASE = "http://localhost:8000"

import os

WAYPOINTS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
    "tour-guide-app/src/data/waypoints.json"
)

WAYPOINTS = ["None"]
WAYPOINT_COORDS = {}
try:
    with open(WAYPOINTS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        for wp in data:
            WAYPOINTS.append(wp["id"])
            WAYPOINT_COORDS[wp["id"]] = (wp["coordinates"]["latitude"], wp["coordinates"]["longitude"])
except Exception:
    pass

# Model catalogue — (display label, model_id, provider)
MODEL_CATALOGUE = {
    "NVIDIA NIM — Gemma 4 31B (default)":             ("google/gemma-4-31b-it",                               "nvidia"),
    "NVIDIA NIM — Nemotron Nano Omni 30B":            ("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",       "nvidia"),
    "OpenRouter — Gemma 4 26B":                       ("google/gemma-4-26b-a4b-it:free",                      "openrouter"),
    "OpenRouter — Nemotron Nano Omni 30B":            ("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",  "openrouter"),
}
MODEL_LABELS = list(MODEL_CATALOGUE.keys())
DEFAULT_MODEL_LABEL = MODEL_LABELS[0]


def format_trace_html(trace_data: dict) -> str:
    if not trace_data:
        return "<i>No trace data available.</i>"
        
    is_vision = "full_prompt" in trace_data and "messages_sent" not in trace_data
    html = '<div style="font-family: sans-serif; display: flex; flex-direction: column; gap: 10px; max-width: 800px; margin: 0 auto;">'
    
    def box(title, content, color):
        # Escape minimal HTML
        safe_content = str(content).replace("<", "&lt;").replace(">", "&gt;")
        return f"""
        <div style="border-left: 4px solid {color}; padding: 10px 15px; background: rgba(128,128,128,0.1); border-radius: 4px;">
            <div style="font-weight: bold; margin-bottom: 5px; color: {color};">{title}</div>
            <div style="font-size: 0.9em; white-space: pre-wrap; word-break: break-word;">{safe_content}</div>
        </div>
        <div style="text-align: center; color: #888;">↓</div>
        """
        
    if not is_vision:
        # Step 1: Classifier
        should_search = trace_data.get("should_search", False)
        decision = "Web Search (Tavily)" if should_search else "RAG (ChromaDB Vector Database)"
        html += box("1. Intent Classification", f"Decision: {decision}", "#3b82f6")
        
        # Step 2: Knowledge Retrieval
        search_block = trace_data.get("search_block", "")
        if search_block:
            snippet = search_block[:500] + ("..." if len(search_block) > 500 else "")
            html += box("2. Knowledge Retrieval", snippet, "#10b981")
        else:
            html += box("2. Knowledge Retrieval", "No external knowledge retrieved.", "#10b981")
            
        # Step 3: Spatial Context
        gps_context = trace_data.get("gps_context", "")
        if gps_context:
            html += box("3. Spatial Context (GPS)", gps_context, "#f59e0b")
            
        # Step 4: Final Prompt
        html += box("4. LLM Execution", "System prompt, history, and context assembled and sent to LLM.", "#8b5cf6")
        
    else:
        # Vision flow
        gps_context = trace_data.get("gps_context", "")
        if gps_context:
            html += box("1. Spatial Context (GPS)", gps_context, "#f59e0b")
        html += box("2. Vision Execution", "Image and prompt sent to Vision model.", "#8b5cf6")
        
    # Remove the last arrow
    html = html.rsplit('<div style="text-align: center; color: #888;">↓</div>', 1)[0]
    html += '</div>'
    
    # Details toggle for raw JSON
    raw_json = json.dumps(trace_data, indent=2).replace("<", "&lt;").replace(">", "&gt;")
    html += f'<details style="margin-top: 20px; color: #888;"><summary style="cursor: pointer;">View Raw JSON Trace</summary><pre style="font-size: 0.8em; margin-top: 10px;">{raw_json}</pre></details>'
    
    return html


def image_to_base64(filepath: str | None) -> str | None:
    if not filepath:
        return None
    with open(filepath, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def chat_fn(
    message: str,
    history: list,
    image,
    waypoint: str,
    session_id: str,
    model_label: str,
    lat: float,
    lng: float,
):
    """
    Sends a message to the backend /chat or /chat/vision endpoint.
    history is managed via gr.State — always a list of role/content dicts.
    Returns: (updated_state, updated_chatbot_display, session_id, debug_html).
    """
    if not message and image is None:
        return history, history, session_id, ""

    if not session_id:
        session_id = str(uuid.uuid4())

    wp_id = None if waypoint == "None" else waypoint
    is_vision = image is not None

    # Look up model + provider from catalogue
    model_id, provider = MODEL_CATALOGUE.get(model_label, MODEL_CATALOGUE[DEFAULT_MODEL_LABEL])

    # User-facing label
    ui_label = message or "What is this?"
    if is_vision:
        ui_label = f"📷 [Image] {ui_label}"

    history = history + [{"role": "user", "content": ui_label}]

    payload = {
        "message": message or "What is this?",
        "session_id": session_id,
        "waypoint_id": wp_id,
        "model_override": model_id,
        "provider": provider,
        "latitude": lat,
        "longitude": lng,
    }

    if is_vision:
        payload["image_base64"] = image_to_base64(image)
        payload["image_mime_type"] = "image/jpeg"
        endpoint = f"{API_BASE}/chat/vision"
    else:
        endpoint = f"{API_BASE}/chat"

    try:
        resp = httpx.post(endpoint, json=payload, timeout=90.0)
        trace_data = {}
        html_trace = ""

        if resp.status_code != 200:
            reply = f"❌ Backend Error {resp.status_code}:\n```\n{resp.text[:400]}\n```"
            html_trace = f"<div style='color: red;'>Backend Error: {resp.status_code}</div>"
        else:
            data = resp.json()
            reply = data.get("reply", "No reply received.")

            badges = [f"🤖 {model_label}"]
            if data.get("web_search_used"):
                badges.append("🔍 Web Search")
            elif not is_vision:
                badges.append("📚 RAG")
            if data.get("identified_subject"):
                badges.append(f"👁️ {data['identified_subject']}")
            if data.get("action"):
                badges.append(f"⚡ {data['action']}")
            if data.get("waypoint_id"):
                badges.append(f"📍 {data['waypoint_id']}")

            reply += f"\n\n*{' · '.join(badges)}*"
            
            trace_data = data.get("debug_trace", {})
            html_trace = format_trace_html(trace_data)

    except Exception as e:
        reply = f"❌ Request failed: {e}"
        html_trace = f"<div style='color: red;'>Error: {e}</div>"

    map_b64 = None
    try:
        if session_id:
            summary_resp = httpx.get(f"{API_BASE}/activity/{session_id}/summary", timeout=5.0)
            if summary_resp.status_code == 200:
                logs = summary_resp.json().get("logs", [])
                if logs and logs[-1].get("map_snapshot_b64"):
                    map_b64 = logs[-1]["map_snapshot_b64"]
    except Exception:
        pass

    history = history + [{"role": "assistant", "content": reply}]
    return history, history, session_id, html_trace, make_map_html(map_b64)


def make_map_html(map_b64: str | None) -> str:
    """Return HTML card structure rendering the map snapshot."""
    if not map_b64:
        return (
            '<div style="border: 2px dashed #ccc; padding: 20px; text-align: center; color: #777; border-radius: 8px;">'
            'No map snapshot generated yet. Send a GPS ping or chat to render.'
            '</div>'
        )
    return (
        f'<div style="border: 1px solid #ddd; padding: 8px; border-radius: 8px; background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: center;">'
        f'<img src="data:image/png;base64,{map_b64}" style="max-width: 100%; border-radius: 6px; display: inline-block;" />'
        f'</div>'
    )


def log_gps_fn(session_id: str, lat: float, lng: float):
    """Logs a simulated GPS ping to the backend activity log."""
    if not session_id:
        session_id = str(uuid.uuid4())
    try:
        resp = httpx.post(
            f"{API_BASE}/activity/log",
            json={"session_id": session_id, "latitude": lat, "longitude": lng},
            timeout=10.0,
        )
        if resp.status_code != 200:
            return session_id, f"❌ Failed to log: {resp.text}", make_map_html(None)
        
        summary_resp = httpx.get(f"{API_BASE}/activity/{session_id}/summary", timeout=10.0)
        if summary_resp.status_code == 200:
            data = summary_resp.json()
            summary_text = data.get("summary_text", "No summary.")
            logs = data.get("logs", [])
            map_b64 = None
            if logs and logs[-1].get("map_snapshot_b64"):
                map_b64 = logs[-1]["map_snapshot_b64"]
            return session_id, summary_text, make_map_html(map_b64)
        return session_id, f"Logged but summary failed: {summary_resp.status_code}", make_map_html(None)
    except Exception as e:
        return session_id, f"❌ Error: {e}", make_map_html(None)


def clear_fn():
    return [], [], "", None, "", "No travel history yet. Send a GPS ping to start tracking.", make_map_html(None)


def update_coordinates_from_waypoint(waypoint: str, current_lat: float, current_lng: float):
    """Update simulated Lat/Lng numbers when a waypoint is selected."""
    if waypoint in WAYPOINT_COORDS:
        lat, lng = WAYPOINT_COORDS[waypoint]
        return lat, lng
    return current_lat, current_lng


def run_routing_suite(model_label: str):
    """
    Automatically runs 4 test queries covering RAG, WEB_SEARCH, MAP_STATIC,
    and MAP_GEOCODE. Generates a Markdown report and returns HTML results.
    """
    model_id, provider = MODEL_CATALOGUE.get(model_label, MODEL_CATALOGUE[DEFAULT_MODEL_LABEL])
    test_session_id = f"test-{uuid.uuid4()}"

    cases = [
        {
            "name": "Case 1: RAG (Palace History)",
            "query": "Who built Gyeongbokgung Palace?",
            "expected_intent": "RAG",
            "lat": 37.5796,
            "lng": 126.9770,
            "waypoint_id": "main_gate"
        },
        {
            "name": "Case 2: WEB_SEARCH (Live Info)",
            "query": "What time does the palace close today?",
            "expected_intent": "WEB_SEARCH",
            "lat": 37.5796,
            "lng": 126.9770,
            "waypoint_id": "ticket_booth"
        },
        {
            "name": "Case 3: MAP_STATIC (Surroundings)",
            "query": "What buildings are around me?",
            "expected_intent": "MAP_STATIC",
            "lat": 37.5796,
            "lng": 126.9770,
            "waypoint_id": "main_gate"
        },
        {
            "name": "Case 4: MAP_GEOCODE (Specific Place)",
            "query": "Where is Kyobo Bookstore (교보문고)?",
            "expected_intent": "MAP_GEOCODE",
            "lat": 37.57017,
            "lng": 126.97682,
            "waypoint_id": None
        }
    ]

    results = []

    for case in cases:
        if case["lat"] and case["lng"]:
            try:
                httpx.post(
                    f"{API_BASE}/activity/log",
                    json={"session_id": test_session_id, "latitude": case["lat"], "longitude": case["lng"]},
                    timeout=10.0,
                )
            except Exception:
                pass

        payload = {
            "message": case["query"],
            "session_id": test_session_id,
            "waypoint_id": case["waypoint_id"],
            "model_override": model_id,
            "provider": provider,
            "latitude": case["lat"],
            "longitude": case["lng"],
        }

        try:
            resp = httpx.post(f"{API_BASE}/chat", json=payload, timeout=90.0)
            if resp.status_code == 200:
                data = resp.json()
                reply = data.get("reply", "")
                debug_trace = data.get("debug_trace", {})
                actual_intent = debug_trace.get("intent", "UNKNOWN")
                passed = actual_intent == case["expected_intent"]
            else:
                reply = f"Error: {resp.status_code} - {resp.text}"
                actual_intent = "ERROR"
                passed = False
        except Exception as e:
            reply = f"Exception: {e}"
            actual_intent = "ERROR"
            passed = False

        results.append({
            "name": case["name"],
            "query": case["query"],
            "expected": case["expected_intent"],
            "actual": actual_intent,
            "passed": passed,
            "reply": reply
        })

    # Generate Markdown report
    import os
    report_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    os.makedirs(report_dir, exist_ok=True)
    report_path = os.path.join(report_dir, f"routing_report_{test_session_id}.md")

    passed_count = sum(1 for r in results if r["passed"])

    report_content = f"""# SeoulWalk Intent Router Evaluation Report
**Model Evaluated:** {model_label}
**Model ID:** {model_id}
**Provider:** {provider}
**Session ID:** {test_session_id}
**Time of Run:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Summary
* **Total Cases:** {len(cases)}
* **Passed:** {passed_count} / {len(cases)} ({passed_count / len(cases) * 100:.1f}%)

| Case Name | Query | Expected Intent | Actual Intent | Status |
|---|---|---|---|---|
"""
    for r in results:
        status_icon = "✅ PASS" if r["passed"] else "❌ FAIL"
        report_content += f"| {r['name']} | `{r['query']}` | `{r['expected']}` | `{r['actual']}` | **{status_icon}** |\n"

    report_content += "\n## Detailed Results\n"
    for r in results:
        status_icon = "✅ PASS" if r["passed"] else "❌ FAIL"
        report_content += f"""
### {r['name']} ({status_icon})
* **Query:** `{r['query']}`
* **Expected Intent:** `{r['expected']}`
* **Actual Intent:** `{r['actual']}`

**Assistant Reply:**
{r['reply']}

---
"""
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_content)

    # Build HTML display
    html_out = '<div style="margin-top: 15px;">'
    html_out += f'<h3>Suite Summary: {passed_count} / {len(cases)} Cases Passed</h3>'
    html_out += '<table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-family: sans-serif;">'
    html_out += '<tr style="background: rgba(128,128,128,0.2);"><th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Case Name</th><th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Query</th><th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Expected</th><th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Actual</th><th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Status</th></tr>'

    for r in results:
        status_color = "#10b981" if r["passed"] else "#ef4444"
        status_text = "✅ PASS" if r["passed"] else "❌ FAIL"
        html_out += f'<tr>'
        html_out += f'<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">{r["name"]}</td>'
        html_out += f'<td style="padding: 10px; border: 1px solid #ddd;">"{r["query"]}"</td>'
        html_out += f'<td style="padding: 10px; border: 1px solid #ddd; text-align: center;"><code>{r["expected"]}</code></td>'
        html_out += f'<td style="padding: 10px; border: 1px solid #ddd; text-align: center;"><code>{r["actual"]}</code></td>'
        html_out += f'<td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: {status_color}; font-weight: bold;">{status_text}</td>'
        html_out += f'</tr>'
    html_out += '</table></div>'

    return html_out, gr.update(visible=True, value=report_path)


# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------
with gr.Blocks(title="SeoulWalk Debug Dashboard") as demo:

    # ---------- Header ----------
    with gr.Row():
        gr.Markdown("# 🚶 SeoulWalk — Backend Debugger")
        # Settings accordion acts as the ⚙️ panel
    
    with gr.Accordion("⚙️  Model Settings", open=False):
        gr.Markdown(
            "Switch the LLM used for the current session.\n"
            "- **OpenRouter** models use your `EXPO_PUBLIC_OPENROUTER_API_KEY`.\n"
            "- **NVIDIA NIM** models use your `NVIDIA_API_KEY`.\n"
            "- Reasoning models (Nemotron Omni) have `<think>` traces automatically stripped before display."
        )
        model_selector = gr.Dropdown(
            choices=MODEL_LABELS,
            value=DEFAULT_MODEL_LABEL,
            label="Active Model",
        )

    gr.Markdown(
        "Chat with the backend. Replies show which pipeline was used (RAG / Web Search) "
        "and the active model."
    )

    # ---------- State ----------
    history_state = gr.State([])
    session_id = gr.State("")

    # ---------- Main layout ----------
    with gr.Tabs():
        with gr.Tab("💬 Interactive Chat"):
            with gr.Row():
                # Chat panel
                with gr.Column(scale=3):
                    chatbot = gr.Chatbot(height=540)
                    with gr.Row():
                        msg = gr.Textbox(
                            placeholder="Ask about the palace, or upload an image for vision...",
                            container=False,
                            scale=4,
                        )
                        submit_btn = gr.Button("Send ↩", variant="primary", scale=1)

                # Sidebar
                with gr.Column(scale=1):
                    gr.Markdown("### 🗺️ Simulated GPS")
                    waypoint_dd = gr.Dropdown(
                        choices=WAYPOINTS, value="None", label="Waypoint"
                    )
                    
                    with gr.Row():
                        sim_lat = gr.Number(value=37.5796, label="Lat", precision=5)
                        sim_lng = gr.Number(value=126.9770, label="Lng", precision=5)
                    
                    log_gps_btn = gr.Button("📍 Log GPS Ping", variant="primary")
                    
                    activity_history_disp = gr.Textbox(
                        value="No travel history yet. Send a GPS ping to start tracking.",
                        label="Travel History Summary",
                        interactive=False,
                        lines=3
                    )
                    
                    map_snapshot_disp = gr.HTML(
                        value=make_map_html(None)
                    )
                    
                    image_input = gr.Image(
                        type="filepath",
                        label="📷 Image → routes to /chat/vision",
                    )
                    gr.Markdown("---")
                    clear_btn = gr.Button("🗑  Clear & New Session", variant="secondary")
                    gr.Markdown(
                        "<small>Session ID is auto-generated and persisted per tab "
                        "so conversation history is maintained across turns.</small>"
                    )

        with gr.Tab("🚥 Routing Evaluation"):
            gr.Markdown(
                "### Automated 4-Way Intent Classifier Evaluation Suite\n"
                "Runs test queries covering RAG, WEB_SEARCH, MAP_STATIC, and MAP_GEOCODE to evaluate the classifier."
            )
            run_suite_btn = gr.Button("🚀 Run Routing Suite", variant="primary")
            suite_results_disp = gr.HTML(
                value='<div style="border: 1px dashed #ccc; padding: 20px; text-align: center; color: #777; border-radius: 8px; font-family: sans-serif;">'
                      'Click the button to run the routing test suite.'
                      '</div>'
            )
            report_file = gr.File(label="📥 Download Test Report", visible=False)

    with gr.Accordion("🛠️  Under the Hood (Debug Trace)", open=False):
        gr.Markdown("Visual timeline of the internal decision-making process for the latest interaction.")
        debug_html = gr.HTML()

    # ---------- Events ----------
    fn_inputs  = [msg, history_state, image_input, waypoint_dd, session_id, model_selector, sim_lat, sim_lng]
    fn_outputs = [history_state, chatbot, session_id, debug_html, map_snapshot_disp]

    msg.submit(chat_fn, fn_inputs, fn_outputs).then(lambda: "", outputs=[msg])
    submit_btn.click(chat_fn, fn_inputs, fn_outputs).then(lambda: "", outputs=[msg])
    
    log_gps_btn.click(
        log_gps_fn,
        inputs=[session_id, sim_lat, sim_lng],
        outputs=[session_id, activity_history_disp, map_snapshot_disp]
    )
    
    waypoint_dd.change(
        update_coordinates_from_waypoint,
        inputs=[waypoint_dd, sim_lat, sim_lng],
        outputs=[sim_lat, sim_lng]
    )
    
    clear_btn.click(
        clear_fn, 
        outputs=[history_state, chatbot, session_id, image_input, debug_html, activity_history_disp, map_snapshot_disp]
    )

    run_suite_btn.click(
        run_routing_suite,
        inputs=[model_selector],
        outputs=[suite_results_disp, report_file],
    )


if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7888)
