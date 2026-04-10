"""Extract key frames from running video using pose estimation."""

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import (
    PoseLandmarker,
    PoseLandmarkerOptions,
    PoseLandmark,
    RunningMode,
)
from pathlib import Path
from dataclasses import dataclass

MODEL_PATH = Path(__file__).parent / "pose_landmarker_heavy.task"

# Landmark indices
LEFT_HIP = PoseLandmark.LEFT_HIP
RIGHT_HIP = PoseLandmark.RIGHT_HIP
LEFT_KNEE = PoseLandmark.LEFT_KNEE
RIGHT_KNEE = PoseLandmark.RIGHT_KNEE
LEFT_ANKLE = PoseLandmark.LEFT_ANKLE
RIGHT_ANKLE = PoseLandmark.RIGHT_ANKLE
LEFT_HEEL = PoseLandmark.LEFT_HEEL
RIGHT_HEEL = PoseLandmark.RIGHT_HEEL

# Pose connections for drawing skeleton
POSE_CONNECTIONS = [
    (PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER),
    (PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_ELBOW),
    (PoseLandmark.LEFT_ELBOW, PoseLandmark.LEFT_WRIST),
    (PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_ELBOW),
    (PoseLandmark.RIGHT_ELBOW, PoseLandmark.RIGHT_WRIST),
    (PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_HIP),
    (PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_HIP),
    (PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP),
    (PoseLandmark.LEFT_HIP, PoseLandmark.LEFT_KNEE),
    (PoseLandmark.LEFT_KNEE, PoseLandmark.LEFT_ANKLE),
    (PoseLandmark.LEFT_ANKLE, PoseLandmark.LEFT_HEEL),
    (PoseLandmark.LEFT_HEEL, PoseLandmark.LEFT_FOOT_INDEX),
    (PoseLandmark.RIGHT_HIP, PoseLandmark.RIGHT_KNEE),
    (PoseLandmark.RIGHT_KNEE, PoseLandmark.RIGHT_ANKLE),
    (PoseLandmark.RIGHT_ANKLE, PoseLandmark.RIGHT_HEEL),
    (PoseLandmark.RIGHT_HEEL, PoseLandmark.RIGHT_FOOT_INDEX),
]


@dataclass(frozen=True)
class KeyFrame:
    frame_number: int
    timestamp_ms: float
    phase: str
    image: np.ndarray
    landmarks: list
    is_key_frame: bool = True


def _detect_gait_phase(landmarks) -> str | None:
    """Classify gait phase based on hip/knee/ankle positions."""
    lh = landmarks[LEFT_HIP]
    rh = landmarks[RIGHT_HIP]
    lk = landmarks[LEFT_KNEE]
    rk = landmarks[RIGHT_KNEE]
    la = landmarks[LEFT_ANKLE]
    ra = landmarks[RIGHT_ANKLE]
    l_heel = landmarks[LEFT_HEEL]
    r_heel = landmarks[RIGHT_HEEL]

    left_foot_y = (la.y + l_heel.y) / 2
    right_foot_y = (ra.y + r_heel.y) / 2

    ankle_spread = abs(la.x - ra.x)
    hip_width = abs(lh.x - rh.x)
    spread_ratio = ankle_spread / max(hip_width, 0.01)

    def knee_angle(hip, knee, ankle):
        v1 = np.array([hip.x - knee.x, hip.y - knee.y])
        v2 = np.array([ankle.x - knee.x, ankle.y - knee.y])
        cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-8)
        return np.degrees(np.arccos(np.clip(cos, -1, 1)))

    left_knee_angle = knee_angle(lh, lk, la)
    right_knee_angle = knee_angle(rh, rk, ra)

    ground_level = max(left_foot_y, right_foot_y)
    if left_foot_y < ground_level - 0.03 and right_foot_y < ground_level - 0.03:
        return "flight"

    if spread_ratio > 2.5:
        if left_knee_angle > 155 or right_knee_angle > 155:
            return "foot_strike"
        return "toe_off"

    if spread_ratio < 1.5 and (left_knee_angle < 150 and right_knee_angle < 150):
        return "mid_stance"

    return None


def _draw_landmarks(image: np.ndarray, landmarks, h: int, w: int) -> np.ndarray:
    """Draw pose skeleton on image."""
    annotated = image.copy()

    for connection in POSE_CONNECTIONS:
        start = landmarks[connection[0]]
        end = landmarks[connection[1]]
        if start.visibility < 0.5 or end.visibility < 0.5:
            continue
        pt1 = (int(start.x * w), int(start.y * h))
        pt2 = (int(end.x * w), int(end.y * h))
        cv2.line(annotated, pt1, pt2, (255, 255, 0), 2)

    for lm in landmarks:
        if lm.visibility < 0.5:
            continue
        pt = (int(lm.x * w), int(lm.y * h))
        cv2.circle(annotated, pt, 4, (0, 255, 0), -1)

    return annotated


MAX_TOTAL_FRAMES = 50  # Cap total frames (key + motion) for browser performance


def extract_key_frames(
    video_path: str | Path,
    max_frames: int = 12,
    max_total: int = MAX_TOTAL_FRAMES,
    min_confidence: float = 0.6,
) -> list[KeyFrame]:
    """Extract frames from video for smooth playback with key-frame tagging.

    Extracts sampled frames (for smooth video-like playback) but tags
    gait-phase transitions as key frames (is_key_frame=True). Only key frames
    are sent to the LLM for analysis.

    Args:
        video_path: Path to MOV/MP4 video file.
        max_frames: Maximum number of KEY frames (phase transitions) to capture.
        max_total: Maximum total frames (key + motion) for browser performance.
        min_confidence: Minimum pose detection confidence.

    Returns:
        List of KeyFrame objects. is_key_frame=True for analysis frames,
        False for in-between motion frames.
    """
    video_path = Path(video_path)
    if not video_path.exists():
        raise FileNotFoundError(f"Video not found: {video_path}")

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))

    options = PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
        running_mode=RunningMode.VIDEO,
        min_pose_detection_confidence=min_confidence,
        min_tracking_confidence=min_confidence,
    )
    landmarker = PoseLandmarker.create_from_options(options)

    all_frames: list[KeyFrame] = []
    prev_phase: str | None = None
    key_count = 0
    frame_idx = 0
    last_key_ms: float = -999999
    total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    video_duration_ms = (total_video_frames / fps) * 1000 if fps > 0 else 0
    # Dynamic sample interval: aim for max_total frames from the full video
    sample_interval = max(1, total_video_frames // max_total) if total_video_frames > 0 else max(1, int(fps / 5))
    # Minimum gap between key frames — spread them across the video
    # e.g. for 12 key frames in 15s video → ~1.25s apart minimum
    min_key_gap_ms = max(500, video_duration_ms / (max_frames + 1))

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_interval != 0:
                frame_idx += 1
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            timestamp_ms = int((frame_idx / fps) * 1000)

            result = landmarker.detect_for_video(mp_image, timestamp_ms)

            if result.pose_landmarks and len(result.pose_landmarks) > 0:
                landmarks = result.pose_landmarks[0]
                phase = _detect_gait_phase(landmarks)
                current_phase = phase or prev_phase or "unknown"

                is_key = (
                    phase is not None
                    and phase != prev_phase
                    and key_count < max_frames
                    and (timestamp_ms - last_key_ms) >= min_key_gap_ms
                )

                annotated = _draw_landmarks(frame, landmarks, h, w)
                cv2.putText(
                    annotated,
                    current_phase.replace("_", " ").title(),
                    (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1.0,
                    (0, 255, 0) if is_key else (200, 200, 200),
                    2,
                )

                landmark_data = [
                    {"x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility}
                    for lm in landmarks
                ]

                all_frames.append(KeyFrame(
                    frame_number=frame_idx,
                    timestamp_ms=timestamp_ms,
                    phase=current_phase,
                    image=annotated,
                    landmarks=landmark_data,
                    is_key_frame=is_key,
                ))

                if is_key:
                    key_count += 1
                    last_key_ms = timestamp_ms
                    prev_phase = phase
            else:
                # No pose detected — still save the frame for smooth playback
                annotated = frame.copy()
                all_frames.append(KeyFrame(
                    frame_number=frame_idx,
                    timestamp_ms=timestamp_ms,
                    phase=prev_phase or "unknown",
                    image=annotated,
                    landmarks=[],
                    is_key_frame=False,
                ))

            frame_idx += 1
    finally:
        cap.release()
        landmarker.close()

    return all_frames


def save_key_frames(key_frames: list[KeyFrame], output_dir: str | Path) -> list[Path]:
    """Save extracted frames as images.

    Key frames get quality 95, motion frames get quality 80 (smaller files).
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    paths = []
    for i, kf in enumerate(key_frames):
        tag = "key" if kf.is_key_frame else "motion"
        filename = f"{i:03d}_{tag}_{kf.phase}_{kf.frame_number}.jpg"
        path = output_dir / filename
        quality = 95 if kf.is_key_frame else 80
        cv2.imwrite(str(path), kf.image, [cv2.IMWRITE_JPEG_QUALITY, quality])
        paths.append(path)

    return paths
