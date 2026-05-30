"""
handoff.py — Naver Maps Handoff Router

Generates deep links so the mobile app can open Naver Map
to navigate to a specific location. Provides both:
  - naver_app_url: opens the Naver Map native app directly
  - naver_web_url: fallback if the app isn't installed

Naver Map URL Scheme:
  App:  nmap://place?lat={lat}&lng={lng}&name={name}&appname=com.seoulwalk
  Web:  https://map.naver.com/v5/search/{name}/@{lng},{lat},15z
"""

from __future__ import annotations

from urllib.parse import quote
from fastapi import APIRouter

from server.models import HandoffRequest, HandoffResponse

router = APIRouter(prefix="/handoff", tags=["Handoff"])

# The bundle identifier used for Naver Map's appname parameter
_APP_NAME = "com.seoulwalk.tourguide"


def build_naver_urls(place_name: str, latitude: float, longitude: float) -> dict:
    """
    Build Naver Map deep link URLs for a given location.
    Returns a dict with 'naver_app_url' and 'naver_web_url'.
    """
    encoded_name = quote(place_name, safe="")

    naver_app_url = (
        f"nmap://place?lat={latitude}&lng={longitude}"
        f"&name={encoded_name}&appname={_APP_NAME}"
    )

    naver_web_url = (
        f"https://map.naver.com/v5/search/{encoded_name}"
        f"/@{longitude},{latitude},15z"
    )

    return {
        "naver_app_url": naver_app_url,
        "naver_web_url": naver_web_url,
    }


def build_naver_search_urls(query: str, latitude: float | None = None, longitude: float | None = None) -> dict:
    """
    Build Naver Map search URLs for an amenity/category query.
    Used when SeoulWalk should hand off a search term like "bathroom"
    rather than claiming an exact destination.
    """
    encoded_query = quote(query, safe="")

    naver_app_url = (
        f"nmap://search?query={encoded_query}&appname={_APP_NAME}"
    )

    if latitude is not None and longitude is not None:
        naver_web_url = (
            f"https://map.naver.com/v5/search/{encoded_query}"
            f"/@{longitude},{latitude},17z"
        )
    else:
        naver_web_url = f"https://map.naver.com/v5/search/{encoded_query}"

    return {
        "naver_app_url": naver_app_url,
        "naver_web_url": naver_web_url,
    }


@router.post("/naver-map", response_model=HandoffResponse)
async def get_naver_map_link(req: HandoffRequest):
    """Generate Naver Map deep link + web fallback for a location."""
    urls = build_naver_urls(req.place_name, req.latitude, req.longitude)

    return HandoffResponse(
        place_name=req.place_name,
        naver_app_url=urls["naver_app_url"],
        naver_web_url=urls["naver_web_url"],
    )
