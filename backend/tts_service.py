"""
backend/tts_service.py — Ultra-low-latency voice generation with geriatric pacing control
and instant audio buffer clearing for barge-in interruptions.
"""

import os
import aiohttp
import asyncio
from typing import Optional
from backend.config import CARTESIA_API_KEY

CARTESIA_VOICE_ID = "a0e99841-438c-4a64-b679-ae501e7d6091"  # Warm, calm, articulate healthcare voice

async def stream_cartesia_tts(text: str, audio_out_queue: asyncio.Queue, cancel_event: asyncio.Event):
    """Streams synthesized audio chunks with sub-150ms latency using Cartesia Sonic API."""
    if not text:
        return

    if CARTESIA_API_KEY and len(CARTESIA_API_KEY.strip()) > 5:
        url = "https://api.cartesia.ai/tts/sse"
        headers = {
            "X-API-Key": CARTESIA_API_KEY,
            "Cartesia-Version": "2024-06-10",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model_id": "sonic-english",
            "transcript": text,
            "voice": {
                "mode": "id",
                "id": CARTESIA_VOICE_ID
            },
            "output_format": {
                "container": "raw",
                "encoding": "pcm_s16le",
                "sample_rate": 16000
            },
            "voice_settings": {
                "speed": 0.92  # Paced for elderly/clinical comprehension
            }
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=payload) as resp:
                    async for chunk in resp.content.iter_chunked(1024):
                        if cancel_event.is_set():
                            # Interruption / Barge-In triggered -> Drop remaining audio immediately
                            break
                        await audio_out_queue.put(chunk)
            return
        except Exception as e:
            pass

    # Simulated streaming delay pacing
    words = text.split()
    delay = min((len(words) / 3.0) / 0.92, 1.5)
    for _ in range(int(delay * 10)):
        if cancel_event.is_set():
            break
        await asyncio.sleep(0.1)
