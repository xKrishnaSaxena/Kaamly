from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from ..config import settings
from ..voice import extract_intent, transcribe

router = APIRouter()

MAX_AUDIO_BYTES = 8_000_000  # ~8 MB — plenty for a short command


@router.get("/config")
async def voice_config():
    """Tells the client whether server-side STT/LLM are available."""
    return {"stt": settings.has_stt, "llm": settings.has_llm}


@router.post("/transcribe")
async def do_transcribe(file: UploadFile = File(...)):
    if not settings.has_stt:
        raise HTTPException(
            status_code=503,
            detail="Server speech-to-text not configured (set GROQ_API_KEY).",
        )
    audio = await file.read()
    if not audio:
        raise HTTPException(status_code=400, detail="empty audio")
    if len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="audio too large")
    try:
        text = await transcribe(audio, file.filename or "audio.webm", file.content_type)
    except Exception as exc:  # network / provider error
        raise HTTPException(status_code=502, detail=f"transcription failed: {exc}")
    return {"transcript": text}


class ParseIn(BaseModel):
    transcript: str = Field(min_length=1, max_length=1000)
    role_hint: Optional[str] = None


@router.post("/parse")
async def do_parse(body: ParseIn):
    """Turn a transcript into structured intent (LLM if configured, else rules)."""
    intent = await extract_intent(body.transcript, body.role_hint)
    return {"transcript": body.transcript, "intent": intent}
