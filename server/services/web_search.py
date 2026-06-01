from __future__ import annotations

import json
import httpx

from server.config import (
    NVIDIA_API_KEY,
    OPENROUTER_API_KEY,
    LLM_MODEL_ID,
    OPENROUTER_BASE_URL,
    NVIDIA_BASE_URL,
    TAVILY_API_KEY,
)
from server.services.langsmith_tracing import traceable

TAVILY_SEARCH_URL = "https://api.tavily.com/search"

# ---------------------------------------------------------------------------
# Prompt: LLM-based 4-way intent classifier
# ---------------------------------------------------------------------------
_CLASSIFIER_SYSTEM = """\
You are a query classifier for a tour guide AI assistant at Gyeongbokgung Palace in Seoul.

Your job: classify the user's message into exactly ONE of four categories and,
when a Naver Map handoff may be useful, extract the exact Naver Map search key.

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

Return compact JSON only:
{
  "intent": "RAG" | "WEB_SEARCH" | "MAP_STATIC" | "MAP_GEOCODE",
  "naver_search_query": string or null,
  "display_query": string or null
}

For MAP_GEOCODE:
- naver_search_query should be the exact keyword to put in nmap://search?query=...
- Prefer Korean Naver keywords even when the user writes in English, because
  Naver Map search quality is usually better with Korean place/category names.
- Preserve useful local qualifiers like 광화문, 경복궁, 종로, or the branch name.
- display_query should be a user-facing English or bilingual label.

Examples:
- "How do I get to Kyobo Bookstore?" →
  {"intent":"MAP_GEOCODE","naver_search_query":"교보문고 광화문","display_query":"Kyobo Bookstore Gwanghwamun"}
- "nearest bathroom" →
  {"intent":"MAP_GEOCODE","naver_search_query":"화장실","display_query":"bathroom"}
- "Is there a subway nearby?" →
  {"intent":"MAP_GEOCODE","naver_search_query":"지하철역","display_query":"subway station"}

For non-MAP_GEOCODE intents, set naver_search_query and display_query to null.
"""

_CLASSIFIER_USER_TEMPLATE = """\
Conversation context (last assistant reply, may be empty):
{last_ai_message}

Current user message:
{user_message}
"""


@traceable(name="Classify Chat Intent", run_type="llm")
async def classify_intent(
    user_message: str,
    last_ai_message: str = "",
    provider: str = "openrouter",
    model: str | None = None,
    return_route: bool = False,
) -> str | dict:
    """
    Ask the LLM to classify the user query into one of four intents:
    RAG, WEB_SEARCH, MAP_STATIC, or MAP_GEOCODE.
    When return_route=True, returns the parsed route dict with optional
    naver_search_query/display_query. Otherwise returns the intent string.
    Falls back to NVIDIA if OpenRouter cannot complete, then RAG on any error.
    """
    model = model or LLM_MODEL_ID

    if not OPENROUTER_API_KEY and not NVIDIA_API_KEY:
        return _route_result("RAG") if return_route else "RAG"

    prompt = _CLASSIFIER_USER_TEMPLATE.format(
        last_ai_message=last_ai_message.strip() or "(none)",
        user_message=user_message.strip(),
    )

    import asyncio as _asyncio

    providers = [provider]
    if provider == "openrouter":
        providers.append("nvidia")

    max_retries = 2
    for active_provider in providers:
        if active_provider == "openrouter":
            if not OPENROUTER_API_KEY:
                continue
            url = OPENROUTER_BASE_URL
            api_key = OPENROUTER_API_KEY
        elif active_provider == "nvidia":
            if not NVIDIA_API_KEY:
                continue
            url = NVIDIA_BASE_URL
            api_key = NVIDIA_API_KEY
        else:
            continue

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
                            "max_tokens": 120,
                            **({"provider": {"only": ["Alibaba Cloud"], "allow_fallbacks": False}} if active_provider == "openrouter" and model == "deepseek/deepseek-v4-flash" else {}),
                        },
                    )

                if resp.status_code == 500 and attempt < max_retries:
                    print(
                        f"⚠️ {active_provider} classifier API 500 error "
                        f"(attempt {attempt + 1}/{max_retries + 1}), retrying..."
                    )
                    await _asyncio.sleep(1.0)
                    continue

                if resp.status_code != 200:
                    print(f"⚠️ {active_provider} classifier API error ({resp.status_code}): {resp.text[:200]}")
                    break

                raw_answer = (
                    resp.json()
                    .get("choices", [{}])[0]
                    .get("message", {})
                    .get("content") or ""
                )
                route = _parse_classifier_route(raw_answer)
                return route if return_route else route["intent"]

            except Exception as e:
                print(
                    f"⚠️ {active_provider} classifier exception "
                    f"(attempt {attempt + 1}/{max_retries + 1}): {type(e).__name__}: {repr(e)}"
                )
                if attempt < max_retries:
                    await _asyncio.sleep(1.0)
                    continue
                break

    return _route_result("RAG") if return_route else "RAG"


def _route_result(
    intent: str,
    naver_search_query: str | None = None,
    display_query: str | None = None,
) -> dict:
    valid_intents = {"RAG", "WEB_SEARCH", "MAP_STATIC", "MAP_GEOCODE"}
    normalized_intent = intent.strip().upper() if intent else "RAG"
    if normalized_intent not in valid_intents:
        normalized_intent = "RAG"
    if normalized_intent != "MAP_GEOCODE":
        naver_search_query = None
        display_query = None
    return {
        "intent": normalized_intent,
        "naver_search_query": naver_search_query.strip() if naver_search_query else None,
        "display_query": display_query.strip() if display_query else None,
    }


def _parse_classifier_route(raw_answer: str) -> dict:
    """Parse either the new JSON classifier response or legacy one-word output."""
    answer = (raw_answer or "").strip()
    if answer.startswith("```"):
        answer = answer.strip("`").strip()
        if answer.lower().startswith("json"):
            answer = answer[4:].strip()

    try:
        data = json.loads(answer)
        return _route_result(
            str(data.get("intent") or ""),
            data.get("naver_search_query"),
            data.get("display_query"),
        )
    except (json.JSONDecodeError, TypeError, ValueError):
        legacy = answer.upper()
        if "WEB_SEARCH" in legacy:
            return _route_result("WEB_SEARCH")
        if "MAP_GEOCODE" in legacy:
            return _route_result("MAP_GEOCODE")
        if "MAP_STATIC" in legacy:
            return _route_result("MAP_STATIC")
        return _route_result("RAG")


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

@traceable(name="Tavily Web Search", run_type="tool")
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


@traceable(name="Search With Fallback", run_type="tool")
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
