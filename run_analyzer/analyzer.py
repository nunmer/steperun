"""Send extracted key frames to LLM for running technique analysis.

Uses OpenAI GPT-4o via OPENAI_API_KEY.
"""

import base64
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are an expert running biomechanics coach. Analyze the provided key frames \
from a running video. Each frame is labeled with its gait phase \
(foot_strike, mid_stance, toe_off, flight).

For each analysis section, specify which gait phase frame best illustrates \
the point you are making via the "relevant_phase" field. This links your \
feedback to a specific moment in the runner's stride so they can see exactly \
what you are referring to.

Return your analysis as a JSON object with this exact structure:
{
  "sections": [
    {
      "title": "Foot Strike Pattern",
      "relevant_phase": "foot_strike",
      "rating": "good" | "warning" | "bad",
      "summary": "One-line verdict",
      "details": "2-3 sentence explanation"
    },
    {
      "title": "Cadence & Stride",
      "relevant_phase": "mid_stance",
      "rating": "good" | "warning" | "bad",
      "summary": "One-line verdict",
      "details": "2-3 sentence explanation"
    },
    {
      "title": "Posture",
      "relevant_phase": "mid_stance",
      "rating": "good" | "warning" | "bad",
      "summary": "...",
      "details": "..."
    },
    {
      "title": "Arm Mechanics",
      "relevant_phase": "mid_stance",
      "rating": "good" | "warning" | "bad",
      "summary": "...",
      "details": "..."
    },
    {
      "title": "Hip & Pelvis",
      "relevant_phase": "toe_off",
      "rating": "good" | "warning" | "bad",
      "summary": "...",
      "details": "..."
    },
    {
      "title": "Knee Drive",
      "relevant_phase": "flight",
      "rating": "good" | "warning" | "bad",
      "summary": "...",
      "details": "..."
    },
    {
      "title": "Overall Efficiency",
      "relevant_phase": "mid_stance",
      "rating": "good" | "warning" | "bad",
      "summary": "...",
      "details": "..."
    }
  ],
  "recommendations": [
    {"priority": 1, "text": "Most impactful recommendation"},
    {"priority": 2, "text": "Second recommendation"},
    {"priority": 3, "text": "Third recommendation"}
  ],
  "overall_score": 75
}

Rules:
- "rating" must be exactly "good", "warning", or "bad"
- "relevant_phase" must be one of: "foot_strike", "mid_stance", "toe_off", "flight"
- Choose the relevant_phase that best shows the issue or strength you describe
- The examples above are suggestions; pick whichever phase actually best illustrates your point
- "overall_score" is 0-100
- Return ONLY the JSON object, no markdown fences, no extra text.\
"""

DEFAULT_MODEL = "gpt-4o"


def _encode_image(path: Path) -> tuple[str, str]:
    """Return (base64_data, media_type) for an image file."""
    data = base64.standard_b64encode(path.read_bytes()).decode("utf-8")
    suffix = path.suffix.lower()
    media_type = "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/png"
    return data, media_type


def _is_key_frame(path: Path) -> bool:
    """Check if a frame file is a key frame (analysis frame).

    Supports both old format (00_phase_123.jpg) and
    new format (003_key_phase_123.jpg / 003_motion_phase_123.jpg).
    """
    parts = path.stem.split("_")
    if len(parts) >= 2 and parts[1] in ("key", "motion"):
        return parts[1] == "key"
    # Old format: all frames are key frames
    return True


def _phase_from_filename(path: Path) -> str:
    """Extract phase name from filename.

    Supports both old format (00_phase_123.jpg) and
    new format (003_key_phase_123.jpg).
    """
    parts = path.stem.split("_")
    if len(parts) >= 2 and parts[1] in ("key", "motion"):
        # New format: 003_key_foot_strike_42 → foot_strike
        return "_".join(parts[2:-1])
    # Old format: 00_foot_strike_42 → foot_strike
    return path.stem.split("_", 1)[1].rsplit("_", 1)[0]


def _analyze_openai(frame_paths: list[Path], model: str) -> str:
    """Analyze via OpenAI GPT-4o."""
    from openai import OpenAI

    client = OpenAI()

    content: list[dict] = [
        {"type": "text", "text": "Analyze this runner's technique from the following key frames:"},
    ]
    for path in frame_paths:
        image_data, media_type = _encode_image(path)
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:{media_type};base64,{image_data}",
            },
        })
        content.append({
            "type": "text",
            "text": f"Frame: {path.stem} (phase: {_phase_from_filename(path)})",
        })

    response = client.chat.completions.create(
        model=model,
        max_tokens=4096,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ],
    )
    if response.usage:
        logger.info(
            f"[openai] Actual usage — input: {response.usage.prompt_tokens:,} tokens, "
            f"output: {response.usage.completion_tokens:,} tokens"
        )
    return response.choices[0].message.content


def analyze_frames(
    frame_paths: list[Path],
    model: str | None = None,
) -> dict:
    """Send key frames to LLM for technique analysis.

    Automatically filters to only key frames (is_key_frame) from the input.
    Returns parsed JSON dict with sections, recommendations, overall_score.
    """
    # Only send key frames to the LLM — motion frames are for playback only
    key_paths = [p for p in frame_paths if _is_key_frame(p)]
    if not key_paths:
        key_paths = frame_paths  # fallback: treat all as key frames

    total_image_bytes = sum(p.stat().st_size for p in key_paths)
    est_image_tokens = len(key_paths) * 765  # ~765 per low-detail image
    est_system_tokens = len(SYSTEM_PROMPT) // 4
    est_total = est_image_tokens + est_system_tokens

    logger.info(
        f"[analyze] {len(frame_paths)} total frames received, "
        f"{len(key_paths)} key frames sent to LLM | "
        f"~{total_image_bytes / 1024:.0f} KB image data | "
        f"~{est_total:,} estimated input tokens (images: ~{est_image_tokens:,}, "
        f"system prompt: ~{est_system_tokens:,})"
    )

    model = model or DEFAULT_MODEL
    raw = _analyze_openai(key_paths, model)

    # Strip markdown fences if present
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[:-3]

    return json.loads(text)
