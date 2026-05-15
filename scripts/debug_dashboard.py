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

API_BASE = "http://localhost:8000"

import os

WAYPOINTS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
    "tour-guide-app/src/data/waypoints.json"
)

WAYPOINTS = ["None"]
try:
    with open(WAYPOINTS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        WAYPOINTS.extend([wp["id"] for wp in data])
except Exception:
    pass

# Model catalogue — (display label, model_id, provider)
MODEL_CATALOGUE = {
    "OpenRouter — Gemma 4 26B (default)":      ("google/gemma-4-26b-a4b-it:free",                      "openrouter"),
    "OpenRouter — Nemotron Nano Omni 30B":      ("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",  "openrouter"),
    "NVIDIA NIM — Gemma 4 31B":                 ("google/gemma-4-31b-it",                               "nvidia"),
    "NVIDIA NIM — Nemotron Nano Omni 30B":      ("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",       "nvidia"),
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

    history = history + [{"role": "assistant", "content": reply}]
    return history, history, session_id, html_trace


def clear_fn():
    return [], [], "", None, ""


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

    with gr.Accordion("🛠️  Under the Hood (Debug Trace)", open=False):
        gr.Markdown("Visual timeline of the internal decision-making process for the latest interaction.")
        debug_html = gr.HTML()

    # ---------- Events ----------
    fn_inputs  = [msg, history_state, image_input, waypoint_dd, session_id, model_selector]
    fn_outputs = [history_state, chatbot, session_id, debug_html]

    msg.submit(chat_fn, fn_inputs, fn_outputs).then(lambda: "", outputs=[msg])
    submit_btn.click(chat_fn, fn_inputs, fn_outputs).then(lambda: "", outputs=[msg])
    clear_btn.click(clear_fn, outputs=[history_state, chatbot, session_id, image_input, debug_html])


if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
