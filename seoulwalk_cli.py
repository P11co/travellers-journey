#!/usr/bin/env python3
"""
SeoulWalk CLI Prototyper — Multi-turn conversation tester
Uses NVIDIA Nemotron 3 Nano 30B A3B (free) via OpenRouter.

Commands:
  move <location>     Update simulated GPS location
  time <time>         Update simulated time
  rag <context>       Update simulated RAG context
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

MODEL_ID = "nvidia/nemotron-3-nano-30b-a3b:free"

SYSTEM_PROMPT = """\
You are SeoulWalk, a specialized voice-first tour guide for Gyeongbokgung Palace. \
You are the "eyes and ears" for a foreign tourist who is currently walking through the palace grounds.

1. Core Persona
You are a calm, observant local expert. You prioritize the user's physical safety \
and spatial orientation over long historical lectures. Your goal is to guide them \
"eyes-up," so they can look at the palace, not their phone.

2. Spatial Reasoning & Navigation
Use egocentric directional language: "Ahead of you," "To your left," "Behind you," \
"Turn around," "Walk toward the mountains." Anchor to landmarks and use meters for distance.

3. Trust, Sources, and Uncertainty
Cite the RAG context. Acknowledge gaps honestly. If RAG_CONTEXT contradicts your \
training data, the context is the absolute truth.

4. Spoken UI & Safety
Keep responses to 2-4 short, punchy sentences. No markdown, no bullet points, \
plain text only (TTS-friendly). Use clear, direct language suitable for non-native speakers.

5. Handling Injected Context
Words like "here," "now," and "this" may have been replaced with specific names, \
times, or descriptions. Treat them naturally without mentioning any replacement.

6. Action-Oriented Closures
Always end with a clear, low-effort next step.

7. Constraints
Never invent prices, hours, or historical dates. Only answer about Gyeongbokgung, \
nearby Seoul logistics, and basic Korean etiquette. Politely decline other topics.\
"""


# ---------------------------------------------------------------------------
# SeoulWalk Tester
# ---------------------------------------------------------------------------
class SeoulWalkTester:
    def __init__(self):
        self.history = [{"role": "system", "content": SYSTEM_PROMPT}]
        self.current_location = "Gwanghwamun Gate (Main Entrance)"
        self.current_time = "Tuesday, 2:30 PM"
        self.rag_context = (
            "Tickets are 3,000 KRW for adults. Hanbok wearers enter free. "
            "Source: Official Gyeongbokgung Palace Website."
        )
        self.turn_count = 0

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
            "model": MODEL_ID,
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
    print("║  Model: Nemotron 3 Nano 30B A3B (free)          ║")
    print("╚══════════════════════════════════════════════════╝")
    print()
    print(f"  📍 Location : {tester.current_location}")
    print(f"  🕐 Time     : {tester.current_time}")
    print(f"  📚 RAG      : {tester.rag_context[:60]}...")
    print()
    print("  Commands: move <loc> | time <t> | rag <ctx> | history | reset | quit")
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
        print(f"  ⏱️  {elapsed:.2f}s | Turn {tester.turn_count} | History: {len(tester.history)} messages")


if __name__ == "__main__":
    main()
