# Travellers Tour Guide AI - Project Context

## Project Overview
SeoulWalk is an AI-powered, voice-first tour guide application designed to assist foreign tourists visiting Seoul's royal heritage sites, primarily focusing on Gyeongbokgung Palace. The application is built to provide an "eyes-up" experience, allowing tourists to explore physically while the AI handles logistics, historical facts, and navigation.

The project consists of two main components:
1. **Backend Data Pipeline & CLI Prototyper (Python)**
2. **Frontend Mobile Application (React Native / Expo)**

---

## 1. Backend Data Pipeline & AI Logic
The root directory contains a set of Python scripts that form the Retrieval-Augmented Generation (RAG) pipeline and a CLI testing tool.

### Core Scripts:
*   **`discover.py`**: Discovers relevant URLs to scrape from the target domain (`royal.khs.go.kr`). It implements two strategies using `crawl4ai`:
    *   **Seeder Mode**: Pulls URLs from the sitemap.
    *   **Deep Crawl Mode**: Performs a Breadth-First Search (BFS) starting from specific English hub pages.
*   **`scraper.py`**: Takes a list of URLs (e.g., from a CSV like `scrape_this.csv`) and uses `crawl4ai` to scrape the web pages, converting them into clean Markdown files with YAML frontmatter containing metadata.
*   **`ingest.py`**: Reads the scraped Markdown files (stored in `data/deepcrawl/`), cleans out navigation boilerplate and noise, chunks the text semantically, and generates embeddings using `sentence-transformers` (`all-MiniLM-L6-v2`). The chunks are stored in a persistent ChromaDB collection (`data/chroma_db/`).
*   **`query_rag.py`**: A utility script to search the ChromaDB knowledge base for a given query. It can also generate a complete RAG-based answer using the OpenRouter API (Nemotron model).
*   **`seoulwalk_cli.py`**: A sophisticated CLI prototyper that simulates a multi-turn conversation with the AI guide.
    *   Simulates GPS location and time.
    *   Retrieves context from the live ChromaDB.
    *   Queries OpenRouter models (default: NVIDIA Nemotron 3 Nano).
    *   Supports a **Voice Mode** using AssemblyAI for Speech-to-Text (STT) and ElevenLabs for Text-to-Speech (TTS).
*   **`openrouter_query.py`**: A simple tool to query the chosen OpenRouter LLM and measure its response time.

### Data Storage:
*   **`data/`**: The main directory for scraped data and the database.
    *   `data/deepcrawl/` and `data/seeder/`: Store the downloaded Markdown files.
    *   `data/chroma_db/`: The SQLite and binary files for the Chroma vector database.
    *   `data/*_urls.txt`: Text files containing lists of discovered URLs.

---

## 2. Frontend Mobile Application (`tour-guide-app/`)
The frontend is built using React Native and Expo, designed as a mobile app for tourists to use on the go.

### Tech Stack:
*   **Framework**: React Native with Expo (SDK ~54).
*   **Language**: TypeScript.
*   **State Management**: Zustand.
*   **Mapping**: `react-native-maps`.
*   **Device APIs**: `expo-location` (GPS), `expo-camera`, `expo-av` (audio playback), `@react-native-community/netinfo` (network status).
*   **Icons**: FontAwesome.

### Application Structure (`tour-guide-app/src/`):
*   **`components/`**: UI components.
*   **`screens/`**: Application screens (e.g., `MainMapScreen.tsx`).
*   **`hooks/`**: Custom React hooks.
    *   `useLocationTracking.ts`: Manages device GPS integration.
    *   `useVoiceInteraction.ts`: Manages the voice-first interaction flow.
*   **`services/`**: Integration with external services.
    *   `audioService.ts`: Handles STT and TTS audio flows.
    *   `llmService.ts`: Interfaces with the AI models for generating responses.
*   **`store/`**: Global state management (`appStore.ts`).
*   **`utils/`**: Helper utilities (`distanceCalculator.ts`).
*   **`data/`**: Static app data, such as predefined map points (`waypoints.json`).

---

## System Architecture & Persona
The AI operates with a strict "Zero-Guess Policy" for spatial reasoning. It uses egocentric directional language (e.g., "ahead of you") but is forbidden from guessing locations not explicitly mapped in its context to ensure user safety. It relies heavily on the generated RAG knowledge base for historical facts and logistical details (prices, hours).
