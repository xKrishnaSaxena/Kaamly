import { useState } from 'react'
import { useVoice } from './hooks'

function Mic({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
      <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Push-to-talk bar. On a parsed result it calls onIntent(intent) so the parent
 * screen can prefill its form. `example` is the placeholder prompt shown to the user.
 */
export default function VoiceBar({ roleHint, onIntent, example }) {
  const [transcript, setTranscript] = useState('')
  const { supported, serverStt, listening, processing, error, start, stop } = useVoice(
    roleHint,
    ({ transcript, intent }) => {
      setTranscript(transcript)
      onIntent(intent)
    }
  )

  if (!supported) return null

  const busy = listening || processing
  const status = listening
    ? 'Listening… tap to stop'
    : processing
      ? 'Understanding…'
      : 'Tap and speak'

  return (
    <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={listening ? stop : start}
          aria-label={listening ? 'Stop' : 'Speak'}
          className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full transition active:scale-95 ${
            listening
              ? 'bg-rose-500 shadow-[0_0_24px_-4px] shadow-rose-500/60'
              : 'bg-gradient-to-b from-brand-400 to-brand-600'
          }`}
        >
          {listening && (
            <span className="absolute h-12 w-12 rounded-full bg-rose-500/40 animate-pulse-ring" />
          )}
          {processing ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Mic className="h-6 w-6 text-white" />
          )}
        </button>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{status}</div>
          <div className="truncate text-[11px] text-white/45">
            {transcript ? `“${transcript}”` : example}
          </div>
        </div>
      </div>
      {error && <p className="mt-2 text-[11px] text-amber-300">{error}</p>}
      {!serverStt && (
        <p className="mt-2 text-[10px] text-white/30">
          Using on-device voice. Add a Groq key for vernacular accuracy.
        </p>
      )}
    </div>
  )
}
