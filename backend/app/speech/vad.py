"""
vad.py — Voice Activity Detection & Barge-In Energy Controller.
Analyzes 20ms audio frames (16kHz PCM, 320 samples / 640 bytes).
Threshold Thvad > 0.65 for >120ms triggers barge-in interruption.
"""
import audioop
import time
from typing import Optional

class VoiceActivityDetector:
    def __init__(self, energy_threshold: int = 800, min_speech_duration_ms: int = 120):
        self.energy_threshold = energy_threshold
        self.min_speech_duration_ms = min_speech_duration_ms
        self.speech_start_time: Optional[float] = None
        self.is_speech_active = False

    def process_frame(self, pcm_bytes: bytes) -> bool:
        """
        Calculates RMS energy of PCM frame.
        Returns True if sustained speech is detected (triggering barge-in).
        """
        if len(pcm_bytes) < 2:
            return False
            
        try:
            rms = audioop.rms(pcm_bytes, 2)
        except Exception:
            rms = 0

        now = time.time()
        if rms > self.energy_threshold:
            if self.speech_start_time is None:
                self.speech_start_time = now
            elif (now - self.speech_start_time) * 1000 >= self.min_speech_duration_ms:
                self.is_speech_active = True
                return True
        else:
            self.speech_start_time = None
            self.is_speech_active = False

        return False

    def reset(self):
        self.speech_start_time = None
        self.is_speech_active = False
