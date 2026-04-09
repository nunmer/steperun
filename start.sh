#!/bin/bash
set -e

# Start Python extractor service in background
cd /app/run-analyzer
uvicorn web:app --host 127.0.0.1 --port 8000 &

# Start Next.js
cd /app/web
node server.js
