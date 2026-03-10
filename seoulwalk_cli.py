#!/usr/bin/env python3
"""
SeoulWalk CLI Prototyper — Multi-turn conversation tester
Uses OpenRouter free-tier models.

Commands:
  move <location>     Update simulated GPS location
  time <time>         Update simulated time
  rag <context>       Update simulated RAG context
  model <name/#>      Switch LLM model
  models              List available models
  history             Show full conversation history
  reset               Clear conversation history
  quit / exit         Exit the CLI
  (anything else)     Send as a tourist message
"""

import json
import os
import re
import time
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# .env loader
# ---------------------------------------------------------------------------
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tour-guide-app", ".env")


def load_env(path: str) -> None:
    if not os.path.isfile(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


load_env(ENV_PATH)

api_key = os.getenv("EXPO_PUBLIC_OPENROUTER_API_KEY") or os.getenv("OPENROUTER_API_KEY")
if not api_key:
    raise EnvironmentError(
        "No OpenRouter API key found. Set EXPO_PUBLIC_OPENROUTER_API_KEY or "
        "OPENROUTER_API_KEY in your environment or in tour-guide-app/.env"
    )

# ---------------------------------------------------------------------------
# Available models
# ---------------------------------------------------------------------------
MODELS = {
    "nemotron": {
        "id": "nvidia/nemotron-3-nano-30b-a3b:free",
        "name": "NVIDIA Nemotron 3 Nano 30B A3B (free)",
    },
    "step": {
        "id": "stepfun/step-3.5-flash:free",
        "name": "StepFun Step 3.5 Flash (free)",
    },
}
DEFAULT_MODEL = "nemotron"

SYSTEM_PROMPT = """
## System Prompt for SeoulWalk AI Brain (v0.3)

You are SeoulWalk, a voice-first, multimodal AI tour guide for Gyeongbokgung Palace. You assist foreign tourists who are physically walking through the palace grounds.
### 1. Your Core Persona

You are a calm, observant local expert. Your primary duty is the user’s physical safety and clear spatial orientation. You guide the user "eyes-up," allowing them to experience the palace while you handle the logistics and history.
### 2. Absolute Spatial Grounding (The Zero-Guess Policy)

You must use egocentric directional language (ahead, to your left, behind you, turn around) to navigate the user, but only under strict conditions:

    Forbidden Guessing: You are strictly forbidden from using directional words (left, right, ahead, behind) for any landmark, shop, or object that is not explicitly located in the RAG_CONTEXT or LOCATION metadata.

    The "General Area" Fallback: If a user asks for a location (e.g., "Where is the hanbok shop?" or "Where is the restroom?") and it is not mapped in your context, you must say: "That is in the general area outside the palace, but I don't have its exact direction from here."

    No "Expert" Imagining: Do not use your internal training data to "guess" where things might be. If the RAG is silent, you are spatially silent. Guessing a direction is a safety risk.

### 3. Trust, Sources, and Uncertainty

Transparency is how you maintain the user's trust.

    Mandatory Grounding: Every logistical fact (prices, hours, rules) must be attributed to a source (e.g., "According to the official palace records," "Based on recent visitor reviews").

    Honest Uncertainty: If information is missing from the RAG_CONTEXT, admit it immediately: "I don't have that specific detail in my records." Do not try to fill the gap with plausible inventions.

    Fact Supremacy: Always prioritize the provided RAG_CONTEXT over your internal parametric knowledge.

### 4. Spoken UI & Safety

Your output is designed for Text-to-Speech (TTS) to be heard through earbuds while walking.

    Brevity: Keep responses to 2–4 short, clear sentences.

    Plain Text Only: Do not use markdown (no bolding, no bullet points, no asterisks).

    Safety Overrides: If the USER_STATE indicates the user is moving, keep instructions minimal. Remind them: "Watch your step as you head toward the courtyard."

    Accessible English: Use direct language. Avoid idioms, complex metaphors, or academic jargon.

### 5. Handling Injected Context

You will receive queries where words like "here," "now," and "this" have been replaced upstream by the system with specific names, times, or object descriptions.

    Seamless Integration: Speak naturally about these bracketed terms (e.g., if the user asks "What is [Geunjeongjeon]?", explain it as if they are looking right at it). Never mention that a "replacement" occurred.

### 6. Conditional Action Closures

Always end with a clear, low-effort next step, but only for known destinations.

    Known Locations: If the next destination is in your context, suggest it: "Shall we walk toward the pond which is just ahead on your right?"

    Unknown Locations: If you don't have a landmark's location (like a specific rental shop), do not suggest walking toward it. Instead, pivot to a known landmark: "I don't have the shop's location, but shall we continue toward the Throne Hall which is just ahead?"

### 7. Scope Constraints

You are an expert on Gyeongbokgung, nearby Seoul logistics, and Korean cultural etiquette. Politely steer the user back to the tour if they ask about unrelated topics.
"""


# ---------------------------------------------------------------------------
# SeoulWalk Tester
# ---------------------------------------------------------------------------
class SeoulWalkTester:
    def __init__(self, model_key: str = DEFAULT_MODEL):
        self.history = [{"role": "system", "content": SYSTEM_PROMPT}]
        self.current_location = "Gwanghwamun Gate (Main Entrance)"
        self.current_time = "Tuesday, 2:30 PM"
        self.rag_context = (
            "Tickets are 3,000 KRW for adults. Hanbok wearers enter free. "
            "Source: Official Gyeongbokgung Palace Website."
        )
        self.turn_count = 0
        self.model_key: str = ""
        self.model_id: str = ""
        self.model_name: str = ""
        self.set_model(model_key)

    def set_model(self, model_key: str) -> bool:
        """Switch to a model by alias or number (1-based)."""
        keys = list(MODELS.keys())
        # Try numeric index first
        if model_key.isdigit():
            idx = int(model_key) - 1
            if 0 <= idx < len(keys):
                model_key = keys[idx]
            else:
                return False
        if model_key not in MODELS:
            return False
        self.model_key = model_key
        self.model_id = MODELS[model_key]["id"]
        self.model_name = MODELS[model_key]["name"]
        return True

    # -- context injection ------------------------------------------------
    def inject_context(self, user_input: str) -> str:
        """Replace deictic words with current metadata (case-insensitive)."""
        out = re.sub(r"\bhere\b", f"[{self.current_location}]", user_input, flags=re.IGNORECASE)
        out = re.sub(r"\bnow\b", f"[{self.current_time}]", out, flags=re.IGNORECASE)
        out = re.sub(r"\bthis\b", "[the building in front of you]", out, flags=re.IGNORECASE)
        return out

    # -- API call ---------------------------------------------------------
    def get_response(self, user_input: str) -> tuple[str, float]:
        processed = self.inject_context(user_input)

        full_prompt = (
            f"LOCATION: {self.current_location}\n"
            f"TIME: {self.current_time}\n"
            f"RAG_CONTEXT: {self.rag_context}\n"
            f"USER: {processed}"
        )

        self.history.append({"role": "user", "content": full_prompt})

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = json.dumps({
            "model": self.model_id,
            "messages": self.history,
        }).encode()

        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=payload,
            headers=headers,
            method="POST",
        )

        start = time.time()
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read()
        elapsed = time.time() - start

        data = json.loads(body)
        choices = data.get("choices", [])
        if choices:
            reply = choices[0].get("message", {}).get("content", "(empty response)")
        else:
            error = data.get("error", {})
            reply = f"(API error: {error.get('message', json.dumps(data))})"

        self.history.append({"role": "assistant", "content": reply})
        self.turn_count += 1
        return reply, elapsed

    # -- helpers ----------------------------------------------------------
    def reset(self):
        self.history = [{"role": "system", "content": SYSTEM_PROMPT}]
        self.turn_count = 0

    def show_history(self):
        print("\n========== CONVERSATION HISTORY ==========")
        for i, msg in enumerate(self.history):
            role = msg["role"].upper()
            content = msg["content"]
            if role == "SYSTEM":
                print(f"[{i}] SYSTEM: (system prompt, {len(content)} chars)")
            else:
                preview = content[:200] + ("..." if len(content) > 200 else "")
                print(f"[{i}] {role}: {preview}")
        print(f"========== {self.turn_count} turn(s) ==========\n")


# ---------------------------------------------------------------------------
# CLI loop
# ---------------------------------------------------------------------------
def main():
    tester = SeoulWalkTester()

    print("╔══════════════════════════════════════════════════╗")
    print("║        SeoulWalk CLI Prototyper (Multi-Turn)     ║")
    print("╚══════════════════════════════════════════════════╝")
    print()
    print(f"  🤖 Model    : {tester.model_name}")
    print(f"  📍 Location : {tester.current_location}")
    print(f"  🕐 Time     : {tester.current_time}")
    print(f"  📚 RAG      : {tester.rag_context[:60]}...")
    print()
    print("  Commands: move | time | rag | model | models | history | reset | quit")
    print("─" * 52)

    while True:
        try:
            user_input = input("\n🧳 Tourist: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n👋 Goodbye!")
            break

        if not user_input:
            continue

        # -- meta commands ------------------------------------------------
        if user_input.lower() in ("quit", "exit"):
            print("👋 Goodbye!")
            break

        if user_input.lower() == "history":
            tester.show_history()
            continue

        if user_input.lower() == "reset":
            tester.reset()
            print("🔄 Conversation history cleared.")
            continue

        if user_input.lower().startswith("move "):
            new_loc = user_input[5:].strip()
            if new_loc:
                tester.current_location = new_loc
                print(f"  📍 GPS updated → {tester.current_location}")
            else:
                print("  ⚠️  Usage: move <location name>")
            continue

        if user_input.lower().startswith("time "):
            new_time = user_input[5:].strip()
            if new_time:
                tester.current_time = new_time
                print(f"  🕐 Time updated → {tester.current_time}")
            else:
                print("  ⚠️  Usage: time <simulated time>")
            continue

        if user_input.lower().startswith("rag "):
            new_rag = user_input[4:].strip()
            if new_rag:
                tester.rag_context = new_rag
                print(f"  📚 RAG updated → {tester.rag_context[:80]}")
            else:
                print("  ⚠️  Usage: rag <context text>")
            continue

        if user_input.lower() == "models":
            print("\n  Available models:")
            for i, (key, m) in enumerate(MODELS.items(), 1):
                marker = " ✅" if key == tester.model_key else ""
                print(f"    {i}. {m['name']} ({key}){marker}")
            print(f"\n  Switch with: model <name or number>")
            continue

        if user_input.lower().startswith("model "):
            choice = user_input[6:].strip().lower()
            if choice:
                if tester.set_model(choice):
                    print(f"  🤖 Model switched → {tester.model_name}")
                else:
                    print(f"  ⚠️  Unknown model '{choice}'. Type 'models' to see options.")
            else:
                print("  ⚠️  Usage: model <name or number>")
            continue

        # -- conversation turn --------------------------------------------
        print(f"  ⏳ Sending turn #{tester.turn_count + 1}...")

        try:
            reply, elapsed = tester.get_response(user_input)
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="replace")
            print(f"  ❌ HTTP {e.code}: {body[:300]}")
            continue
        except urllib.error.URLError as e:
            print(f"  ❌ Network error: {e.reason}")
            continue

        print(f"\n🏛️  SeoulWalk: {reply}")
        print(f"  ⏱️  {elapsed:.2f}s | Turn {tester.turn_count} | {tester.model_key} | History: {len(tester.history)} messages")


if __name__ == "__main__":
    main()
