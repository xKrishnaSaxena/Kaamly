import { useEffect, useRef, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Browser-native speech recognition (Chrome/Edge/Android). This is a Phase 0
// stand-in — Phase 2 swaps it for the Whisper/IndicWhisper pipeline on the backend.
const SpeechRecognition =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition)

function MicIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
      <path
        d="M5 11a7 7 0 0 0 14 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function App() {
  const [role, setRole] = useState('worker') // 'worker' | 'consumer'
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [note, setNote] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const [api, setApi] = useState('checking') // 'checking' | 'up' | 'down'
  const [installEvt, setInstallEvt] = useState(null)
  const recognitionRef = useRef(null)

  // network status
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // install prompt capture
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setInstallEvt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // backend health ping
  useEffect(() => {
    let cancelled = false
    const ping = async () => {
      try {
        const res = await fetch(`${API_URL}/health`, { cache: 'no-store' })
        if (!cancelled) setApi(res.ok ? 'up' : 'down')
      } catch {
        if (!cancelled) setApi('down')
      }
    }
    ping()
    const id = setInterval(ping, 15000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    setTranscript('')
    setNote('')
    if (!SpeechRecognition) {
      setNote('Voice needs Chrome or Android for now — the full vernacular engine lands in Phase 2.')
      return
    }
    const rec = new SpeechRecognition()
    rec.lang = 'hi-IN' // Hindi + English mix; language auto-detect comes in Phase 2
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ')
      setTranscript(text)
    }
    rec.onerror = (e) => {
      setNote(
        e.error === 'not-allowed'
          ? 'Microphone permission was blocked. Enable it to try voice.'
          : `Voice error: ${e.error}`
      )
      setListening(false)
    }
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  const install = async () => {
    if (!installEvt) return
    installEvt.prompt()
    await installEvt.userChoice
    setInstallEvt(null)
  }

  const isWorker = role === 'worker'

  return (
    <div className="min-h-full bg-[#0B1020] text-white overflow-hidden relative">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-fuchsia-600/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-full max-w-md flex-col px-6 pb-10 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        {/* header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-xl shadow-lg" />
            <span className="text-xl font-bold tracking-tight">Kaamly</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-white/60">
              <span
                className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-amber-400'}`}
              />
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
        </header>

        {/* role switch */}
        <div className="mt-8 grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10">
          <button
            onClick={() => setRole('worker')}
            className={`rounded-xl py-2.5 text-sm font-semibold transition ${
              isWorker ? 'bg-white text-[#0B1020] shadow' : 'text-white/70'
            }`}
          >
            I want work
          </button>
          <button
            onClick={() => setRole('consumer')}
            className={`rounded-xl py-2.5 text-sm font-semibold transition ${
              !isWorker ? 'bg-white text-[#0B1020] shadow' : 'text-white/70'
            }`}
          >
            I want to hire
          </button>
        </div>

        {/* hero */}
        <div className="mt-10 flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-bold leading-snug animate-rise">
            {isWorker ? 'Tap and tell us your skill' : 'Tap and say what you need'}
          </h1>
          <p className="mt-2 max-w-xs text-sm text-white/60 animate-rise">
            {isWorker
              ? '"Main plumber hoon, agle 4 ghante Koramangala mein free hoon."'
              : '"Ek electrician chahiye, short circuit theek karna hai."'}
          </p>

          {/* push-to-talk */}
          <div className="relative mt-12 flex items-center justify-center">
            {listening && (
              <>
                <span className="absolute h-28 w-28 rounded-full bg-brand-500/40 animate-pulse-ring" />
                <span
                  className="absolute h-28 w-28 rounded-full bg-brand-500/30 animate-pulse-ring"
                  style={{ animationDelay: '0.6s' }}
                />
              </>
            )}
            <button
              onClick={toggleMic}
              aria-pressed={listening}
              aria-label={listening ? 'Stop listening' : 'Start speaking'}
              className={`relative grid h-28 w-28 place-items-center rounded-full transition active:scale-95 ${
                listening
                  ? 'bg-rose-500 shadow-[0_0_50px_-5px] shadow-rose-500/60'
                  : 'bg-gradient-to-b from-brand-400 to-brand-600 shadow-[0_0_50px_-8px] shadow-brand-500/70'
              }`}
            >
              <MicIcon className="h-11 w-11 text-white" />
            </button>
          </div>
          <p className="mt-5 text-sm font-medium text-white/70">
            {listening ? 'Listening… speak now' : 'Push to talk'}
          </p>

          {/* live transcript */}
          {transcript && (
            <div className="mt-5 w-full rounded-2xl bg-white/5 px-4 py-3 text-left text-sm ring-1 ring-white/10 animate-rise">
              <span className="text-white/40">You said:</span>{' '}
              <span className="text-white/90">{transcript}</span>
            </div>
          )}
          {note && <p className="mt-4 max-w-xs text-xs text-amber-300/90">{note}</p>}
        </div>

        {/* install CTA */}
        {installEvt && (
          <button
            onClick={install}
            className="mb-4 w-full rounded-2xl bg-white py-3.5 text-sm font-semibold text-[#0B1020] shadow-lg active:scale-[0.99]"
          >
            Add Kaamly to home screen
          </button>
        )}

        {/* footer status */}
        <footer className="flex items-center justify-between text-[11px] text-white/40">
          <span className="rounded-full bg-white/5 px-2.5 py-1 ring-1 ring-white/10">
            Phase 0 · scaffold
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                api === 'up' ? 'bg-emerald-400' : api === 'down' ? 'bg-rose-400' : 'bg-white/40'
              }`}
            />
            API {api === 'up' ? 'connected' : api === 'down' ? 'offline' : '…'}
          </span>
        </footer>
      </div>
    </div>
  )
}
