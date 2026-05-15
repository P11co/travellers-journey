#!/usr/bin/env python3
"""
query_rag.py — SeoulWalk RAG Query Interface

Search the ChromaDB vector store and optionally generate a full
RAG answer using the OpenRouter Nemotron model.

Usage:
    python query_rag.py "What is the admission fee for Gyeongbokgung?"
    python query_rag.py "history of Changdeokgung" --no-kr
    python query_rag.py "royal guard ceremony" --answer
"""

import argparse
import os
import sys
import textwrap

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
CHROMA_DIR = "data/chroma_db"
COLLECTION_NAME = "seoulwalk"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"


def get_collection():
    """Load the persistent ChromaDB collection."""
    client = chromadb.PersistentClient(path=CHROMA_DIR)
    embedding_fn = SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL,
    )
    return client.get_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_fn,
    )


def search(query: str, top_k: int = 5, exclude_kr: bool = False) -> dict:
    """Perform semantic search against the vector store."""
    collection = get_collection()

    where_filter = None
    if exclude_kr:
        where_filter = {"kr_only": False}

    results = collection.query(
        query_texts=[query],
        n_results=top_k,
        where=where_filter,
        include=["documents", "metadatas", "distances"],
    )

    return results


def format_results(results: dict) -> str:
    """Pretty-print search results."""
    lines = []
    docs = results["documents"][0]
    metas = results["metadatas"][0]
    distances = results["distances"][0]

    for i, (doc, meta, dist) in enumerate(zip(docs, metas, distances)):
        similarity = 1 - dist  # ChromaDB uses L2 distance by default
        kr_tag = " 🇰🇷" if meta.get("kr_only") else ""
        title = meta.get("title", "Unknown")
        source = meta.get("source", "")
        chunk_idx = meta.get("chunk_index", "?")
        total = meta.get("total_chunks", "?")

        lines.append(f"\n{'─'*60}")
        lines.append(f"  #{i+1}  {title}{kr_tag}")
        lines.append(f"  📍 {source}")
        lines.append(f"  📊 Similarity: {similarity:.3f}  |  Chunk {chunk_idx}/{total}")
        lines.append(f"{'─'*60}")

        # Show first 300 chars of the chunk
        preview = doc[:300].replace("\n", " ")
        if len(doc) > 300:
            preview += "..."
        lines.append(f"  {preview}")

    return "\n".join(lines)


def generate_answer(query: str, context_chunks: list[str], titles: list[str]) -> str:
    """Send context + query to OpenRouter Nemotron for a RAG answer."""
    try:
        from openai import OpenAI
    except ImportError:
        return "Error: openai package not installed. Run: pip install openai"

    api_key = os.getenv("EXPO_PUBLIC_OPENROUTER_API_KEY") or os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        # Try loading from .env
        env_path = os.path.join("tour-guide-app", ".env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if "OPENROUTER_API_KEY" in line and "=" in line:
                        api_key = line.split("=", 1)[1].strip().strip('"')
                        break

    if not api_key:
        return "Error: No OpenRouter API key found."

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )

    # Build the context block
    context_parts = []
    for i, (chunk, title) in enumerate(zip(context_chunks, titles)):
        context_parts.append(f"[Source {i+1}: {title}]\n{chunk}")
    context_block = "\n\n---\n\n".join(context_parts)

    system_prompt = textwrap.dedent("""\
        You are SeoulWalk, a friendly and knowledgeable AI tour guide for 
        Seoul's royal heritage sites. Answer the visitor's question using 
        ONLY the provided context. If the context doesn't contain the answer,
        say so honestly. Keep your answer concise and conversational.
        
        If context is in Korean, translate the relevant parts to English 
        before answering.
    """)

    response = client.chat.completions.create(
        model="nvidia/nemotron-3-nano-30b-a3b:free",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Context:\n{context_block}\n\nQuestion: {query}"},
        ],
        max_tokens=500,
        temperature=0.3,
    )

    return response.choices[0].message.content


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="SeoulWalk RAG Query — Search the knowledge base"
    )
    parser.add_argument(
        "query",
        help="Your question about Seoul's royal heritage sites",
    )
    parser.add_argument(
        "-k", "--top-k",
        type=int,
        default=5,
        help="Number of results to return (default: 5)",
    )
    parser.add_argument(
        "--no-kr",
        action="store_true",
        help="Exclude Korean-only pages from results",
    )
    parser.add_argument(
        "--answer",
        action="store_true",
        help="Generate a full RAG answer using Nemotron via OpenRouter",
    )
    args = parser.parse_args()

    print(f"\n🔍 Searching: \"{args.query}\"")
    if args.no_kr:
        print("  (excluding Korean-only pages)")

    results = search(args.query, top_k=args.top_k, exclude_kr=args.no_kr)

    if not results["documents"][0]:
        print("\n  ❌ No results found.")
        return

    print(format_results(results))

    if args.answer:
        print(f"\n{'='*60}")
        print(f"  🤖 SeoulWalk AI Answer")
        print(f"{'='*60}\n")
        try:
            answer = generate_answer(
                args.query,
                results["documents"][0],
                [m.get("title", "") for m in results["metadatas"][0]],
            )
            print(f"  {answer}")
        except Exception as e:
            print(f"  ❌ Could not generate answer: {e}")
        print()


if __name__ == "__main__":
    main()
