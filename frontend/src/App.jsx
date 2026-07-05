import { useEffect, useState } from 'react'
import { api } from './api'
import ConsumerScreen from './screens/ConsumerScreen'
import WorkerScreen from './screens/WorkerScreen'

export default function App() {
  const [role, setRole] = useState('worker') // 'worker' | 'consumer'
  const [online, setOnline] = useState(navigator.onLine)
  const [apiStatus, setApiStatus] = useState('checking')
  const [installEvt, setInstallEvt] = useState(null)

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

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setInstallEvt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    let cancelled = false
    const ping = () =>
      api
        .health()
        .then(() => !cancelled && setApiStatus('up'))
        .catch(() => !cancelled && setApiStatus('down'))
    ping()
    const id = setInterval(ping, 15000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const install = async () => {
    if (!installEvt) return
    installEvt.prompt()
    await installEvt.userChoice
    setInstallEvt(null)
  }

  const isWorker = role === 'worker'

  return (
    <div className="min-h-full bg-[#0B1020] text-white">
      <div className="pointer-events-none fixed -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-600/25 blur-3xl" />

      <div className="relative mx-auto flex min-h-full max-w-md flex-col px-5 pb-8 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-xl shadow-lg" />
            <span className="text-xl font-bold tracking-tight">Kaamly</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-white/60">
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {online ? 'Online' : 'Offline'}
          </span>
        </header>

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10">
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

        <main className="mt-6 flex-1">
          {isWorker ? <WorkerScreen /> : <ConsumerScreen />}
        </main>

        {installEvt && (
          <button
            onClick={install}
            className="mt-6 w-full rounded-2xl bg-white/10 py-3 text-sm font-semibold text-white ring-1 ring-white/10 active:scale-[0.99]"
          >
            Add Kaamly to home screen
          </button>
        )}

        <footer className="mt-6 flex items-center justify-between text-[11px] text-white/40">
          <span className="rounded-full bg-white/5 px-2.5 py-1 ring-1 ring-white/10">
            Phase 1 · core loop
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                apiStatus === 'up'
                  ? 'bg-emerald-400'
                  : apiStatus === 'down'
                    ? 'bg-rose-400'
                    : 'bg-white/40'
              }`}
            />
            API {apiStatus === 'up' ? 'connected' : apiStatus === 'down' ? 'offline' : '…'}
          </span>
        </footer>
      </div>
    </div>
  )
}
