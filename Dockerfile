# ============================================================
# Combined: Next.js + Python run-analyzer in one container
# ============================================================

# ---------- Stage 1: Build Next.js ----------
FROM node:20-slim AS web-builder

WORKDIR /build
COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ .
# Build needs public env vars at build time for prerendering.
# SUPABASE_URL / SUPABASE_SERVICE_KEY are runtime-only (lazy-init client) and
# come from `fly secrets set ...` — never bake them into the image.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

# ---------- Stage 2: Runtime ----------
FROM python:3.11-slim

# Install Node.js 20
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl libgl1 libglib2.0-0 libgles2 libegl1 ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ----- Python run-analyzer -----
COPY run_analyzer/requirements.txt /app/run-analyzer/requirements.txt
RUN pip install --no-cache-dir -r /app/run-analyzer/requirements.txt

# Download pose model at build time
RUN curl -sL -o /app/run-analyzer/pose_landmarker_heavy.task \
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task"

COPY run_analyzer/web.py          /app/run-analyzer/
COPY run_analyzer/analyzer.py     /app/run-analyzer/
COPY run_analyzer/frame_extractor.py /app/run-analyzer/

# ----- Next.js standalone -----
COPY --from=web-builder /build/.next/standalone /app/web
COPY --from=web-builder /build/.next/static     /app/web/.next/static
COPY --from=web-builder /build/public           /app/web/public

# ----- Start script -----
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Create dirs for temporary uploads
RUN mkdir -p /app/run-analyzer/uploads /app/run-analyzer/output

EXPOSE 3000

CMD ["/app/start.sh"]
