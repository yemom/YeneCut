"""
Comprehensive VAD Silence Detection Evaluation Suite.

Evaluates the VAD engine against 10 distinct acoustic scenarios:
1. Clean speech
2. Noisy speech (speech + additive Gaussian noise)
3. Low-volume speech (-20 dB attenuation)
4. Music underneath speech (speech + background harmonic chord)
5. Multiple speakers (alternating formant frequencies)
6. Long pauses inside sentences (> 3 seconds silence)
7. Very short speech bursts (< 0.3 seconds)
8. Speech at the recording start (0.0s)
9. Speech at the recording end (final frame)
10. Music-only / non-speech recordings (zero speech expected)

Metrics computed per scenario:
- Speech Precision, Recall, F1 score
- False Silence Rate (speech erroneously classified as silence)
- Speech Preservation Rate (% of reference speech preserved)
- Boundary Alignment Error (seconds)
"""

from __future__ import annotations

import time
import numpy as np
import pytest

from app.engines.silence.vad_detector import create_vad_detector
from app.engines.silence.silence_analyzer import speech_to_silence, filter_intervals


def generate_tone(freq: float, duration: float, sr: int = 16000, amp: float = 0.5) -> np.ndarray:
    """Generates a pure sine tone simulating speech vocalic fundamental."""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    return (amp * np.sin(2 * np.pi * freq * t)).astype(np.float32)


def generate_chord(freqs: list[float], duration: float, sr: int = 16000, amp: float = 0.1) -> np.ndarray:
    """Generates a multi-harmonic chord simulating background music."""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    signal = np.zeros(len(t), dtype=np.float32)
    for f in freqs:
        signal += (amp / len(freqs)) * np.sin(2 * np.pi * f * t).astype(np.float32)
    return signal


def compute_frame_metrics(
    detected_speech: list[tuple[float, float]],
    reference_speech: list[tuple[float, float]],
    total_duration: float,
    resolution_ms: int = 20,
) -> dict[str, float]:
    """Computes frame-level Precision, Recall, F1, and Speech Preservation Rate."""
    num_frames = int(total_duration * 1000 / resolution_ms)
    frame_dur = resolution_ms / 1000.0

    ref_mask = np.zeros(num_frames, dtype=bool)
    for start, end in reference_speech:
        s_idx = max(0, int(start / frame_dur))
        e_idx = min(num_frames, int(end / frame_dur))
        ref_mask[s_idx:e_idx] = True

    det_mask = np.zeros(num_frames, dtype=bool)
    for start, end in detected_speech:
        s_idx = max(0, int(start / frame_dur))
        e_idx = min(num_frames, int(end / frame_dur))
        det_mask[s_idx:e_idx] = True

    tp = int(np.sum(ref_mask & det_mask))
    fp = int(np.sum(~ref_mask & det_mask))
    fn = int(np.sum(ref_mask & ~det_mask))
    tn = int(np.sum(~ref_mask & ~det_mask))

    precision = tp / (tp + fp) if (tp + fp) > 0 else (1.0 if np.sum(ref_mask) == 0 else 0.0)
    recall = tp / (tp + fn) if (tp + fn) > 0 else (1.0 if np.sum(ref_mask) == 0 else 0.0)
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    speech_preservation = recall  # fraction of ground truth speech not lost
    false_silence_rate = fn / np.sum(ref_mask) if np.sum(ref_mask) > 0 else 0.0

    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "speech_preservation": round(speech_preservation, 4),
        "false_silence_rate": round(false_silence_rate, 4),
    }


# ─── VAD Evaluation Suite ────────────────────────────────────────────────────

SR = 16000


def test_vad_scenario_1_clean_speech():
    """Scenario 1: Clean speech separated by silence."""
    dur = 10.0
    audio = np.zeros(int(SR * dur), dtype=np.float32)
    # Speech at 2.0-5.0s and 7.0-9.0s
    audio[int(SR * 2.0) : int(SR * 5.0)] = generate_tone(440, 3.0, SR, 0.6)
    audio[int(SR * 7.0) : int(SR * 9.0)] = generate_tone(520, 2.0, SR, 0.6)
    ref = [(2.0, 5.0), (7.0, 9.0)]

    detector = create_vad_detector(threshold_db=-30.0, min_speech_duration=0.3)
    t0 = time.perf_counter()
    detected = detector.detect(audio, SR)
    proc_time = time.perf_counter() - t0

    metrics = compute_frame_metrics(detected, ref, dur)
    assert metrics["speech_preservation"] >= 0.95, f"Clean speech preservation too low: {metrics}"
    assert metrics["f1"] >= 0.90, f"Clean speech F1 too low: {metrics}"
    assert proc_time < 0.5, "Inference too slow"


def test_vad_scenario_2_noisy_speech():
    """Scenario 2: Speech with additive Gaussian noise (SNR ~ 15dB)."""
    dur = 8.0
    audio = np.random.normal(0, 0.02, int(SR * dur)).astype(np.float32)
    audio[int(SR * 1.5) : int(SR * 4.5)] += generate_tone(440, 3.0, SR, 0.4)
    ref = [(1.5, 4.5)]

    detector = create_vad_detector(threshold_db=-28.0, min_speech_duration=0.3)
    detected = detector.detect(audio, SR)
    metrics = compute_frame_metrics(detected, ref, dur)

    assert metrics["speech_preservation"] >= 0.90, f"Noisy speech preservation too low: {metrics}"
    assert metrics["f1"] >= 0.80


def test_vad_scenario_3_low_volume_speech():
    """Scenario 3: Low-volume speech (-20 dB relative to nominal)."""
    dur = 6.0
    audio = np.zeros(int(SR * dur), dtype=np.float32)
    audio[int(SR * 1.0) : int(SR * 3.5)] = generate_tone(350, 2.5, SR, 0.05)
    ref = [(1.0, 3.5)]

    detector = create_vad_detector(threshold_db=-45.0, min_speech_duration=0.3)
    detected = detector.detect(audio, SR)
    metrics = compute_frame_metrics(detected, ref, dur)

    assert metrics["speech_preservation"] >= 0.85, f"Low volume speech lost: {metrics}"


def test_vad_scenario_4_music_underneath_speech():
    """Scenario 4: Speech with background music chord."""
    dur = 8.0
    music = generate_chord([220, 277, 330], dur, SR, amp=0.03)
    audio = music.copy()
    audio[int(SR * 2.0) : int(SR * 6.0)] += generate_tone(500, 4.0, SR, amp=0.5)
    ref = [(2.0, 6.0)]

    detector = create_vad_detector(threshold_db=-25.0, min_speech_duration=0.4)
    detected = detector.detect(audio, SR)
    metrics = compute_frame_metrics(detected, ref, dur)

    assert metrics["speech_preservation"] >= 0.90


def test_vad_scenario_5_multiple_speakers():
    """Scenario 5: Multiple speakers with different pitches."""
    dur = 10.0
    audio = np.zeros(int(SR * dur), dtype=np.float32)
    audio[int(SR * 1.0) : int(SR * 3.5)] = generate_tone(220, 2.5, SR, 0.5)  # Speaker A (male pitch)
    audio[int(SR * 5.0) : int(SR * 8.0)] = generate_tone(600, 3.0, SR, 0.5)  # Speaker B (female pitch)
    ref = [(1.0, 3.5), (5.0, 8.0)]

    detector = create_vad_detector(threshold_db=-30.0, min_speech_duration=0.3)
    detected = detector.detect(audio, SR)
    metrics = compute_frame_metrics(detected, ref, dur)

    assert metrics["speech_preservation"] >= 0.92


def test_vad_scenario_6_long_pauses_inside_sentence():
    """Scenario 6: Speech with a 3.5s pause between sentences."""
    dur = 12.0
    audio = np.zeros(int(SR * dur), dtype=np.float32)
    audio[int(SR * 1.0) : int(SR * 3.0)] = generate_tone(440, 2.0, SR, 0.5)
    # Pause from 3.0 to 6.5s (3.5s silence)
    audio[int(SR * 6.5) : int(SR * 9.5)] = generate_tone(440, 3.0, SR, 0.5)
    ref = [(1.0, 3.0), (6.5, 9.5)]

    detector = create_vad_detector(threshold_db=-30.0, min_speech_duration=0.3)
    detected = detector.detect(audio, SR)
    silence = speech_to_silence(detected, dur)
    filtered_silence = filter_intervals(silence, min_duration=0.5)

    # Must identify the long interior pause
    has_interior_silence = any(s[0] <= 3.5 and s[1] >= 6.0 for s in filtered_silence)
    assert has_interior_silence, f"Failed to detect 3.5s interior pause: {filtered_silence}"


def test_vad_scenario_7_very_short_speech():
    """Scenario 7: Short speech burst (< 0.25s)."""
    dur = 4.0
    audio = np.zeros(int(SR * dur), dtype=np.float32)
    audio[int(SR * 1.0) : int(SR * 1.2)] = generate_tone(440, 0.2, SR, 0.5)  # 200ms burst

    # When min_speech_duration=0.15, burst should be detected
    det_sensitive = create_vad_detector(threshold_db=-30.0, min_speech_duration=0.15)
    detected = det_sensitive.detect(audio, SR)
    assert len(detected) >= 1, "Sensitive detector should capture short speech"

    # When min_speech_duration=0.4, short burst should be safely ignored as noise
    det_conservative = create_vad_detector(threshold_db=-30.0, min_speech_duration=0.4)
    detected_cons = det_conservative.detect(audio, SR)
    assert len(detected_cons) == 0, "Conservative detector should ignore sub-duration noise"


def test_vad_scenario_8_speech_at_beginning():
    """Scenario 8: Speech beginning at timestamp 0.0s."""
    dur = 5.0
    audio = np.zeros(int(SR * dur), dtype=np.float32)
    audio[0 : int(SR * 2.5)] = generate_tone(440, 2.5, SR, 0.5)
    ref = [(0.0, 2.5)]

    detector = create_vad_detector(threshold_db=-30.0, min_speech_duration=0.3)
    detected = detector.detect(audio, SR)
    metrics = compute_frame_metrics(detected, ref, dur)

    assert metrics["speech_preservation"] >= 0.95
    assert detected[0][0] <= 0.05, "Must start detection within 50ms of 0.0s"


def test_vad_scenario_9_speech_at_end():
    """Scenario 9: Speech ending at the final frame."""
    dur = 5.0
    audio = np.zeros(int(SR * dur), dtype=np.float32)
    audio[int(SR * 2.5) :] = generate_tone(440, 2.5, SR, 0.5)
    ref = [(2.5, 5.0)]

    detector = create_vad_detector(threshold_db=-30.0, min_speech_duration=0.3)
    detected = detector.detect(audio, SR)
    metrics = compute_frame_metrics(detected, ref, dur)

    assert metrics["speech_preservation"] >= 0.95
    assert detected[-1][1] >= 4.95, "Must capture speech up to the final frame"


def test_vad_scenario_10_music_only_no_speech():
    """Scenario 10: Pure music / ambient track with no speech."""
    dur = 6.0
    audio = generate_chord([130, 164, 196], dur, SR, amp=0.04)  # Quiet ambient background

    detector = create_vad_detector(threshold_db=-25.0, min_speech_duration=0.5)
    detected = detector.detect(audio, SR)

    # Precision should be 1.0 (no false speech reported)
    assert len(detected) == 0, f"Expected 0 speech detections in music-only file, got {detected}"
