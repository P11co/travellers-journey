#!/usr/bin/env python3
"""Query OpenRouter (NVIDIA Nemotron 3 Nano 30B A3B free) and measure response time."""

import json
import os
import time
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# Load .env from the tour-guide-app directory (same repo)
# ---------------------------------------------------------------------------
ENV_PATH = os.path.join(os.path.dirname(__file__), "tour-guide-app", ".env")

def load_env(path: str) -> None:
    """Read a .env file and inject its variables into os.environ."""
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

# Try both possible key names
api_key = os.getenv("EXPO_PUBLIC_OPENROUTER_API_KEY") or os.getenv("OPENROUTER_API_KEY")
if not api_key:
    raise EnvironmentError(
        "No OpenRouter API key found. Set EXPO_PUBLIC_OPENROUTER_API_KEY or "
        "OPENROUTER_API_KEY in your environment or in tour-guide-app/.env"
    )

MODEL_ID = "nvidia/nemotron-3-nano-30b-a3b:free"

SYSTEM_PROMPT = (
    'You are SeoulWalk, a specialized voice-first tour guide for '
    'Gyeongbokgung Palace. You are the "eyes and ears" for a foreign '
    'tourist who is currently walking through the palace grounds.\n\n'
    'Core Persona: calm, observant local expert. Prioritize safety and '
    'spatial orientation over long lectures.\n'
    'Spatial Reasoning: use egocentric language ("ahead of you", "to your '
    'left"), landmarks, and distances in meters.\n'
    'Trust & Sources: cite RAG sources, acknowledge gaps honestly.\n'
    'Spoken UI: 2-4 short sentences, plain text only (no markdown), '
    'TTS-friendly, intermediate English.\n'
    'Handling Injected Context: respond naturally to specific place names '
    'or times injected by the system.\n'
    'Action-Oriented Closures: always end with a clear, low-effort next '
    'step.\n'
    'Constraints: never invent prices, hours, or dates; stay within scope '
    '(Gyeongbokgung, nearby Seoul logistics, basic Korean etiquette).'
)


def query_openrouter(user_prompt: str) -> dict:
    """Send a chat completion request and return the parsed response + elapsed time."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = json.dumps({
        "model": MODEL_ID,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
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
    return {"response": data, "elapsed": elapsed}


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Query OpenRouter model and measure response time",
    )
    parser.add_argument("prompt", help="User prompt to send to the model")
    args = parser.parse_args()

    result = query_openrouter(args.prompt)

    # Extract and display the assistant reply
    choices = result["response"].get("choices", [])
    if choices:
        reply = choices[0].get("message", {}).get("content", "")
        print(reply)
    else:
        print(json.dumps(result["response"], ensure_ascii=False, indent=2))

    print(f"\n--- End-to-end time: {result['elapsed']:.2f} seconds ---")
