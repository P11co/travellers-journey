#!/usr/bin/env python3
"""
SeoulWalk Discovery Comparison — Seeder vs Deep Crawl

Compares two Crawl4AI discovery strategies against royal.khs.go.kr:
  1. AsyncUrlSeeder   — pulls URLs from the sitemap
  2. BFSDeepCrawlStrategy — follows links breadth-first from a start page

Usage:
    python discover.py --mode seeder      # sitemap only
    python discover.py --mode deepcrawl   # BFS link-following only
    python discover.py --mode both        # run both and compare (default)
"""

import argparse
import asyncio
import os
import re
import time as _time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from crawl4ai import (
    AsyncWebCrawler,
    BrowserConfig,
    CrawlerRunConfig,
    CacheMode,
    AsyncUrlSeeder,
    SeedingConfig,
    BFSDeepCrawlStrategy,
)
from crawl4ai.deep_crawling.filters import FilterChain, DomainFilter, URLPatternFilter


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DOMAIN = "royal.khs.go.kr"
START_URLS = [
    "https://royal.khs.go.kr/ENG/main/index.do",            # The English Portal
    "https://royal.khs.go.kr/ROYAL/contents/R701000000.do"  # The Logistics Portal
]
ENG_PATTERN = "*royal.khs.go.kr/ENG/*"

BROWSER_CONFIG = BrowserConfig(
    headless=True,
    verbose=False,
    user_agent="SeoulWalk-Research-Bot/1.0 (academic-research)",
)


# ---------------------------------------------------------------------------
# Helpers (shared with scraper.py)
# ---------------------------------------------------------------------------

def sanitize_filename(url: str) -> str:
    parsed = urlparse(url)
    raw = f"{parsed.netloc}{parsed.path}"
    name = re.sub(r"[^a-zA-Z0-9]+", "_", raw).strip("_").lower()
    if len(name) > 120:
        name = name[:120]
    return f"{name}.md"


def is_mostly_korean(text: str) -> bool:
    if not text:
        return False
    # Remove whitespace and common punctuation for accurate ratio calculation
    clean_text = re.sub(r'[\s\n\r\t.,!?;:()\[\]{}]+', '', text)
    if not clean_text:
        return False
    
    # Count Hangul characters (U+AC00 to U+D7A3, and jamo U+1100-U+11FF, U+3130-U+318F)
    kr_chars = len(re.findall(r'[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f]', clean_text))
    # Count basic Latin letters (A-Z, a-z)
    latin_chars = len(re.findall(r'[a-zA-Z]', clean_text))
    
    # If there's barely any Korean text, don't flag it
    if kr_chars < 50:
        return False
        
    # If the number of Korean characters is > 20% of the Latin characters, it's heavily Korean.
    return kr_chars > (0.2 * latin_chars)


def build_frontmatter(url: str, scraped_at: datetime, title: str = "", kr_only: bool = False) -> str:
    valid_until = scraped_at + timedelta(days=30)
    lines = ["---"]
    
    display_title = title
    if kr_only:
        display_title = f"[KR_ONLY] {title}".strip()
        
    if display_title:
        lines.append(f"title: {display_title}")
        
    lines.append(f"source: {url}")
    lines.append(f"scraped_at: {scraped_at.isoformat()}")
    lines.append(f"valid_until: {valid_until.date().isoformat()}")
    lines.append("---\n")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# 1. Seeder strategy
# ---------------------------------------------------------------------------

async def run_seeder(output_dir: str) -> dict:
    """Discover URLs via sitemap, then scrape each one."""
    os.makedirs(output_dir, exist_ok=True)
    print(f"\n{'='*60}")
    print(f"  🗺️  SEEDER MODE — Sitemap discovery for {DOMAIN}")
    print(f"{'='*60}\n")

    # --- Discovery phase ---
    t0 = _time.time()
    async with AsyncUrlSeeder() as seeder:
        config = SeedingConfig(
            source="sitemap+cc",
            pattern=ENG_PATTERN,
            live_check=False,
        )
        # Seed from the common starting point
        discovered = await seeder.urls(DOMAIN, config)
    discovery_time = _time.time() - t0

    url_list = [u["url"] for u in discovered]
    print(f"  🔍 Discovered {len(url_list)} English URLs in {discovery_time:.1f}s")

    # Save URL list
    url_list_path = os.path.join(os.path.dirname(output_dir), "seeder_urls.txt")
    with open(url_list_path, "w") as f:
        f.write("\n".join(url_list))
    print(f"  📄 URL list saved → {url_list_path}")

    # --- Scrape phase ---
    t1 = _time.time()
    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=10,
    )

    ok_count = 0
    fail_count = 0
    prev_domain = None

    async with AsyncWebCrawler(config=BROWSER_CONFIG) as crawler:
        for i, url in enumerate(url_list, 1):
            domain = urlparse(url).netloc
            if prev_domain and domain == prev_domain:
                await asyncio.sleep(2)
            prev_domain = domain

            print(f"  [{i}/{len(url_list)}] {url}")
            try:
                result = await crawler.arun(url=url, config=run_config)
                if result.success:
                    now = datetime.now(timezone.utc)
                    page_title = (
                        (result.metadata or {}).get("title", "")
                        if hasattr(result, "metadata") and isinstance(result.metadata, dict)
                        else getattr(result, "title", "") or ""
                    )
                    filename = sanitize_filename(url)
                    filepath = os.path.join(output_dir, filename)
                    
                    md_content = result.markdown or ""
                    is_kr = is_mostly_korean(md_content)
                    
                    content = build_frontmatter(url, now, title=page_title, kr_only=is_kr) + md_content
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(content)
                    ok_count += 1
                    print(f"    ✅ Saved → {filename}")
                else:
                    fail_count += 1
                    print(f"    ❌ Failed: {result.error_message}")
            except Exception as exc:
                fail_count += 1
                print(f"    ❌ Exception: {exc}")

    scrape_time = _time.time() - t1

    return {
        "method": "Seeder (sitemap)",
        "urls_discovered": len(url_list),
        "urls": set(url_list),
        "ok": ok_count,
        "fail": fail_count,
        "discovery_time": discovery_time,
        "scrape_time": scrape_time,
    }


# ---------------------------------------------------------------------------
# 2. Deep Crawl strategy
# ---------------------------------------------------------------------------

async def run_deepcrawl(output_dir: str) -> dict:
    """BFS deep crawl starting from the Gyeongbokgung page."""
    os.makedirs(output_dir, exist_ok=True)
    print(f"\n{'='*60}")
    print(f"  🕸️  DEEP CRAWL MODE — BFS from Multiple Hubs")
    print(f"{'='*60}\n")

    # Constrain BFS to only royal.khs.go.kr/ENG/* pages
    filter_chain = FilterChain(filters=[
        DomainFilter(allowed_domains=["royal.khs.go.kr"]),
        # Removed the ENG_PATTERN filter here to allow it to discover /ROYAL/ links if they exist,
        # but the request mentioned keeping it to the domain root or specific English hubs.
        # Actually, let's keep the ENG_PATTERN if we want to stick to English content, 
        # or remove it if we want to see if it finds Korean content from the English main page.
        # Since the user specifically talked about the [KR_ONLY] tag for things like /ROYAL/, let's widen the net slightly.
        URLPatternFilter(patterns=["*royal.khs.go.kr/ENG/*", "*royal.khs.go.kr/ROYAL/*"]),
    ])

    t0 = _time.time()
    ok_count = 0
    fail_count = 0
    all_urls: list[str] = []
    scraped_urls = set()

    for start_url in START_URLS:
        async with AsyncWebCrawler(config=BROWSER_CONFIG) as crawler:
            strategy = BFSDeepCrawlStrategy(
                max_depth=2,
                include_external=False,
                max_pages=100,
                filter_chain=filter_chain,
            )

            run_config = CrawlerRunConfig(
                cache_mode=CacheMode.BYPASS,
                word_count_threshold=10,
                deep_crawl_strategy=strategy,
            )
            
            print(f"  🔍 Starting BFS from: {start_url}")
            results = await crawler.arun(url=start_url, config=run_config)

            # deep crawl returns a list of CrawlResult
            if not isinstance(results, list):
                results = [results]

            for result in results:
                if result.url in scraped_urls:
                    continue
                scraped_urls.add(result.url)
                all_urls.append(result.url)
                
                if result.success:
                    now = datetime.now(timezone.utc)
                    page_title = (
                        (result.metadata or {}).get("title", "")
                        if hasattr(result, "metadata") and isinstance(result.metadata, dict)
                        else getattr(result, "title", "") or ""
                    )
                    filename = sanitize_filename(result.url)
                    filepath = os.path.join(output_dir, filename)
                    
                    md_content = result.markdown or ""
                    is_kr = is_mostly_korean(md_content)
                    
                    content = build_frontmatter(result.url, now, title=page_title, kr_only=is_kr) + md_content
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(content)
                    ok_count += 1
                    depth = (result.metadata or {}).get("depth", "?")
                    print(f"  ✅ [depth={depth}] {result.url}")
                else:
                    fail_count += 1
                    print(f"  ❌ {result.url}: {result.error_message}")

    total_time = _time.time() - t0

    # Save URL list
    url_list_path = os.path.join(os.path.dirname(output_dir), "deepcrawl_urls.txt")
    with open(url_list_path, "w") as f:
        f.write("\n".join(all_urls))
    print(f"\n  📄 URL list saved → {url_list_path}")

    return {
        "method": "Deep Crawl (BFS depth=2)",
        "urls_discovered": len(all_urls),
        "urls": set(all_urls),
        "ok": ok_count,
        "fail": fail_count,
        "discovery_time": 0,
        "scrape_time": total_time,
    }


# ---------------------------------------------------------------------------
# Comparison table
# ---------------------------------------------------------------------------

def print_comparison(seeder_stats: dict, deep_stats: dict) -> None:
    print(f"\n{'='*60}")
    print(f"  📊 COMPARISON RESULTS")
    print(f"{'='*60}\n")

    seeder_urls = seeder_stats["urls"]
    deep_urls = deep_stats["urls"]
    overlap = seeder_urls & deep_urls
    seeder_only = seeder_urls - deep_urls
    deep_only = deep_urls - seeder_urls

    rows = [
        ("Metric", "Seeder (Sitemap)", "Deep Crawl (BFS)"),
        ("─" * 25, "─" * 20, "─" * 20),
        ("URLs discovered", str(seeder_stats["urls_discovered"]), str(deep_stats["urls_discovered"])),
        ("Scraped OK", str(seeder_stats["ok"]), str(deep_stats["ok"])),
        ("Failed", str(seeder_stats["fail"]), str(deep_stats["fail"])),
        ("Discovery time", f"{seeder_stats['discovery_time']:.1f}s", "N/A (integrated)"),
        ("Scrape time", f"{seeder_stats['scrape_time']:.1f}s", f"{deep_stats['scrape_time']:.1f}s"),
        ("─" * 25, "─" * 20, "─" * 20),
        ("Overlap", str(len(overlap)), str(len(overlap))),
        ("Unique to method", str(len(seeder_only)), str(len(deep_only))),
    ]

    for label, s_val, d_val in rows:
        print(f"  {label:<25} {s_val:<20} {d_val:<20}")

    if seeder_only:
        print(f"\n  📌 Seeder-only URLs ({len(seeder_only)}):")
        for u in sorted(seeder_only)[:10]:
            print(f"     {u}")
        if len(seeder_only) > 10:
            print(f"     ... and {len(seeder_only) - 10} more")

    if deep_only:
        print(f"\n  📌 Deep-crawl-only URLs ({len(deep_only)}):")
        for u in sorted(deep_only)[:10]:
            print(f"     {u}")
        if len(deep_only) > 10:
            print(f"     ... and {len(deep_only) - 10} more")

    print()


async def run_list_scrape(output_dir: str, list_file: str) -> dict:
    os.makedirs(output_dir, exist_ok=True)
    print(f"\n{'='*60}")
    print(f"  🕸️  LIST SCRAPE MODE — from {list_file}")
    print(f"{'='*60}\n")

    if not os.path.exists(list_file):
        print(f"File {list_file} not found!")
        return {"urls_discovered": 0, "ok": 0, "fail": 0}

    with open(list_file, "r", encoding="utf-8") as f:
        urls = [line.strip() for line in f if line.strip()]

    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=10,
    )

    t0 = _time.time()
    ok_count = 0
    fail_count = 0

    async with AsyncWebCrawler(config=BROWSER_CONFIG) as crawler:
        for url in urls:
            print(f"  🔍 Fetching: {url}")
            result = await crawler.arun(url=url, config=run_config)
            
            if result.success:
                now = datetime.now(timezone.utc)
                page_title = (
                    (result.metadata or {}).get("title", "")
                    if hasattr(result, "metadata") and isinstance(result.metadata, dict)
                    else getattr(result, "title", "") or ""
                )
                filename = sanitize_filename(result.url)
                filepath = os.path.join(output_dir, filename)
                
                md_content = result.markdown or ""
                is_kr = is_mostly_korean(md_content)
                
                content = build_frontmatter(result.url, now, title=page_title, kr_only=is_kr) + md_content
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content)
                ok_count += 1
                print(f"  ✅ Saved: {filename}")
            else:
                fail_count += 1
                print(f"  ❌ {url}: {result.error_message}")

    return {
        "urls_discovered": len(urls),
        "ok": ok_count,
        "fail": fail_count
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="SeoulWalk Discovery Comparison — Seeder vs Deep Crawl"
    )
    parser.add_argument(
        "--mode",
        choices=["seeder", "deepcrawl", "both", "list"],
        default="both",
        help="Which discovery strategy to run (default: both)",
    )
    parser.add_argument(
        "--list-file",
        type=str,
        default="data/external_urls.txt",
        help="Path to a text file containing one URL per line for 'list' mode."
    )
    parser.add_argument(
        "-o", "--output",
        default="data",
        help="Base output directory (default: data/)",
    )
    args = parser.parse_args()

    async def _run():
        seeder_stats = None
        deep_stats = None

        if args.mode in ("seeder", "both"):
            seeder_stats = await run_seeder(os.path.join(args.output, "seeder"))

        if args.mode in ("deepcrawl", "both"):
            deep_stats = await run_deepcrawl(os.path.join(args.output, "deepcrawl"))

        if args.mode == "list":
            list_stats = await run_list_scrape(os.path.join(args.output, "deepcrawl"), args.list_file)
            print(f"\n  Done: {list_stats['ok']}/{list_stats['urls_discovered']} scraped successfully.")
            return

        if seeder_stats and deep_stats:
            print_comparison(seeder_stats, deep_stats)
        elif seeder_stats:
            print(f"\n  Done: {seeder_stats['ok']}/{seeder_stats['urls_discovered']} scraped successfully.")
        elif deep_stats:
            print(f"\n  Done: {deep_stats['ok']}/{deep_stats['urls_discovered']} scraped successfully.")

    asyncio.run(_run())


if __name__ == "__main__":
    main()
