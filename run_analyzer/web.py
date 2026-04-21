"""FastAPI web server for the running technique analyzer."""

import base64
import logging
import os
import shutil
import uuid
from pathlib import Path

import cv2
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from frame_extractor import extract_key_frames, save_key_frames
from analyzer import analyze_frames

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")

app = FastAPI(title="Run Analyzer")

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("output")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

app.mount("/output", StaticFiles(directory="output"), name="output")


@app.get("/", response_class=HTMLResponse)
async def index():
    html_path = Path(__file__).parent / "templates" / "index.html"
    return HTMLResponse(html_path.read_text(encoding="utf-8"))


@app.post("/api/extract")
async def extract(video: UploadFile = File(...)):
    """Upload video and extract key frames."""
    job_id = str(uuid.uuid4())[:8]
    job_dir = OUTPUT_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    suffix = Path(video.filename or "video.mov").suffix
    video_path = UPLOAD_DIR / f"{job_id}{suffix}"

    with open(video_path, "wb") as f:
        shutil.copyfileobj(video.file, f)

    try:
        key_frames = extract_key_frames(video_path, max_frames=12)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
    finally:
        video_path.unlink(missing_ok=True)

    if not key_frames:
        raise HTTPException(
            status_code=422,
            detail="No running person detected. Ensure the video shows a runner.",
        )

    key_count = sum(1 for kf in key_frames if kf.is_key_frame)
    motion_count = len(key_frames) - key_count
    logging.info(
        f"[extract] Job {job_id}: {len(key_frames)} total frames "
        f"({key_count} key, {motion_count} motion)"
    )

    paths = save_key_frames(key_frames, job_dir)

    frames = []
    for p, kf in zip(paths, key_frames):
        img_bytes = p.read_bytes()
        b64 = base64.b64encode(img_bytes).decode()
        frames.append({
            "src": f"data:image/jpeg;base64,{b64}",
            "phase": kf.phase,
            "frame_number": kf.frame_number,
            "timestamp_ms": kf.timestamp_ms,
            "is_key_frame": kf.is_key_frame,
        })

    return JSONResponse({"job_id": job_id, "frames": frames})


@app.post("/api/analyze")
async def analyze(job_id: str = Form(...)):
    """Analyze previously extracted frames with LLM."""
    job_dir = OUTPUT_DIR / job_id
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="Job not found")

    frame_paths = sorted(job_dir.glob("*.jpg"))
    if not frame_paths:
        raise HTTPException(status_code=404, detail="No frames found")

    try:
        result = analyze_frames(frame_paths)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return JSONResponse(result)


@app.post("/api/analyze-frames")
async def analyze_uploaded_frames(
    frames: list[UploadFile] = File(...),
):
    """Analyze frames uploaded directly (called by Next.js backend)."""
    job_id = str(uuid.uuid4())[:8]
    job_dir = OUTPUT_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    frame_paths = []
    for i, f in enumerate(frames):
        filename = f.filename or f"{i:02d}_frame.jpg"
        path = job_dir / filename
        with open(path, "wb") as out:
            shutil.copyfileobj(f.file, out)
        frame_paths.append(path)

    if not frame_paths:
        raise HTTPException(status_code=400, detail="No frames provided")

    try:
        result = analyze_frames(sorted(frame_paths))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)

    return JSONResponse(result)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
