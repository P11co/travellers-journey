"""
rag.py — RAG Service for the Backend
Handles querying ChromaDB for knowledge base retrieval.
"""

from __future__ import annotations

import os

# Optional imports because ChromaDB is heavy and we only initialize it when needed
_chroma_client = None
_embedding_fn = None
_collection = None

# We assume data/chroma_db is at the root
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CHROMA_DIR = os.path.join(_PROJECT_ROOT, "data", "chroma_db")
COLLECTION_NAME = "seoulwalk"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"


def _get_collection():
    """Lazy load ChromaDB to avoid blocking import times on startup."""
    global _chroma_client, _embedding_fn, _collection
    if _collection is None:
        import chromadb
        from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

        _chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
        _embedding_fn = SentenceTransformerEmbeddingFunction(model_name=EMBEDDING_MODEL)
        _collection = _chroma_client.get_collection(
            name=COLLECTION_NAME, embedding_function=_embedding_fn
        )
    return _collection


def search_rag(query: str, top_k: int = 3) -> str:
    """
    Search ChromaDB for the most relevant knowledge base chunks.
    Returns a formatted string block of context to inject into the LLM.
    This function is synchronous and should be run in a thread executor if called from async.
    """
    if not os.path.exists(CHROMA_DIR):
        return ""

    try:
        collection = _get_collection()
        results = collection.query(
            query_texts=[query],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )

        if not results or not results["documents"] or not results["documents"][0]:
            return ""

        docs = results["documents"][0]
        
        # Build the RAG context block
        lines = ["KNOWLEDGE BASE EXPERT CONTEXT:"]
        for i, doc in enumerate(docs, 1):
            lines.append(f"[Snippet {i}]\n{doc}\n")
            
        return "\n".join(lines)

    except Exception as e:
        print(f"RAG Error: {e}")
        return ""
