#!/usr/bin/env python3
"""
SeoulWalk Scraper — Crawl4AI pipeline for RAG-ready Markdown.

Usage:
    python scraper.py -f urls.csv              # scrape URLs listed in CSV
    python scraper.py -f urls.csv -o output/   # custom output directory

CSV format (header row required):
    url
    https://example.com/page1
    https://example.com/page2
"""

import argparse
import asyncio
import csv
import os
import re
import sys
import time as _time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def sanitize_filename(url: str) -> str:
    """Turn a URL into a filesystem-safe Markdown filename."""
    parsed = urlparse(url)
    # Combine host + path, replace non-alphanumeric with underscores
    raw = f"{parsed.netloc}{parsed.path}"
    name = re.sub(r"[^a-zA-Z0-9]+", "_", raw).strip("_").lower()
    # Cap length to avoid filesystem limits
    if len(name) > 120:
        name = name[:120]
    return f"{name}.md"


def read_urls_from_csv(path: str) -> list[str]:
    """Read URLs from a CSV that has a 'url' column."""
    if not os.path.isfile(path):
        print(f"❌ CSV file not found: {path}")
        sys.exit(1)

    urls: list[str] = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if "url" not in (reader.fieldnames or []):
            print("❌ CSV must have a 'url' column header.")
            sys.exit(1)
        for row in reader:
            url = row["url"].strip()
            if url:
                urls.append(url)

    if not urls:
        print("❌ No URLs found in CSV.")
        sys.exit(1)
    return urls


def build_frontmatter(url: str, scraped_at: datetime, title: str = "") -> str:
    """Build a YAML frontmatter block with metadata."""
    valid_until = scraped_at + timedelta(days=30)
    lines = ["---"]
    if title:
        lines.append(f"title: {title}")
    lines.append(f"source: {url}")
    lines.append(f"scraped_at: {scraped_at.isoformat()}")
    lines.append(f"valid_until: {valid_until.date().isoformat()}")
    lines.append("---\n")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Core scraper
# ---------------------------------------------------------------------------

async def scrape_urls(urls: list[str], output_dir: str) -> None:
    """Scrape each URL and save Markdown with metadata frontmatter."""
    os.makedirs(output_dir, exist_ok=True)

    browser_config = BrowserConfig(
        headless=True,
        verbose=False,
        user_agent="SeoulWalk-Research-Bot/1.0 (academic-research)",
    )

    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=10,
    )

    results: list[dict] = []              # for summary table
    prev_domain: str | None = None        # for politeness delay

    print(f"\n🌐  Scraping {len(urls)} URL(s) → {output_dir}/\n")

    async with AsyncWebCrawler(config=browser_config) as crawler:
        for i, url in enumerate(urls, 1):
            domain = urlparse(url).netloc

            # Politeness: 2-second delay between requests to the SAME domain
            if prev_domain and domain == prev_domain:
                print("  ⏳ Politeness delay (2 s)…")
                await asyncio.sleep(2)
            prev_domain = domain

            print(f"  [{i}/{len(urls)}] {url}")
            entry: dict = {"url": url, "file": "", "ok": False, "error": ""}

            try:
                result = await crawler.arun(url=url, config=run_config)

                if result.success:
                    now = datetime.now(timezone.utc)
                    page_title = (result.metadata or {}).get("title", "") if hasattr(result, "metadata") and isinstance(result.metadata, dict) else getattr(result, "title", "") or ""
                    filename = sanitize_filename(url)
                    filepath = os.path.join(output_dir, filename)

                    content = build_frontmatter(url, now, title=page_title) + (result.markdown or "")
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(content)

                    entry["file"] = filename
                    entry["ok"] = True
                    print(f"    ✅  Saved → {filepath}")
                else:
                    entry["error"] = result.error_message or "unknown error"
                    print(f"    ❌  Failed: {entry['error']}")

            except Exception as exc:
                entry["error"] = str(exc)
                print(f"    ❌  Exception: {exc}")

            results.append(entry)

    # -- Summary ----------------------------------------------------------
    ok_count = sum(1 for r in results if r["ok"])
    print(f"\n{'─' * 60}")
    print(f"  Done: {ok_count}/{len(results)} succeeded")
    for r in results:
        icon = "✅" if r["ok"] else "❌"
        detail = r["file"] if r["ok"] else r["error"]
        print(f"    {icon}  {r['url']}")
        print(f"        → {detail}")
    print(f"{'─' * 60}\n")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="SeoulWalk Scraper — Crawl4AI pipeline for RAG-ready Markdown.",
        epilog="Example: python scraper.py -f scrape_this.csv",
    )
    parser.add_argument(
        "-f", "--file",
        required=True,
        metavar="CSV",
        help="Path to a CSV file with a 'url' column.",
    )
    parser.add_argument(
        "-o", "--output",
        default="data",
        metavar="DIR",
        help="Output directory for scraped Markdown files (default: data/).",
    )
    args = parser.parse_args()

    urls = read_urls_from_csv(args.file)
    asyncio.run(scrape_urls(urls, args.output))


if __name__ == "__main__":
    main()
