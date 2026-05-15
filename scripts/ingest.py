#!/usr/bin/env python3
"""
ingest.py — SeoulWalk RAG Ingestion Pipeline

Reads scraped Markdown files from data/deepcrawl/, cleans them,
chunks them into semantic segments, embeds via sentence-transformers,
and stores in a persistent ChromaDB collection.

Usage:
    python ingest.py                    # ingest from default dir
    python ingest.py -i data/deepcrawl  # custom input dir
    python ingest.py --reset            # wipe DB and re-ingest
"""

import argparse
import os
import re
import shutil
import textwrap
from datetime import datetime

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
CHROMA_DIR = "data/chroma_db"
COLLECTION_NAME = "seoulwalk"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
CHUNK_SIZE = 500       # target tokens (approx chars / 4)
CHUNK_OVERLAP = 50     # overlap in tokens


# ---------------------------------------------------------------------------
# Frontmatter parser
# ---------------------------------------------------------------------------
def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Return (metadata_dict, body_text) from a markdown file with YAML frontmatter."""
    meta: dict = {}
    body = text

    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            yaml_block = parts[1].strip()
            body = parts[2].strip()
            for line in yaml_block.split("\n"):
                if ":" in line:
                    key, _, value = line.partition(":")
                    meta[key.strip()] = value.strip()

    return meta, body


# ---------------------------------------------------------------------------
# Content cleaning
# ---------------------------------------------------------------------------

# Patterns that appear in the Korean site navigation boilerplate
_NAV_MARKERS = [
    "메인메뉴 바로가기",
    "본문 바로가기",
    "푸터 바로가기",
    "사이트맵",
    "검색창열기",
    "통합검색",
    "검색 창 닫기",
    "궁능바로가기서브메인선택열기",
    "이 페이지의 정보와 사용편의성에 만족하시나요",
    "매우만족 만족 보통 불만족 매우불만족",
    "관련사이트 바로가기",
    "유관기관 바로가기",
    "Korea Heritage Service Royal Palaces and Tombs Center",
    "관리소별 연락처",
    "관리소 별 연락처",
    "페이스북열기",
    "인스타그램열기",
    "트위터열기",
    "언어선택열기",
    "궁능유적본부 메인으로",
    "1일간 보이지 않기",
    "WEBAWARD",
    "WA인증마크",
    "상단으로 이동",
    "개인정보처리방침",
    "저작권정책",
]

# Repeated section headers that are just nav labels
_SECTION_NAV_HEADERS = [
    "궁능소개",
    "통합예약",
    "관람안내",
    "행사마당",
    "자료마당",
    "소통마당",
    "기관소개",
    "어제를 담아 내일에 전합니다.",
]


def clean_markdown(text: str) -> str:
    """Strip navigation boilerplate, images, and noise from scraped markdown."""
    lines = text.split("\n")
    cleaned_lines: list[str] = []
    skip_mode = False

    for line in lines:
        stripped = line.strip()

        # Skip empty lines in sequence
        if not stripped:
            if cleaned_lines and cleaned_lines[-1] == "":
                continue
            cleaned_lines.append("")
            continue

        # Skip lines that are purely navigation markers
        if any(marker in stripped for marker in _NAV_MARKERS):
            continue

        # Skip repeated section nav headers
        if stripped in _SECTION_NAV_HEADERS:
            continue

        # Skip image-only lines: ![...](...)
        if re.match(r"^!\[.*?\]\(.*?\)$", stripped):
            continue

        # Skip lines that are just markdown links with no text content
        # e.g. "[](https://...)" or "[![...](img)](link)"
        link_only = re.sub(r"\[!\[.*?\]\(.*?\)\]\(.*?\)", "", stripped)
        link_only = re.sub(r"\[.*?\]\(.*?\)", "", link_only)
        link_only = link_only.strip()
        if not link_only and stripped.startswith("["):
            continue

        # Skip lines that are purely icon references
        if stripped.startswith("[![") and stripped.endswith(")"):
            continue

        cleaned_lines.append(line)

    result = "\n".join(cleaned_lines)

    # Collapse multiple blank lines
    result = re.sub(r"\n{3,}", "\n\n", result)

    return result.strip()


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------
def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """
    Split text into chunks of approximately `chunk_size` tokens.
    Uses paragraph boundaries when possible for semantic coherence.
    """
    if not text.strip():
        return []

    # Rough token estimate: 1 token ≈ 4 chars for English, ~2 chars for Korean
    char_limit = chunk_size * 3  # conservative for mixed content
    overlap_chars = overlap * 3

    # Split on double newlines (paragraph boundaries)
    paragraphs = re.split(r"\n\n+", text)

    chunks: list[str] = []
    current_chunk: list[str] = []
    current_len = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        para_len = len(para)

        if current_len + para_len > char_limit and current_chunk:
            # Save current chunk
            chunk_text_str = "\n\n".join(current_chunk)
            chunks.append(chunk_text_str)

            # Keep overlap: take last paragraph(s) that fit in overlap window
            overlap_parts: list[str] = []
            overlap_len = 0
            for p in reversed(current_chunk):
                if overlap_len + len(p) <= overlap_chars:
                    overlap_parts.insert(0, p)
                    overlap_len += len(p)
                else:
                    break
            current_chunk = overlap_parts
            current_len = overlap_len

        current_chunk.append(para)
        current_len += para_len

    # Don't forget the last chunk
    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    # If the text was too short to chunk, return it as-is
    if not chunks and text.strip():
        chunks.append(text.strip())

    return chunks


# ---------------------------------------------------------------------------
# Ingestion
# ---------------------------------------------------------------------------
def ingest(input_dir: str, reset: bool = False) -> dict:
    """Main ingestion pipeline."""
    chroma_path = os.path.join(os.path.dirname(input_dir) or "data", "chroma_db")

    if reset and os.path.exists(chroma_path):
        print(f"  🗑️  Resetting ChromaDB at {chroma_path}")
        shutil.rmtree(chroma_path)

    # Initialize ChromaDB
    print(f"\n{'='*60}")
    print(f"  📦 SeoulWalk RAG Ingestion Pipeline")
    print(f"{'='*60}\n")

    client = chromadb.PersistentClient(path=chroma_path)
    embedding_fn = SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL,
    )

    # Get or create collection
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_fn,
        metadata={"description": "SeoulWalk tour guide knowledge base"},
    )

    # Check existing count
    existing = collection.count()
    if existing > 0 and not reset:
        print(f"  ℹ️  Collection already has {existing} chunks. Use --reset to rebuild.")
        print(f"  ℹ️  Adding only new documents...\n")

    # Gather markdown files
    md_files = sorted([
        f for f in os.listdir(input_dir)
        if f.endswith(".md")
    ])
    print(f"  📄 Found {len(md_files)} markdown files in {input_dir}/\n")

    total_chunks = 0
    total_docs = 0
    skipped = 0

    for i, filename in enumerate(md_files):
        filepath = os.path.join(input_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            raw = f.read()

        # Parse frontmatter
        meta, body = parse_frontmatter(raw)
        title = meta.get("title", filename)
        source = meta.get("source", "")
        kr_only = title.startswith("[KR_ONLY]")

        if kr_only:
            title = title.replace("[KR_ONLY]", "").strip()

        # Clean the body
        cleaned = clean_markdown(body)
        if len(cleaned) < 50:
            skipped += 1
            continue

        # Chunk
        chunks = chunk_text(cleaned)
        if not chunks:
            skipped += 1
            continue

        # Prepare batch for ChromaDB
        ids = [f"{filename}::chunk_{j}" for j in range(len(chunks))]
        documents = chunks
        metadatas = [
            {
                "source": source,
                "title": title,
                "kr_only": kr_only,
                "chunk_index": j,
                "total_chunks": len(chunks),
                "filename": filename,
            }
            for j in range(len(chunks))
        ]

        # Upsert (idempotent)
        collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
        )

        total_chunks += len(chunks)
        total_docs += 1

        status = "🇰🇷" if kr_only else "🇬🇧"
        print(f"  {status} [{i+1:3d}/{len(md_files)}] {title[:60]:<60} → {len(chunks)} chunks")

    # Final stats
    final_count = collection.count()
    print(f"\n{'='*60}")
    print(f"  ✅ Ingestion Complete!")
    print(f"{'='*60}")
    print(f"  Documents processed: {total_docs}")
    print(f"  Documents skipped:   {skipped}")
    print(f"  Total chunks stored: {final_count}")
    print(f"  Embedding model:     {EMBEDDING_MODEL}")
    print(f"  ChromaDB path:       {chroma_path}")
    print()

    return {
        "docs_processed": total_docs,
        "docs_skipped": skipped,
        "total_chunks": final_count,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="SeoulWalk RAG Ingestion — Markdown → ChromaDB"
    )
    parser.add_argument(
        "-i", "--input",
        default="data/deepcrawl",
        help="Directory containing scraped .md files (default: data/deepcrawl)",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Wipe the existing ChromaDB and re-ingest from scratch",
    )
    args = parser.parse_args()

    ingest(args.input, reset=args.reset)


if __name__ == "__main__":
    main()
