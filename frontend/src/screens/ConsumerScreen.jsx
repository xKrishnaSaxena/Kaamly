import { useEffect, useState } from 'react'
import { api } from '../api'
import { SKILLS, emojiFor, fmtDistance, labelFor } from '../constants'
import {
  ensureNotifyPermission,
  notify,
  speak,
  useEventStream,
  useGeo,
  useLocalStorage
} from '../hooks'
import { Btn, Card, ChipGroup, Field, LocationField, Stars, TextArea, TextInput } from '../ui'
import LazyMap from '../LazyMap'
import VoiceBar from '../VoiceBar'

export default function ConsumerScreen() {
  const { coords, locate, locating, error } = useGeo()
  const [identity, setIdentity] = useLocalStorage('kaamly.identity', { name: '', phone: '' })
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [urgency, setUrgency] = useState('urgent')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [result, setResult] = useState(null) // { job, matches }
  const [acceptedBy, setAcceptedBy] = useState(null) // { worker_name, worker_phone }

  // listen for a worker accepting this job
  const evPath = result ? `/api/events/consumer?phone=${encodeURIComponent(identity.phone)}` : null
  useEventStream(
    evPath,
    (evt) => {
      if (evt.job_id !== result?.job?.id) return
      if (evt.type === 'accepted') {
        setAcceptedBy(evt)
        notify('Worker on the way!', `${evt.worker_name || 'A worker'} accepted your job`)
        speak(`${evt.worker_name || 'Worker'} ne aapka kaam accept kar liya hai.`)
      } else if (evt.type === 'worker_available') {
        // a matching worker just came online — add them to the live list
        const { type, job_id, ...worker } = evt
        setResult((prev) => {
          if (!prev || prev.matches.some((m) => m.user_id === worker.user_id)) return prev
          return { ...prev, matches: [worker, ...prev.matches] }
        })
        notify('Worker available!', `${worker.name || 'A worker'} is now nearby`)
      }
    },
    !!result
  )

  const set = (k) => (e) => setIdentity({ ...identity, [k]: e.target.value })

  const applyIntent = (intent) => {
    if (intent.skill) setCategory(intent.skill)
    if (intent.urgency) setUrgency(intent.urgency)
    if (intent.description && intent.skill) setDescription(intent.description)
    if (intent.skill) speak(`${labelFor(intent.skill)} chahiye. Aas paas ke workers dhoond rahe hain.`)
  }

  const post = async () => {
    setMsg('')
    if (!identity.phone || !category) {
      setMsg('Add your phone and pick what you need.')
      return
    }
    setBusy(true)
    try {
      const res = await api.postJob({
        phone: identity.phone,
        name: identity.name || null,
        category,
        title: labelFor(category),
        description: description || null,
        lat: coords.lat,
        lng: coords.lng,
        urgency
      })
      setResult(res)
      setAcceptedBy(null)
      ensureNotifyPermission()
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setResult(null)
    setAcceptedBy(null)
    setDescription('')
    setCategory('')
  }

  const call = () =>
    alert('Secure masked calling arrives in Phase 4 — for now this is a placeholder.')

  // ---- results ----
  if (result) {
    const { job, matches } = result
    return (
      <div className="space-y-4">
        <Card className="border border-brand-400/20 bg-brand-500/10">
          <div className="flex items-center gap-2 font-semibold">
            <span className="text-lg">{emojiFor(job.category)}</span>
            {job.title || labelFor(job.category)}
            {job.urgency === 'urgent' && (
              <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                URGENT
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-white/60">
            Posted · {matches.length} worker{matches.length === 1 ? '' : 's'} available nearby
          </div>
        </Card>

        {acceptedBy && (
          <div className="flex animate-rise items-center justify-between gap-2 rounded-2xl bg-emerald-400/15 px-4 py-3 ring-1 ring-emerald-400/30">
            <span className="text-sm font-medium text-emerald-200">
              ✅ {acceptedBy.worker_name || 'A worker'} accepted — on the way!
            </span>
            <button
              onClick={call}
              className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1020] active:scale-95"
            >
              📞 Call
            </button>
          </div>
        )}

        {matches.length > 0 && (
          <LazyMap
            center={coords}
            height={180}
            points={matches.map((m) => ({
              id: m.user_id,
              lat: m.lat,
              lng: m.lng,
              color: acceptedBy && acceptedBy.worker_phone === m.phone ? '#22c55e' : '#6366f1',
              label: m.name || 'Worker',
              sublabel: fmtDistance(m.distance_m)
            }))}
          />
        )}

        {matches.length === 0 ? (
          <Card className="text-center text-sm text-white/50">
            No {labelFor(job.category)}s available within 3 km right now. Try again shortly —
            workers come online through the day.
          </Card>
        ) : (
          matches.map((m, i) => (
            <Card key={m.user_id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-sm font-bold">
                      {i + 1}
                    </span>
                    <div>
                      <div className="font-semibold">{m.name || 'Worker'}</div>
                      <Stars avg={m.rating_avg} count={m.rating_count} />
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-white/50">
                    {m.skills.map((s) => labelFor(s)).join(' · ')} · {fmtDistance(m.distance_m)}
                  </div>
                </div>
                <button
                  onClick={call}
                  className="shrink-0 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-[#0B1020] active:scale-95"
                >
                  📞 Call
                </button>
              </div>
            </Card>
          ))
        )}

        <Btn variant="ghost" onClick={reset}>
          Post another request
        </Btn>
      </div>
    )
  }

  // ---- post-a-job form ----
  return (
    <div className="space-y-4">
      <VoiceBar
        roleHint="consumer"
        onIntent={applyIntent}
        example={'Try: "Electrician chahiye, short circuit"'}
      />
      <Field label="Your name">
        <TextInput value={identity.name} onChange={set('name')} placeholder="e.g. Priya" />
      </Field>
      <Field label="Phone number" hint="Used to identify you (no OTP yet in Phase 1)">
        <TextInput
          value={identity.phone}
          onChange={set('phone')}
          inputMode="tel"
          placeholder="+91…"
        />
      </Field>
      <Field label="What do you need?">
        <ChipGroup options={SKILLS} value={category} onChange={setCategory} />
      </Field>
      <Field label="Describe the job (optional)">
        <TextArea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Short circuit in the kitchen, power is gone"
        />
      </Field>
      <Field label="How soon?">
        <div className="flex gap-2">
          {[
            ['urgent', 'Right now'],
            ['scheduled', 'Scheduled']
          ].map(([key, lbl]) => (
            <button
              key={key}
              type="button"
              onClick={() => setUrgency(key)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium ring-1 transition ${
                urgency === key ? 'bg-white text-[#0B1020] ring-white' : 'bg-white/5 text-white/70 ring-white/10'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Where?">
        <LocationField coords={coords} onLocate={locate} locating={locating} error={error} />
      </Field>

      {msg && <p className="text-center text-xs text-amber-300">{msg}</p>}
      <Btn onClick={post} loading={busy}>
        Find workers near me
      </Btn>
    </div>
  )
}
