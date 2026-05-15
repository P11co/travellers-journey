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

try:
    import chromadb
    from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False

try:
    import numpy as np
    import sounddevice as sd
    import websocket
    import urllib.parse
    # from elevenlabs.client import ElevenLabs  # Commented out — switched to Deepgram TTS
    AUDIO_AVAILABLE = True
except ImportError:
    AUDIO_AVAILABLE = False

import json
import tempfile
import threading
import sys
import subprocess
import argparse
import time

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
# Voice Integration
# ---------------------------------------------------------------------------
class VoiceInterface:
    def __init__(self, assembly_key: str, deepgram_key: str):
        self.assembly_key = assembly_key
        self.deepgram_key = deepgram_key
        # self.eleven_client = ElevenLabs(api_key=eleven_key)  # Commented out — switched to Deepgram
        self.fs = 16000
        self.is_recording = False
        self.ws = None
        self.transcript = ""
        self.audio_thread = None

    def _record_thread(self, ws):
        frames_per_buffer = 800
        with sd.InputStream(samplerate=self.fs, channels=1, dtype='int16') as stream:
            while self.is_recording and ws and getattr(ws, 'sock', None) and ws.sock.connected:
                try:
                    data, overflowed = stream.read(frames_per_buffer)
                    ws.send(data.tobytes(), websocket.ABNF.OPCODE_BINARY)
                except Exception:
                    break

    def record_until_keypress(self) -> str:
        try:
            cmd = input("\n🎤 Press ENTER to start speaking (or type 'quit')...")
            if cmd.lower() in ("quit", "exit", "q"):
                return "quit"
        except (EOFError, KeyboardInterrupt):
            return "quit"
            
        print("🔴 Connecting to AssemblyAI...", end="", flush=True)
        self.transcript = ""
        self.is_recording = True
        
        params = {"sample_rate": self.fs, "speech_model": "u3-rt-pro"}
        endpoint = f"wss://streaming.assemblyai.com/v3/ws?{urllib.parse.urlencode(params)}"
        
        self.ws = websocket.WebSocketApp(
            endpoint,
            header={"Authorization": self.assembly_key},
            on_open=self._on_ws_open,
            on_message=self._on_ws_message,
            on_error=self._on_ws_error,
            on_close=self._on_ws_close
        )
        
        ws_thread = threading.Thread(target=self.ws.run_forever)
        ws_thread.daemon = True
        ws_thread.start()
        
        try:
            input()
        except (EOFError, KeyboardInterrupt):
            pass
            
        self.is_recording = False
        
        if self.ws and getattr(self.ws, 'sock', None) and self.ws.sock.connected:
            terminate_msg = {"type": "Terminate"}
            self.ws.send(json.dumps(terminate_msg))
            time.sleep(1.0) # give time to receive final message
            self.ws.close()
            
        ws_thread.join(timeout=2.0)
        
        # Clear the line on finish
        print("\r" + " " * 80 + "\r", end="", flush=True)
        return self.transcript.strip()

    def _on_ws_open(self, ws):
        print("\r🔴 Recording... (Press ENTER to stop)        ", end="", flush=True)
        self.audio_thread = threading.Thread(target=self._record_thread, args=(ws,))
        self.audio_thread.daemon = True
        self.audio_thread.start()

    def _on_ws_message(self, ws, message):
        try:
            data = json.loads(message)
            if data.get('type') == 'Turn':
                text = data.get('transcript', '')
                formatted = data.get('turn_is_formatted', False)
                if formatted:
                    self.transcript += text + " "
                    print(f"\r💬 {self.transcript}", end='', flush=True)
                else:
                    print(f"\r💬 {self.transcript}{text}", end='', flush=True)
        except Exception:
            pass

    def _on_ws_error(self, ws, error):
        print(f"\n❌ AssemblyAI Error: {error}")
        self.is_recording = False

    def _on_ws_close(self, ws, status_code, msg):
        pass

    def speak(self, text: str):
        """Use Deepgram Aura TTS to speak the response."""
        clean_text = re.sub(r'[*_~`]', '', text)
        print("🔊 Playing audio response (Deepgram)...")
        try:
            url = "https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=mp3"
            payload = json.dumps({"text": clean_text}).encode()
            req = urllib.request.Request(
                url,
                data=payload,
                headers={
                    "Authorization": f"Token {self.deepgram_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                audio_data = resp.read()

            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                temp_mp3 = f.name
                f.write(audio_data)

            subprocess.run(["afplay", temp_mp3], stderr=subprocess.DEVNULL)
        except Exception as e:
            print(f"  ❌ Audio playback failed: {e}")
        finally:
            if 'temp_mp3' in locals() and os.path.exists(temp_mp3):
                os.remove(temp_mp3)

    # --- Original ElevenLabs TTS (commented out) ---
    # def speak_elevenlabs(self, text: str):
    #     clean_text = re.sub(r'[*_~`]', '', text)
    #     print("🔊 Playing audio response...")
    #     try:
    #         audio_stream = self.eleven_client.text_to_speech.convert(
    #             voice_id="EXAVITQu4vr4xnSDxMaL",
    #             output_format="mp3_44100_128",
    #             text=clean_text,
    #             model_id="eleven_multilingual_v2"
    #         )
    #         with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
    #             temp_mp3 = f.name
    #             for chunk in audio_stream:
    #                 if chunk:
    #                     f.write(chunk)
    #         subprocess.run(["afplay", temp_mp3], stderr=subprocess.DEVNULL)
    #     except Exception as e:
    #         print(f"  ❌ Audio playback failed: {e}")
    #     finally:
    #         if 'temp_mp3' in locals() and os.path.exists(temp_mp3):
    #             os.remove(temp_mp3)


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
        self.rag_top_k = 3
        self.rag_exclude_kr = True

        # Initialize ChromaDB
        self.chroma_collection = None
        if CHROMA_AVAILABLE:
            chroma_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "chroma_db")
            if os.path.exists(chroma_path):
                try:
                    client = chromadb.PersistentClient(path=chroma_path)
                    embedding_fn = SentenceTransformerEmbeddingFunction(
                        model_name="all-MiniLM-L6-v2",
                    )
                    self.chroma_collection = client.get_collection(
                        name="seoulwalk",
                        embedding_function=embedding_fn,
                    )
                except Exception as e:
                    print(f"  ⚠️  ChromaDB init failed: {e}. Using static RAG.")

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
    def search_rag(self, query: str) -> str:
        """Search ChromaDB for relevant context, return formatted string."""
        if not self.chroma_collection:
            return self.rag_context  # fallback to static

        try:
            where_filter = {"kr_only": False} if self.rag_exclude_kr else None
            results = self.chroma_collection.query(
                query_texts=[query],
                n_results=self.rag_top_k,
                where=where_filter,
                include=["documents", "metadatas", "distances"],
            )

            docs = results["documents"][0]
            metas = results["metadatas"][0]
            distances = results["distances"][0]

            if not docs:
                return self.rag_context

            parts = []
            for doc, meta, dist in zip(docs, metas, distances):
                sim = 1 - dist
                if sim < 0.2:  # skip very low similarity
                    continue
                title = meta.get("title", "Unknown")
                source = meta.get("source", "")
                # Truncate chunk to avoid overwhelming the prompt
                snippet = doc[:800]
                parts.append(f"[Source: {title} | {source} | sim={sim:.2f}]\n{snippet}")

            if not parts:
                return self.rag_context

            return "\n\n---\n\n".join(parts)
        except Exception:
            return self.rag_context

    def get_response(self, user_input: str) -> tuple[str, float]:
        processed = self.inject_context(user_input)

        # Dynamic RAG: search ChromaDB with the user's raw input
        live_rag = self.search_rag(user_input)

        full_prompt = (
            f"LOCATION: {self.current_location}\n"
            f"TIME: {self.current_time}\n"
            f"RAG_CONTEXT: {live_rag}\n"
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
    parser = argparse.ArgumentParser(description="SeoulWalk CLI Prototyper")
    parser.add_argument("--voice", action="store_true", help="Enable Voice mode (STT & TTS)")
    args = parser.parse_args()

    voice_interface = None
    if args.voice:
        if not AUDIO_AVAILABLE:
            print("❌ Voice dependencies not found. Run: pip install sounddevice websocket-client elevenlabs")
            sys.exit(1)
            
        assembly_key = os.getenv("ASSEMBLYAI_API_KEY") or os.getenv("EXPO_PUBLIC_ASSEMBLYAI_API_KEY") or "e12f6c4104604b9badafbe4d887b7283"
        deepgram_key = os.getenv("DEEPGRAM_API_KEY")
        if not deepgram_key:
            print("❌ --voice requires DEEPGRAM_API_KEY in your env / .env file.")
            sys.exit(1)
            
        voice_interface = VoiceInterface(assembly_key, deepgram_key)

    tester = SeoulWalkTester()

    print("╔══════════════════════════════════════════════════╗")
    print("║        SeoulWalk CLI Prototyper (Multi-Turn)     ║")
    print("╚══════════════════════════════════════════════════╝")
    print()
    if args.voice:
        print("  🎙️  Voice Mode : ENABLED (AssemblyAI U3 + Deepgram Aura)")
    print(f"  🤖 Model    : {tester.model_name}")
    print(f"  📍 Location : {tester.current_location}")
    print(f"  🕐 Time     : {tester.current_time}")
    rag_status = "ChromaDB (live)" if tester.chroma_collection else "Static (fallback)"
    print(f"  📚 RAG      : {rag_status}")
    print()
    print("  Commands: move | time | rag | model | models | history | reset | quit")
    print("─" * 52)

    while True:
        try:
            if args.voice:
                user_input = voice_interface.record_until_keypress()
                if user_input.lower() in ("quit", "exit", "q"):
                    print("\n👋 Goodbye!")
                    break
                if not user_input:
                    continue
                print(f"🧳 Tourist (Voice): {user_input}")
            else:
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

        if args.voice and voice_interface:
            voice_interface.speak(reply)


if __name__ == "__main__":
    main()
