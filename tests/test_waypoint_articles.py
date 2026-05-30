"""
test_waypoint_articles.py — Static coverage for cached waypoint articles.
"""

import json
from pathlib import Path


def test_every_waypoint_has_cached_article():
    """Every waypoint used by the map should have a pre-generated article."""
    root = Path(__file__).resolve().parents[1]
    waypoints = json.loads((root / "tour-guide-app/src/data/waypoints.json").read_text())
    articles = json.loads((root / "tour-guide-app/src/data/waypointArticles.json").read_text())

    missing = [waypoint["id"] for waypoint in waypoints if waypoint["id"] not in articles]
    assert missing == []


def test_waypoint_articles_have_minimum_readable_content():
    """Cached articles should contain title, subtitle, and body sections."""
    root = Path(__file__).resolve().parents[1]
    articles = json.loads((root / "tour-guide-app/src/data/waypointArticles.json").read_text())

    for waypoint_id, article in articles.items():
        assert article.get("title"), waypoint_id
        assert article.get("subtitle"), waypoint_id
        assert article.get("readingTime"), waypoint_id
        sections = article.get("sections") or []
        assert len(sections) >= 1, waypoint_id
        for section in sections:
            assert section.get("heading"), waypoint_id
            assert len(section.get("body", "")) >= 60, waypoint_id
