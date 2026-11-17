from __future__ import annotations

import os
import tempfile
from pathlib import Path

import numpy as np
from scipy.io import wavfile


def make_test_wav(path: Path, duration: float = 4.0, sample_rate: int = 16000) -> None:
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    # Speech-like bursts separated by silence.
    signal = np.zeros_like(t)
    for start, end in [(0.2, 1.0), (1.8, 2.6), (3.2, 3.8)]:
        mask = (t >= start) & (t < end)
        signal[mask] = 0.3 * np.sin(2 * np.pi * 220 * t[mask])
    wavfile.write(path, sample_rate, (signal * 32767).astype(np.int16))
