"""FastAPI web server for the running technique analyzer."""

import base64
import hmac
import logging
import os
import shutil
import urllib.request
import uuid
from pathlib import Path

import cv2
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles

from frame_extractor import extract_key_frames, save_key_frames
from analyzer import analyze_frames

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")

app = FastAPI(title="Run Analyzer")

# Vercel Functions only allow writes under /tmp.
WORK_DIR = Path("/tmp/run-analyzer") if os.getenv("VERCEL") else Path(".")
UPLOAD_DIR = WORK_DIR / "uploads"
OUTPUT_DIR = WORK_DIR / "output"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/output", StaticFiles(directory=OUTPUT_DIR), name="output")

# Shared secret between the Next.js backend and this service. When the
# service is publicly reachable (HF Spaces) it must be set; unset is only
# for local development.
API_KEY = os.getenv("ANALYZER_API_KEY", "")
if not API_KEY:
    logging.warning("ANALYZER_API_KEY is not set: /api/* is unauthenticated (dev only)")

# /api/extract-url only downloads videos from this prefix (Supabase Storage).
VIDEO_URL_PREFIX = os.getenv("SUPABASE_URL", "").rstrip("/") + "/storage/v1/object/sign/"
MAX_VIDEO_BYTES = 60 * 1024 * 1024
# Vercel caps function responses at 4.5 MB: /api/extract-url returns only key
# frames (the only ones the site stores), re-encoded to at most this size.
MAX_FRAME_SIDE = 1280


@app.middleware("http")
async def require_api_key(request: Request, call_next):
    if API_KEY and request.url.path.startswith("/api/"):
        given = request.headers.get("x-analyzer-key", "")
        if not hmac.compare_digest(given, API_KEY):
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    return await call_next(request)


@app.get("/", response_class=HTMLResponse)
async def index():
    html_path = Path(__file__).parent / "templates" / "index.html"
    return HTMLResponse(html_path.read_text(encoding="utf-8"))


@app.post("/api/extract")
async def extract(video: UploadFile = File(...)):
    """Upload video and extract key frames."""
    job_id = str(uuid.uuid4())[:8]
    suffix = Path(video.filename or "video.mov").suffix
    video_path = UPLOAD_DIR / f"{job_id}{suffix}"

    with open(video_path, "wb") as f:
        shutil.copyfileobj(video.file, f)

    return JSONResponse(_extract_frames(job_id, video_path, keep_frames=True))


class ExtractUrlRequest(BaseModel):
    url: str
    filename: str = "video.mov"


@app.post("/api/extract-url")
def extract_url(body: ExtractUrlRequest):
    """Download a video from a signed Supabase Storage URL and extract key frames."""
    if not VIDEO_URL_PREFIX.startswith("http") or not body.url.startswith(VIDEO_URL_PREFIX):
        raise HTTPException(status_code=400, detail="Video URL not allowed")

    job_id = str(uuid.uuid4())[:8]
    suffix = Path(body.filename).suffix or ".mov"
    video_path = UPLOAD_DIR / f"{job_id}{suffix}"
    try:
        _download(body.url, video_path)
    except HTTPException:
        video_path.unlink(missing_ok=True)
        raise
    except Exception as e:
        video_path.unlink(missing_ok=True)
        logging.error(f"[extract-url] download failed: {e}")
        raise HTTPException(status_code=502, detail="Could not download the video")

    return JSONResponse(_extract_frames(job_id, video_path, keep_frames=False, key_only=True))


def _download(url: str, dest: Path) -> None:
    with urllib.request.urlopen(url, timeout=60) as resp, open(dest, "wb") as out:
        total = 0
        while chunk := resp.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_VIDEO_BYTES:
                raise HTTPException(status_code=413, detail="Video is too large")
            out.write(chunk)


def _extract_frames(job_id: str, video_path: Path, keep_frames: bool, key_only: bool = False) -> dict:
    """Extract key frames from a local video (deleted afterwards)."""
    job_dir = OUTPUT_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    try:
        key_frames = extract_key_frames(video_path, max_frames=12)
    except Exception as e:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=str(e))
    finally:
        video_path.unlink(missing_ok=True)

    if not key_frames:
        shutil.rmtree(job_dir, ignore_errors=True)
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
        if key_only and not kf.is_key_frame:
            continue
        img_bytes = _compact_jpeg(p) if key_only else p.read_bytes()
        b64 = base64.b64encode(img_bytes).decode()
        frames.append({
            "src": f"data:image/jpeg;base64,{b64}",
            "phase": kf.phase,
            "frame_number": kf.frame_number,
            "timestamp_ms": kf.timestamp_ms,
            "is_key_frame": kf.is_key_frame,
        })

    if not keep_frames:
        shutil.rmtree(job_dir, ignore_errors=True)
    return {"job_id": job_id, "frames": frames}


def _compact_jpeg(path: Path) -> bytes:
    """Re-encode a frame so its longest side is at most MAX_FRAME_SIDE."""
    img = cv2.imread(str(path))
    if img is None:
        return path.read_bytes()
    h, w = img.shape[:2]
    scale = MAX_FRAME_SIDE / max(h, w)
    if scale < 1:
        img = cv2.resize(img, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return buf.tobytes() if ok else path.read_bytes()


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
