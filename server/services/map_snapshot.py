"""
map_snapshot.py — Naver Static Map API service
"""
import base64
import os
import httpx
from server.config import NAVER_MAP_CLIENT_ID, NAVER_MAP_CLIENT_SECRET

# A valid 100x100 solid gray PNG base64 for local testing fallback
MOCK_MAP_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkAQMAAABKLAcXAAAABlBMVEUAAAD///+l2Z/dAAAACXBIWXMAAA7E"
    "AAAOxAGVKw4bAAAAFUlEQVQ4jWNgGAWjYBSMglEwCkbBSAcACoQAAQBsCc0AAAAASUVORK5CYII="
)

# Cache path inside project workspace
_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(os.path.dirname(_DIR))
MAP_CACHE_PATH = os.path.join(_PROJECT_ROOT, "data", "latest_map.png")


async def get_map_snapshot(
    latitude: float,
    longitude: float,
    zoom: int = 16,
    width: int = 400,
    height: int = 300,
) -> str | None:
    """
    Fetch a static map snapshot from Naver Static Map API.
    Returns: Base64-encoded PNG string, or a fallback mock base64 string if keys are missing/API fails.
    Also caches the generated image to data/latest_map.png inside the workspace.
    """
    raw_content = None

    if not NAVER_MAP_CLIENT_ID or not NAVER_MAP_CLIENT_SECRET:
        # Fallback to mock image for testing/development
        print("⚠️ Naver Map API credentials not found, returning mock map snapshot.")
        raw_content = base64.b64decode(MOCK_MAP_B64)
    else:
        # Naver Static Map API expects 'longitude,latitude' format for center
        center_str = f"{longitude},{latitude}"
        
        # Simple marker at the current location
        markers_str = f"type:d|size:mid|pos:{longitude} {latitude}"

        url = "https://maps.apigw.ntruss.com/map-static/v2/raster"
        params = {
            "w": width,
            "h": height,
            "center": center_str,
            "level": zoom,
            "markers": markers_str,
            "scale": 2,  # Retina/High-res scale
        }

        headers = {
            "X-NCP-APIGW-API-KEY-ID": NAVER_MAP_CLIENT_ID,
            "X-NCP-APIGW-API-KEY": NAVER_MAP_CLIENT_SECRET,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, params=params, headers=headers)
                if resp.status_code == 200:
                    raw_content = resp.content
                else:
                    # If Naver API fails, log or print and return mock
                    print(f"⚠️ Naver Map API failed ({resp.status_code}): {resp.text}")
                    raw_content = base64.b64decode(MOCK_MAP_B64)
        except Exception as e:
            print(f"⚠️ Exception fetching Naver Map: {e}")
            raw_content = base64.b64decode(MOCK_MAP_B64)

    # Write to local cache path
    if raw_content:
        try:
            os.makedirs(os.path.dirname(MAP_CACHE_PATH), exist_ok=True)
            with open(MAP_CACHE_PATH, "wb") as f:
                f.write(raw_content)
            print(f"🗺️ Map snapshot cached at: {MAP_CACHE_PATH}")
        except Exception as e:
            print(f"⚠️ Failed to cache map snapshot to disk: {e}")

        return base64.b64encode(raw_content).decode("utf-8")
    
    return None
