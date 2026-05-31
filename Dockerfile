FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8001

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-server.txt .
RUN pip install --no-cache-dir -r requirements-server.txt

COPY server ./server
COPY tour-guide-app/src/data ./tour-guide-app/src/data
COPY data/chroma_db ./data/chroma_db
COPY data/deepcrawl ./data/deepcrawl

RUN mkdir -p /app/data/trace_artifacts /app/data/voice_artifacts

EXPOSE 8001

CMD ["sh", "-c", "uvicorn server.main:app --host 0.0.0.0 --port ${PORT:-8001}"]
