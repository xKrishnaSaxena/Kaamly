"""Voice pipeline: speech-to-text + intent extraction.

Both tiers degrade gracefully:
  * STT   — Groq Whisper if GROQ_API_KEY is set, else the caller uses browser STT.
  * Intent — Groq LLM if a key is set, else a free rule-based keyword parser.
"""
import json
import re
from typing import Optional

import httpx

from .config import settings

GROQ_BASE = "https://api.groq.com/openai/v1"

# Skill keys MUST match frontend/src/constants.js. Keywords cover English,
# romanized Hindi, AND Devanagari — the browser's hi-IN recognizer returns
# Devanagari even for spoken English (e.g. "I am a plumber" -> "आई एम ए प्लंबर").
SKILL_KEYWORDS = {
    "electrician": ["electric", "electrician", "bijli", "current", "wiring", "short circuit", "fan", "switch", "light",
                    "इलेक्ट्रीशियन", "इलेक्ट्रिशियन", "बिजली", "करंट", "वायरिंग", "शॉर्ट सर्किट", "पंखा", "लाइट", "स्विच"],
    "plumber": ["plumber", "plumbing", "nal", "pipe", "tap", "leak", "paani", "water", "drain", "toilet", "bathroom",
                "प्लंबर", "प्लम्बर", "नल", "पाइप", "पानी", "टोंटी", "लीक", "बाथरूम", "टॉयलेट"],
    "ac_repair": ["ac ", " ac", "a.c", "air condition", "cooling", "cooler",
                  "एसी", "ए.सी", "एयर कंडीशन", "कूलिंग", "कूलर"],
    "carpenter": ["carpenter", "wood", "furniture", "badhai", "door", "almirah", "cupboard",
                  "कारपेंटर", "बढ़ई", "बढई", "लकड़ी", "फर्नीचर", "दरवाज़ा", "दरवाजा", "अलमारी"],
    "painter": ["paint", "painter", "rang", "whitewash", "putty",
                "पेंटर", "पेंट", "रंग", "रंगाई", "पुताई", "सफेदी"],
    "cleaner": ["clean", "cleaner", "safai", "jhadu", "mopping", "sweep",
                "सफाई", "क्लीनर", "झाड़ू", "पोछा", "साफ"],
    "cook": ["cook", "khana", "rasoi", "chef", "kitchen help", "bawarchi",
             "कुक", "खाना", "रसोई", "बावर्ची", "शेफ"],
    "driver": ["driver", "drive", "gaadi", "car", "taxi", "chauffeur",
               "ड्राइवर", "ड्राइव", "गाड़ी", "गाडी", "कार", "टैक्सी"],
    "mason": ["mason", "cement", "wall", "deewar", "plaster", "brick", "raj mistri",
              "मिस्त्री", "राजमिस्त्री", "राज मिस्त्री", "सीमेंट", "दीवार", "प्लास्टर", "ईंट"],
    "mechanic": ["mechanic", "bike", "engine", "motor", "puncture", "scooter",
                 "मैकेनिक", "बाइक", "इंजन", "मोटर", "पंचर", "स्कूटर"],
    "gardener": ["garden", "mali", "plant", "ped", "lawn",
                 "माली", "गार्डन", "बगीचा", "पौधे", "पेड़", "लॉन"],
    "mover": ["mover", "shift", "saman", "packers", "luggage", "packing", "relocation",
              "मूवर", "शिफ्ट", "सामान", "पैकर्स", "पैकिंग", "लगेज"],
}

_WORKER_SIGNALS = [
    " i am ", " i'm ", " main ", " mai ", " hoon", " hu ", "available", "free ",
    "khaali", "khali", "ready for work", "kaam chahiye", "kaam karna",
    "work karunga", "kaam karunga", "job chahiye", "for hire",
    "हूं", "हूँ", "मैं", "फ्री", "खाली", "उपलब्ध", "तैयार", "काम करूंगा", "काम करूँगा",
]
_CONSUMER_SIGNALS = [
    "need", "chahiye", "chaahiye", "want", "bulao", "bulwao", "karwana",
    "karana", "repair karna", "theek", "thik karna", "fix", "banwana",
    "help with", "looking for someone",
    "चाहिए", "चाहिये", "ठीक", "बुलाओ", "बुलवाओ", "करवाना", "करा दो", "रिपेयर",
    "मरम्मत", "के लिए", "फिक्स",
]


def _match_skill(text: str) -> Optional[str]:
    for key, kws in SKILL_KEYWORDS.items():
        if any(kw in text for kw in kws):
            return key
    return None


def _match_role(text: str, skill: Optional[str], hint: Optional[str]) -> Optional[str]:
    if any(p in text for p in ("kaam chahiye", "work chahiye", "job chahiye", "काम चाहिए", "काम चाहिये")):
        return "worker"  # "I want work"
    worker = any(s in text for s in _WORKER_SIGNALS)
    consumer = any(s in text for s in _CONSUMER_SIGNALS)
    if consumer and skill:
        return "consumer"  # "electrician chahiye" = need to hire
    if worker:
        return "worker"
    if consumer:
        return "consumer"
    return hint


def _normalize_digits(text: str) -> str:
    # Devanagari digits ०-९ -> ASCII 0-9
    return text.translate(str.maketrans("०१२३४५६७८९", "0123456789"))


def rule_based(text: str, role_hint: Optional[str] = None) -> dict:
    t = " " + _normalize_digits(text.lower().strip()) + " "
    skill = _match_skill(t)
    role = _match_role(t, skill, role_hint)

    duration = None
    m = re.search(r"(\d+)\s*(hour|hr|hrs|ghant|ghante|ghanta|घंट|घंटे|घंटा|हॉर|हावर|hors)", t)
    if m:
        duration = float(m.group(1))

    urgency = None
    if any(w in t for w in ["now", "abhi", "turant", "immediate", "urgent", "right now",
                            "अभी", "तुरंत", "अर्जेंट", "फौरन"]):
        urgency = "urgent"
    elif any(w in t for w in ["kal", "tomorrow", "schedule", "baad", "later",
                              "कल", "बाद", "शेड्यूल"]):
        urgency = "scheduled"

    location = None
    m = re.search(r"(?:\bin|mein|\bat|near)\s+([a-z0-9]+(?:\s+[a-z0-9]+){0,2})", t)
    if m:
        location = m.group(1).strip()

    return {
        "role": role,
        "skill": skill,
        "duration_hours": duration,
        "location_text": location,
        "urgency": urgency,
        "description": text.strip(),
    }


# --- Groq-backed tiers ------------------------------------------------------
async def transcribe(audio: bytes, filename: str, content_type: Optional[str]) -> str:
    if not settings.groq_api_key:
        raise RuntimeError("STT not configured")
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{GROQ_BASE}/audio/transcriptions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            files={"file": (filename, audio, content_type or "audio/webm")},
            data={"model": settings.groq_stt_model, "response_format": "json", "temperature": "0"},
        )
        resp.raise_for_status()
        return (resp.json().get("text") or "").strip()


async def _llm_extract(text: str, role_hint: Optional[str]) -> dict:
    skills = ", ".join(SKILL_KEYWORDS.keys())
    prompt = (
        f"Valid skills: {skills}.\n"
        f'User voice command (Hindi/English/mixed): "{text}"\n\n'
        "Extract intent as JSON with keys: "
        'role ("worker" if the speaker offers their own labour or wants a job, '
        '"consumer" if they need to hire someone, else null), '
        "skill (exactly one of the valid skill keys, or null), "
        "duration_hours (number of hours the worker is available, or null), "
        "location_text (place mentioned, or null), "
        'urgency ("urgent" or "scheduled" or null), '
        "description (one short cleaned sentence)."
    )
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{GROQ_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json={
                "model": settings.groq_llm_model,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": "You extract structured intent for a gig-work app. Respond with JSON only."},
                    {"role": "user", "content": prompt},
                ],
            },
        )
        resp.raise_for_status()
        data = json.loads(resp.json()["choices"][0]["message"]["content"])

    # validate / normalize against our known values
    skill = data.get("skill")
    if skill not in SKILL_KEYWORDS:
        skill = None
    role = data.get("role")
    if role not in ("worker", "consumer"):
        role = role_hint
    urgency = data.get("urgency")
    if urgency not in ("urgent", "scheduled"):
        urgency = None
    duration = data.get("duration_hours")
    try:
        duration = float(duration) if duration is not None else None
    except (TypeError, ValueError):
        duration = None
    return {
        "role": role,
        "skill": skill,
        "duration_hours": duration,
        "location_text": data.get("location_text") or None,
        "urgency": urgency,
        "description": (data.get("description") or text).strip(),
    }


async def extract_intent(text: str, role_hint: Optional[str] = None) -> dict:
    if settings.groq_api_key:
        try:
            return await _llm_extract(text, role_hint)
        except Exception:
            pass  # fall back to the free parser on any LLM error
    return rule_based(text, role_hint)
