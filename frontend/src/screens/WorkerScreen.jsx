import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { SKILLS, emojiFor, fmtDistance, labelFor } from '../constants'
import { useGeo, useLocalStorage } from '../hooks'
import { Btn, Card, ChipGroup, Field, LocationField, TextInput } from '../ui'

const HOURS = [1, 2, 4, 8]

export default function WorkerScreen() {
  const { coords, locate, locating, error } = useGeo()
  const [identity, setIdentity] = useLocalStorage('kaamly.identity', { name: '', phone: '' })
  const [skills, setSkills] = useState([])
  const [hours, setHours] = useState(4)
  const [profile, setProfile] = useState(null) // set once online
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const [jobs, setJobs] = useState([])
  const [accepted, setAccepted] = useState({}) // jobId -> true

  const set = (k) => (e) => setIdentity({ ...identity, [k]: e.target.value })

  const goOnline = async () => {
    setMsg('')
    if (!identity.phone || skills.length === 0) {
      setMsg('Add your phone and at least one skill.')
      return
    }
    setBusy(true)
    try {
      const p = await api.goOnline({
        phone: identity.phone,
        name: identity.name || null,
        skills,
        lat: coords.lat,
        lng: coords.lng,
        available_hours: hours
      })
      setProfile(p)
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  const goOffline = async () => {
    setBusy(true)
    try {
      await api.setAvailability(profile.user_id, { is_available: false })
      setProfile(null)
      setJobs([])
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  const refreshJobs = useCallback(async () => {
    if (!profile) return
    try {
      const list = await api.jobsNearby(coords.lat, coords.lng, 5000)
      // only show jobs matching one of my skills
      setJobs(list.filter((j) => skills.includes(j.category)))
    } catch {
      /* keep old list on transient error */
    }
  }, [profile, coords.lat, coords.lng, skills])

  useEffect(() => {
    if (!profile) return
    refreshJobs()
    const id = setInterval(refreshJobs, 12000)
    return () => clearInterval(id)
  }, [profile, refreshJobs])

  const accept = async (jobId) => {
    try {
      await api.acceptJob(jobId, identity.phone)
      setAccepted((a) => ({ ...a, [jobId]: true }))
    } catch (e) {
      setMsg(e.message)
    }
  }

  // ---- online dashboard ----
  if (profile) {
    const until = profile.available_until
      ? new Date(profile.available_until).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit'
        })
      : null
    return (
      <div className="space-y-4">
        <Card className="border border-emerald-400/20 bg-emerald-400/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                You're online
              </div>
              <div className="mt-1 text-xs text-white/60">
                {profile.skills.map((s) => `${emojiFor(s)} ${labelFor(s)}`).join(' · ')}
                {until && ` · until ${until}`}
              </div>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-white/80">Jobs near you</h2>
          <button onClick={refreshJobs} className="text-xs text-brand-400">
            Refresh
          </button>
        </div>

        {jobs.length === 0 ? (
          <Card className="text-center text-sm text-white/50">
            No matching jobs nearby yet. We'll keep looking…
          </Card>
        ) : (
          jobs.map((j) => (
            <Card key={j.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{emojiFor(j.category)}</span>
                    <span className="font-semibold">{j.title || labelFor(j.category)}</span>
                    {j.urgency === 'urgent' && (
                      <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                        URGENT
                      </span>
                    )}
                  </div>
                  {j.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-white/60">{j.description}</p>
                  )}
                  <div className="mt-1 text-[11px] text-white/40">{fmtDistance(j.distance_m)}</div>
                </div>
                {accepted[j.id] ? (
                  <span className="shrink-0 rounded-lg bg-emerald-400/20 px-3 py-2 text-xs font-semibold text-emerald-300">
                    Accepted ✓
                  </span>
                ) : (
                  <button
                    onClick={() => accept(j.id)}
                    className="shrink-0 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-[#0B1020] active:scale-95"
                  >
                    Accept
                  </button>
                )}
              </div>
            </Card>
          ))
        )}

        {msg && <p className="text-center text-xs text-amber-300">{msg}</p>}
        <Btn variant="ghost" onClick={goOffline} loading={busy}>
          Go offline
        </Btn>
      </div>
    )
  }

  // ---- go-online form ----
  return (
    <div className="space-y-4">
      <Field label="Your name">
        <TextInput value={identity.name} onChange={set('name')} placeholder="e.g. Ravi Kumar" />
      </Field>
      <Field label="Phone number" hint="Used to identify you (no OTP yet in Phase 1)">
        <TextInput
          value={identity.phone}
          onChange={set('phone')}
          inputMode="tel"
          placeholder="+91…"
        />
      </Field>
      <Field label="What work do you do?">
        <ChipGroup options={SKILLS} value={skills} onChange={setSkills} multi />
      </Field>
      <Field label="Available for">
        <div className="flex gap-2">
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHours(h)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium ring-1 transition ${
                hours === h ? 'bg-white text-[#0B1020] ring-white' : 'bg-white/5 text-white/70 ring-white/10'
              }`}
            >
              {h}h
            </button>
          ))}
        </div>
      </Field>
      <Field label="Your location">
        <LocationField coords={coords} onLocate={locate} locating={locating} error={error} />
      </Field>

      {msg && <p className="text-center text-xs text-amber-300">{msg}</p>}
      <Btn onClick={goOnline} loading={busy}>
        Go online
      </Btn>
    </div>
  )
}
