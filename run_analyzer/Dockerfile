FROM python:3.11-slim

# OpenCV system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download pose model at build time (not every cold start)
RUN curl -sL -o pose_landmarker_heavy.task \
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task"

COPY . .

EXPOSE 8080

CMD ["uvicorn", "web:app", "--host", "0.0.0.0", "--port", "8080"]
