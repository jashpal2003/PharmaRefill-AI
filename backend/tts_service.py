"""
backend/tts_service.py — Ultra-low-latency voice generation with geriatric pacing control,
Cartesia Sonic-2 direct WAV synthesis for the browser simulator, and instant audio buffer clearing
for barge-in interruptions.
"""

import os
import json
import base64
import aiohttp
import asyncio
from typing import Optional, Dict, Any, List
from backend.config import CARTESIA_API_KEY, CARTESIA_VOICE_ID

# Curated healthcare-friendly voices from Cartesia Voice Library
AVAILABLE_VOICES: Dict[str, Dict[str, str]] = {
    "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4": {
        "id": "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4",
        "name": "Skylar - Friendly Guide",
        "gender": "Female",
        "description": "Approachable American female voice ideal for patient care and support."
    },
    "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc": {
        "id": "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        "name": "Jacqueline - Reassuring Agent",
        "gender": "Female",
        "description": "Confident, empathetic voice for healthcare and patient reassurance."
    },
    "47c38ca4-5f35-497b-b1a3-415245fb35e1": {
        "id": "47c38ca4-5f35-497b-b1a3-415245fb35e1",
        "name": "Daniel - Modern Assistant",
        "gender": "Male",
        "description": "Clear, crisp male voice for clinical and pharmacy interactions."
    },
    "694f9389-aac1-45b6-b726-9d9369183238": {
        "id": "694f9389-aac1-45b6-b726-9d9369183238",
        "name": "Sarah - Mindful Woman",
        "gender": "Female",
        "description": "Calm, gentle tone designed to comfort elderly callers."
    }
}

async def synthesize_cartesia_audio(
    text: str,
    voice_id: Optional[str] = None,
    speed: float = 0.92,
    sample_rate: int = 24000
) -> Optional[bytes]:
    """
    Directly synthesizes speech using Cartesia Sonic-2 /tts/bytes endpoint.
    Returns standard WAV audio bytes ready for browser HTML5 Audio playback.
    """
    if not text or not CARTESIA_API_KEY or len(CARTESIA_API_KEY.strip()) < 5:
        return None

    target_voice_id = voice_id or CARTESIA_VOICE_ID or "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4"
    url = "https://api.cartesia.ai/tts/bytes"
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
            "id": target_voice_id
        },
        "output_format": {
            "container": "wav",
            "encoding": "pcm_s16le",
            "sample_rate": sample_rate
        },
        "voice_settings": {
            "speed": speed
        }
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                if resp.status == 200:
                    audio_bytes = await resp.read()
                    return audio_bytes
                else:
                    err = await resp.text()
                    print(f"Cartesia synthesis notice: HTTP {resp.status} - {err[:150]}")
    except Exception as e:
        print(f"Cartesia synthesis exception: {e}")

    return None

async def synthesize_cartesia_base64(
    text: str,
    voice_id: Optional[str] = None,
    speed: float = 0.92
) -> Optional[str]:
    """
    Synthesizes speech and returns a base64 Data URI ('data:audio/wav;base64,...').
    Allows instant zero-latency playback in frontend web clients.
    """
    raw_wav = await synthesize_cartesia_audio(text, voice_id=voice_id, speed=speed)
    if raw_wav:
        b64 = base64.b64encode(raw_wav).decode("utf-8")
        return f"data:audio/wav;base64,{b64}"
    return None

async def stream_cartesia_tts(
    text: str,
    audio_out_queue: asyncio.Queue,
    cancel_event: asyncio.Event,
    voice_id: Optional[str] = None
):
    """Streams synthesized PCM audio chunks with sub-150ms latency using Cartesia Sonic API for telephony."""
    if not text:
        return

    target_voice = voice_id or CARTESIA_VOICE_ID or "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4"

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
                "id": target_voice
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
            print(f"Cartesia streaming notice: {e}")

    # Fallback simulated streaming delay pacing if offline
    words = text.split()
    delay = min((len(words) / 3.0) / 0.92, 1.5)
    for _ in range(int(delay * 10)):
        if cancel_event.is_set():
            break
        await asyncio.sleep(0.1)
