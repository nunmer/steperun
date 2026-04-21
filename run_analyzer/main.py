"""Running technique analyzer — extract key frames from video and analyze with LLM."""

import argparse
import json
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from frame_extractor import extract_key_frames, save_key_frames
from analyzer import analyze_frames


def main():
    parser = argparse.ArgumentParser(
        description="Analyze running technique from video using pose estimation + LLM"
    )
    parser.add_argument("video", type=Path, help="Path to video file (MOV/MP4)")
    parser.add_argument(
        "-o", "--output", type=Path, default=Path("output"),
        help="Directory to save extracted key frames (default: ./output)",
    )
    parser.add_argument(
        "-n", "--max-frames", type=int, default=12,
        help="Maximum key frames to extract (default: 12)",
    )
    parser.add_argument(
        "--confidence", type=float, default=0.6,
        help="Minimum pose detection confidence (default: 0.6)",
    )
    parser.add_argument(
        "--model", type=str, default=None,
        help="Model ID override (default: gpt-4o)",
    )
    parser.add_argument(
        "--extract-only", action="store_true",
        help="Only extract frames, skip LLM analysis",
    )
    args = parser.parse_args()

    if not args.video.exists():
        print(f"Error: Video file not found: {args.video}", file=sys.stderr)
        sys.exit(1)

    print(f"Extracting key frames from: {args.video}")
    key_frames = extract_key_frames(
        args.video,
        max_frames=args.max_frames,
        min_confidence=args.confidence,
    )

    if not key_frames:
        print("No key frames detected. Ensure the video shows a running person.", file=sys.stderr)
        sys.exit(1)

    print(f"Extracted {len(key_frames)} key frames:")
    for kf in key_frames:
        print(f"  Frame {kf.frame_number} @ {kf.timestamp_ms:.0f}ms — {kf.phase}")

    paths = save_key_frames(key_frames, args.output)
    print(f"Saved frames to: {args.output}/")

    if args.extract_only:
        print("Skipping LLM analysis (--extract-only).")
        return

    display_model = args.model or "gpt-4o"
    print(f"\nAnalyzing technique with OpenAI / {display_model}...")
    analysis = analyze_frames(paths, model=args.model)

    print("\n" + "=" * 60)
    print("RUNNING TECHNIQUE ANALYSIS")
    print("=" * 60)
    print(f"Overall Score: {analysis.get('overall_score', '?')}/100\n")
    for section in analysis.get("sections", []):
        icon = {"good": "+", "warning": "~", "bad": "!"}
        rating = section["rating"]
        print(f"  [{icon.get(rating, '?')}] {section['title']} ({rating.upper()})")
        print(f"      {section['summary']}")
        print(f"      {section['details']}\n")
    print("Recommendations:")
    for rec in analysis.get("recommendations", []):
        print(f"  {rec['priority']}. {rec['text']}")

    report_path = args.output / "analysis.json"
    report_path.write_text(json.dumps(analysis, indent=2), encoding="utf-8")
    print(f"\nReport saved to: {report_path}")


if __name__ == "__main__":
    main()
