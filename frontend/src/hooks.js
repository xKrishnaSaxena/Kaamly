import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { DEFAULT_LOCATION } from './constants'

// Persist small bits of state (e.g. the user's name/phone) across sessions.
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* ignore quota/private-mode errors */
    }
  }, [key, value])
  return [value, setValue]
}

// Device location with a sensible default so the app is testable without GPS.
export function useGeo() {
  const [coords, setCoords] = useState(DEFAULT_LOCATION)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Location not supported on this device')
      return
    }
    setLocating(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          label: 'Current location'
        })
        setLocating(false)
      },
      (e) => {
        setError(e.code === 1 ? 'Location permission blocked' : 'Could not get location')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [])

  return { coords, setCoords, locate, locating, error }
}

// Speak a short confirmation back to the user (free on-device TTS).
// Phase 6 can swap this for Piper for better vernacular voices.
export function speak(text, lang = 'hi-IN') {
  try {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = 0.95
    window.speechSynthesis.speak(u)
  } catch {
    /* TTS unavailable — silent */
  }
}

const BrowserSR =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition)

// Push-to-talk voice capture. Prefers server STT (Groq Whisper) when available;
// otherwise falls back to the browser's SpeechRecognition. Either way it ends by
// POSTing the transcript to /api/voice/parse and handing you {transcript, intent}.
export function useVoice(roleHint, onResult) {
  const [serverStt, setServerStt] = useState(false)
  const [listening, setListening] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const recRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    api
      .voiceConfig()
      .then((c) => setServerStt(!!c.stt))
      .catch(() => setServerStt(false))
  }, [])

  const supported = !!BrowserSR || serverStt

  const parse = async (transcript) => {
    if (!transcript || !transcript.trim()) {
      setProcessing(false)
      setError("Didn't catch that — try again.")
      return
    }
    try {
      const { intent } = await api.parseTranscript(transcript, roleHint)
      onResult({ transcript, intent })
    } catch (e) {
      setError(e.message)
    } finally {
      setProcessing(false)
    }
  }

  const startServer = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream
    const mr = new MediaRecorder(stream)
    const chunks = []
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      setListening(false)
      setProcessing(true)
      try {
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' })
        const { transcript } = await api.transcribe(blob)
        await parse(transcript)
      } catch (e) {
        setError(e.message)
        setProcessing(false)
      }
    }
    recRef.current = mr
    mr.start()
    setListening(true)
  }

  const startBrowser = () => {
    const rec = new BrowserSR()
    rec.lang = 'hi-IN'
    rec.interimResults = false
    rec.continuous = false
    let final = ''
    rec.onresult = (e) => {
      final = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ')
    }
    rec.onerror = (e) => {
      setError(e.error === 'not-allowed' ? 'Microphone blocked' : `Voice error: ${e.error}`)
      setListening(false)
    }
    rec.onend = () => {
      setListening(false)
      setProcessing(true)
      parse(final)
    }
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  const start = async () => {
    setError('')
    try {
      if (serverStt && navigator.mediaDevices?.getUserMedia) {
        await startServer()
      } else if (BrowserSR) {
        startBrowser()
      } else {
        setError('Voice needs Chrome/Android, or a server STT key.')
      }
    } catch (e) {
      setError(e.message || 'Could not start microphone')
      setListening(false)
    }
  }

  const stop = () => {
    try {
      recRef.current?.stop()
    } catch {
      /* ignore */
    }
  }

  return { supported, serverStt, listening, processing, error, start, stop }
}
