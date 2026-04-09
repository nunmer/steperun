"""Send extracted key frames to LLM for running technique analysis.

Supports:
  - aws: Claude via AWS Bedrock (uses AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)
  - openai: GPT-4o via OpenAI API (uses OPENAI_API_KEY)
"""

import base64
import json
from pathlib import Path

SYSTEM_PROMPT = """\
You are an expert running biomechanics coach. Analyze the provided key frames \
from a running video. Each frame is labeled with its gait phase \
(foot_strike, mid_stance, toe_off, flight).

Return your analysis as a JSON object with this exact structure:
{
  "sections": [
    {
      "title": "Foot Strike Pattern",
      "rating": "good" | "warning" | "bad",
      "summary": "One-line verdict",
      "details": "2-3 sentence explanation"
    },
    {
      "title": "Cadence & Stride",
      "rating": "good" | "warning" | "bad",
      "summary": "One-line verdict",
      "details": "2-3 sentence explanation"
    },
    {
      "title": "Posture",
      "rating": "good" | "warning" | "bad",
      "summary": "...",
      "details": "..."
    },
    {
      "title": "Arm Mechanics",
      "rating": "good" | "warning" | "bad",
      "summary": "...",
      "details": "..."
    },
    {
      "title": "Hip & Pelvis",
      "rating": "good" | "warning" | "bad",
      "summary": "...",
      "details": "..."
    },
    {
      "title": "Knee Drive",
      "rating": "good" | "warning" | "bad",
      "summary": "...",
      "details": "..."
    },
    {
      "title": "Overall Efficiency",
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
- "overall_score" is 0-100
- Return ONLY the JSON object, no markdown fences, no extra text.\
"""

DEFAULT_MODELS = {
    "aws": "eu.anthropic.claude-sonnet-4-20250514-v1:0",
    "openai": "gpt-4o",
}


def _encode_image(path: Path) -> tuple[str, str]:
    """Return (base64_data, media_type) for an image file."""
    data = base64.standard_b64encode(path.read_bytes()).decode("utf-8")
    suffix = path.suffix.lower()
    media_type = "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/png"
    return data, media_type


def _phase_from_filename(path: Path) -> str:
    return path.stem.split("_", 1)[1].rsplit("_", 1)[0]


def _analyze_aws(frame_paths: list[Path], model: str) -> str:
    """Analyze via Claude on AWS Bedrock."""
    import anthropic

    client = anthropic.AnthropicBedrock()

    content: list[dict] = [
        {"type": "text", "text": "Analyze this runner's technique from the following key frames:"},
    ]
    for path in frame_paths:
        image_data, media_type = _encode_image(path)
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": image_data,
            },
        })
        content.append({
            "type": "text",
            "text": f"Frame: {path.stem} (phase: {_phase_from_filename(path)})",
        })

    message = client.messages.create(
        model=model,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )
    return message.content[0].text


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
    return response.choices[0].message.content


def analyze_frames(
    frame_paths: list[Path],
    provider: str = "aws",
    model: str | None = None,
) -> dict:
    """Send key frames to LLM for technique analysis.

    Returns parsed JSON dict with sections, recommendations, overall_score.
    """
    model = model or DEFAULT_MODELS[provider]

    if provider == "aws":
        raw = _analyze_aws(frame_paths, model)
    elif provider == "openai":
        raw = _analyze_openai(frame_paths, model)
    else:
        raise ValueError(f"Unknown provider: {provider}. Use 'aws' or 'openai'.")

    # Strip markdown fences if present
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[:-3]

    return json.loads(text)
