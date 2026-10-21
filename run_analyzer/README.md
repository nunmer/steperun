# Run analyzer

FastAPI service behind steppe.run's run analyzer: OpenCV + MediaPipe key-frame
extraction (`frame_extractor.py`) and GPT-4o gait analysis (`analyzer.py`).

Deployed as a Vercel Python function (project `steperun-analyzer`, root
directory `run_analyzer/`, entrypoint `app.py`). Only the steppe.run backend
calls it; every `/api/*` request needs the `X-Analyzer-Key` header.

Env: `ANALYZER_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_URL` (videos are only
downloaded from its signed Storage URLs).

`vendor/gl/` + `gl_preload.py`: MediaPipe links libEGL/libGLESv2, which the
Vercel runtime lacks; see `gl_preload.py`.

Local: `uv sync && uv run uvicorn web:app --port 8000`

End-to-end check (uploads `samples/running-side-view.mov`, extracts, optionally
analyzes): `python scripts/smoke_test_analyzer.py [--analyze]` from the repo root.
Architecture and limits: `docs/ARCHITECTURE.md`.
