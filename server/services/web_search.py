from __future__ import annotations

import httpx

from server.config import (
    OPENROUTER_API_KEY,
    NVIDIA_API_KEY,
    LLM_MODEL_ID,
    OPENROUTER_BASE_URL,
    NVIDIA_BASE_URL,
    TAVILY_API_KEY,
)

TAVILY_SEARCH_URL = "https://api.tavily.com/search"

# ---------------------------------------------------------------------------
# Prompt: LLM-based 4-way intent classifier
# ---------------------------------------------------------------------------
_CLASSIFIER_SYSTEM = """\
You are a query classifier for a tour guide AI assistant at Gyeongbokgung Palace in Seoul.

Your job: classify the user's message into exactly ONE of four categories.

### RAG
Use when the message asks about:
- Historical facts, architecture, or the meaning of a structure's name
- General cultural or etiquette information about the palace or Korean culture
- Information about specific palace buildings, halls, or gates
- The palace tour route, exhibits, or ceremonies described in guidebooks

### WEB_SEARCH
Use when the message asks about:
- Current prices, ticket costs, or admission fees
- Current opening or closing times / hours of operation
- Today's or this week's events, ceremonies, or special exhibitions
- Current weather or conditions
- Whether something is open right now
- Real-time availability (e.g. parking, rentals)
- Recent news or changes to policies
- Information about obscure or niche locations not in a standard palace guide

### MAP_STATIC
Use when the message asks about:
- What is around the user right now / surroundings
- What buildings or landmarks the user can see
- General "what's nearby" or "what's in this area" questions
- Orientation or spatial awareness of the immediate environment

### MAP_GEOCODE
Use when the message asks about:
- A specific named place, store, restaurant, cafe, or facility (e.g. "Where is Kyobo Bookstore?")
- Finding a specific type of place (e.g. "Is there a public restroom nearby?", "Where is the nearest convenience store?")
- Directions to a named destination or specific address
- Whether a specific named business or facility exists in the area

Respond with exactly one word: RAG, WEB_SEARCH, MAP_STATIC, or MAP_GEOCODE.
"""

_CLASSIFIER_USER_TEMPLATE = """\
Conversation context (last assistant reply, may be empty):
{last_ai_message}

Current user message:
{user_message}
"""


async def classify_intent(
    user_message: str,
    last_ai_message: str = "",
    provider: str = "nvidia",
    model: str | None = None,
) -> str:
    """
    Ask the LLM to classify the user query into one of four intents:
    RAG, WEB_SEARCH, MAP_STATIC, or MAP_GEOCODE.
    Falls back to RAG on any error (safe default).
    Supports both NVIDIA NIM and OpenRouter providers.
    """
    model = model or LLM_MODEL_ID

    # Resolve provider endpoint and API key
    if provider == "nvidia":
        if not NVIDIA_API_KEY:
            # Fall back to OpenRouter if NVIDIA key is missing
            if not OPENROUTER_API_KEY:
                return "RAG"
            url = OPENROUTER_BASE_URL
            api_key = OPENROUTER_API_KEY
        else:
            url = NVIDIA_BASE_URL
            api_key = NVIDIA_API_KEY
    else:
        if not OPENROUTER_API_KEY:
            return "RAG"
        url = OPENROUTER_BASE_URL
        api_key = OPENROUTER_API_KEY

    prompt = _CLASSIFIER_USER_TEMPLATE.format(
        last_ai_message=last_ai_message.strip() or "(none)",
        user_message=user_message.strip(),
    )

    import asyncio as _asyncio

    max_retries = 2
    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": _CLASSIFIER_SYSTEM},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.0,  # Deterministic classification
                        "max_tokens": 10,
                    },
                )

            if resp.status_code == 500 and attempt < max_retries:
                print(f"⚠️ Classifier API 500 error (attempt {attempt + 1}/{max_retries + 1}), retrying...")
                await _asyncio.sleep(1.0)
                continue

            if resp.status_code != 200:
                print(f"⚠️ Classifier API error ({resp.status_code}): {resp.text[:200]}")
                return "RAG"

            answer = (
                resp.json()
                .get("choices", [{}])[0]
                .get("message", {})
                .get("content") or ""
            )
            answer = answer.strip().upper()

            # Parse the 4-way response
            if "WEB_SEARCH" in answer:
                return "WEB_SEARCH"
            elif "MAP_GEOCODE" in answer:
                return "MAP_GEOCODE"
            elif "MAP_STATIC" in answer:
                return "MAP_STATIC"
            else:
                return "RAG"

        except Exception as e:
            print(f"⚠️ Classifier exception (attempt {attempt + 1}/{max_retries + 1}): {type(e).__name__}: {repr(e)}")
            if attempt < max_retries:
                await _asyncio.sleep(1.0)
                continue
            return "RAG"  # Fail open — default to RAG

    return "RAG"


async def needs_web_search(
    user_message: str,
    last_ai_message: str = "",
) -> bool:
    """
    Backwards-compatible wrapper around classify_intent.
    Returns True if the query needs web search, False otherwise.
    """
    intent = await classify_intent(user_message, last_ai_message)
    return intent == "WEB_SEARCH"


# ---------------------------------------------------------------------------
# Tavily search
# ---------------------------------------------------------------------------

async def tavily_search(query: str, max_results: int = 4) -> list[dict]:
    """
    Run a Tavily search and return a list of result dicts.
    Each dict has: title, url, content (snippet), score.
    Returns empty list on failure.
    """
    if not TAVILY_API_KEY:
        return []

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                TAVILY_SEARCH_URL,
                json={
                    "api_key": TAVILY_API_KEY,
                    "query": query,
                    "search_depth": "basic",
                    "max_results": max_results,
                },
            )

        if resp.status_code != 200:
            return []

        data = resp.json()
        results = data.get("results", [])

        return [
            {
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", ""),
                "score": r.get("score", 0.0),
            }
            for r in results
        ]

    except Exception:
        return []


async def search_with_fallback(query: str) -> list[dict]:
    """Run a Tavily web search for the given query."""
    return await tavily_search(query, max_results=4)


# ---------------------------------------------------------------------------
# Formatter: inject into LLM prompt
# ---------------------------------------------------------------------------

def format_search_results_for_prompt(results: list[dict]) -> str:
    """
    Format Tavily results into a concise block to inject into the system prompt.
    Kept short to minimize token usage.
    """
    if not results:
        return ""

    lines = ["WEB_SEARCH_RESULTS (use these as your primary source for time-sensitive facts):"]
    for i, r in enumerate(results, 1):
        # Extract domain for citation
        from urllib.parse import urlparse
        domain = urlparse(r["url"]).netloc or r["url"]
        snippet = r["content"][:400].replace("\n", " ")
        lines.append(f"\n[{i}] {r['title']} ({domain})\n{snippet}")

    return "\n".join(lines)
