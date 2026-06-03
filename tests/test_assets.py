import os

import pytest

from server.config import ASSETS_DIR, HOTSPOTS, WAYPOINTS


@pytest.mark.asyncio
async def test_static_tour_image_served(client):
    resp = await client.get("/assets/images/hotspots/palace_history_1778862119711.png")

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("image/png")
    assert resp.content


def test_tour_image_metadata_points_to_existing_assets():
    image_urls = [
        item.get("image_url")
        for item in [*HOTSPOTS, *WAYPOINTS]
        if item.get("image_url")
    ]

    assert image_urls
    for image_url in image_urls:
        assert image_url.startswith("assets/images/")
        local_path = os.path.join(ASSETS_DIR, image_url.removeprefix("assets/"))
        assert os.path.exists(local_path), image_url
