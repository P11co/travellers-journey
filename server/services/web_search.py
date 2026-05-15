"""
web_search.py — Tavily Web Search Service

Provides:
  1. LLM-based classification: does this query need live web data?
  2. Tavily search execution with domain prioritization
  3. Result formatting for injection into the LLM prompt

Classification uses a dedicated LLM call with a strict yes/no format so that
even downstream paraphrases or pronoun references to time-sensitive topics
are still caught — something keyword heuristics would miss.
"""

from __future__ import annotations

import httpx

from server.config import (
    OPENROUTER_API_KEY,
    LLM_MODEL_ID,
    OPENROUTER_BASE_URL,
    TAVILY_API_KEY,
)

TAVILY_SEARCH_URL = "https://api.tavily.com/search"

# ---------------------------------------------------------------------------
# Prompt: LLM-based search need classifier
# ---------------------------------------------------------------------------
_CLASSIFIER_SYSTEM = """\
You are a query classifier for a tour guide AI assistant at Gyeongbokgung Palace in Seoul.

Your only job: decide whether the user's message requires LIVE or RECENT information
from the web to be answered accurately.

Classify as YES if the message is asking about ANY of the following — even indirectly
or through pronouns:
- Current prices, ticket costs, or admission fees
- Current opening or closing times / hours of operation
- Today's or this week's events, ceremonies, or special exhibitions
- Current weather or conditions
- Whether something is open right now
- Real-time availability (e.g. parking, rentals)
- Recent news or changes to policies

Classify as NO if the message is about:
- Historical facts, architecture, or the meaning of a structure's name
- General cultural or etiquette information
- Navigation between known waypoints
- Describing something the user is looking at
- General advice that does not change day-to-day

Respond with exactly one word: YES or NO.
"""

_CLASSIFIER_USER_TEMPLATE = """\
Conversation context (last assistant reply, may be empty):
{last_ai_message}

Current user message:
{user_message}
"""


async def needs_web_search(
    user_message: str,
    last_ai_message: str = "",
) -> bool:
    """
    Ask the LLM whether this query needs live web data.
    Returns True if yes, False if no.
    Falls back to False on any error (safe default).
    """
    if not OPENROUTER_API_KEY:
        return False

    prompt = _CLASSIFIER_USER_TEMPLATE.format(
        last_ai_message=last_ai_message.strip() or "(none)",
        user_message=user_message.strip(),
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                OPENROUTER_BASE_URL,
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": LLM_MODEL_ID,
                    "messages": [
                        {"role": "system", "content": _CLASSIFIER_SYSTEM},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.0,  # Deterministic classification
                    "max_tokens": 5,
                },
            )

        if resp.status_code != 200:
            return False

        answer = (
            resp.json()
            .get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
            .upper()
        )
        return answer.startswith("YES")

    except Exception:
        return False  # Fail open — proceed without search


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
