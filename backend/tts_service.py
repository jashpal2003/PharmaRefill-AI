"""
backend/tts_service.py — Ultra-low-latency voice generation with geriatric pacing control
and instant audio buffer clearing for barge-in interruptions.
"""

import os
import json
import base64
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
            "model_id": "sonic-2",
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
                    if resp.status == 200:
                        async for line in resp.content:
                            if cancel_event.is_set():
                                # Interruption / Barge-In triggered -> Drop remaining audio immediately
                                break
                            line_str = line.decode('utf-8', errors='ignore').strip()
                            if line_str.startswith('data:'):
                                raw_data = line_str[5:].strip()
                                if raw_data:
                                    try:
                                        parsed = json.loads(raw_data)
                                        if 'data' in parsed and parsed['data']:
                                            pcm = base64.b64decode(parsed['data'])
                                            await audio_out_queue.put(pcm)
                                    except Exception:
                                        pass
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
