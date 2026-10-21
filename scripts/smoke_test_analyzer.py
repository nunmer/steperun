#!/usr/bin/env python3
"""
End-to-end smoke test for the run analyzer (Vercel project steperun-analyzer).

Uploads a sample video to the private `run-videos` bucket, asks the analyzer
to extract key frames from its signed URL, then (with --analyze) sends those
frames to GPT-4o analysis. The uploaded video is always deleted afterwards.

Usage:
    python scripts/smoke_test_analyzer.py                 # extraction only
    python scripts/smoke_test_analyzer.py --analyze       # + LLM analysis (costs ~$0.02)
    python scripts/smoke_test_analyzer.py --url http://127.0.0.1:8000   # local service

Reads SUPABASE_URL / SUPABASE_SERVICE_KEY from .env and
RUN_ANALYZER_API_URL / RUN_ANALYZER_API_KEY from web/.env.local.
"""

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "web" / ".env.local")

from supabase import create_client  # noqa: E402

TEST_PATH = "_selftest/video.mov"


def post(url: str, body: bytes, headers: dict) -> dict:
    req = urllib.request.Request(url, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.load(resp)


def multipart(frames: list[dict]) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    body = b""
    for i, f in enumerate(frames):
        img = base64.b64decode(f["src"].split(",", 1)[1])
        body += (
            f'--{boundary}\r\nContent-Disposition: form-data; name="frames"; '
            f'filename="{i:03d}_key_{f["phase"]}.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'
        ).encode() + img + b"\r\n"
    return body + f"--{boundary}--\r\n".encode(), boundary


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default=os.getenv("RUN_ANALYZER_API_URL", "http://127.0.0.1:8000"))
    ap.add_argument("--key", default=os.getenv("RUN_ANALYZER_API_KEY", ""))
    ap.add_argument("--video", default=str(ROOT / "samples" / "running-side-view.mov"))
    ap.add_argument("--analyze", action="store_true", help="also run GPT-4o analysis")
    args = ap.parse_args()

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    bucket = client.storage.from_("run-videos")
    bucket.upload(TEST_PATH, Path(args.video).read_bytes(), {"content-type": "video/quicktime", "upsert": "true"})
    try:
        signed = bucket.create_signed_url(TEST_PATH, 600)["signedURL"]
        t = time.time()
        result = post(
            f"{args.url}/api/extract-url",
            json.dumps({"url": signed, "filename": "video.mov"}).encode(),
            {"Content-Type": "application/json", "X-Analyzer-Key": args.key},
        )
        frames = result["frames"]
        print(f"extract: {time.time() - t:.1f}s, {len(frames)} key frames, phases {sorted({f['phase'] for f in frames})}")
    except urllib.error.HTTPError as e:
        print(f"extract failed: HTTP {e.code} {e.read()[:300]!r}")
        return 1
    finally:
        bucket.remove([TEST_PATH])

    if args.analyze:
        body, boundary = multipart(frames)
        t = time.time()
        try:
            analysis = post(
                f"{args.url}/api/analyze-frames", body,
                {"Content-Type": f"multipart/form-data; boundary={boundary}", "X-Analyzer-Key": args.key},
            )
        except urllib.error.HTTPError as e:
            print(f"analyze failed: HTTP {e.code} {e.read()[:300]!r}")
            return 1
        print(f"analyze: {time.time() - t:.1f}s, overall_score={analysis.get('overall_score')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
