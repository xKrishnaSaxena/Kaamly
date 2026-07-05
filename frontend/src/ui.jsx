// Small styled building blocks shared across screens.

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-white/60">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-white/40">{hint}</span>}
    </label>
  )
}

export function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl bg-white/5 px-3.5 py-3 text-[15px] text-white placeholder-white/30 ring-1 ring-white/10 outline-none focus:ring-brand-400 ${props.className || ''}`}
    />
  )
}

export function TextArea(props) {
  return (
    <textarea
      {...props}
      className="w-full resize-none rounded-xl bg-white/5 px-3.5 py-3 text-[15px] text-white placeholder-white/30 ring-1 ring-white/10 outline-none focus:ring-brand-400"
    />
  )
}

// Multi- or single-select chips. `value` is an array (multi) or string (single).
export function ChipGroup({ options, value, onChange, multi = false }) {
  const selected = (key) => (multi ? value.includes(key) : value === key)
  const toggle = (key) => {
    if (multi) {
      onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key])
    } else {
      onChange(key)
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => toggle(o.key)}
          className={`rounded-full px-3 py-2 text-sm font-medium ring-1 transition active:scale-95 ${
            selected(o.key)
              ? 'bg-white text-[#0B1020] ring-white'
              : 'bg-white/5 text-white/80 ring-white/10'
          }`}
        >
          <span className="mr-1">{o.emoji}</span>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Btn({ children, variant = 'primary', loading, className = '', ...rest }) {
  const base =
    'w-full rounded-2xl py-3.5 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100'
  const styles = {
    primary: 'bg-white text-[#0B1020] shadow-lg',
    ghost: 'bg-white/5 text-white ring-1 ring-white/10',
    danger: 'bg-rose-500/90 text-white'
  }
  return (
    <button {...rest} disabled={loading || rest.disabled} className={`${base} ${styles[variant]} ${className}`}>
      {loading ? 'Please wait…' : children}
    </button>
  )
}

export function LocationField({ coords, onLocate, locating, error }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/5 px-3.5 py-3 ring-1 ring-white/10">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm text-white/90">
          <span>📍</span>
          <span className="truncate">{coords.label || 'Pinned location'}</span>
        </div>
        <div className="text-[11px] text-white/40">
          {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          {error && <span className="ml-1 text-amber-300/80">· {error}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={onLocate}
        className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white active:scale-95"
      >
        {locating ? 'Locating…' : 'Use my location'}
      </button>
    </div>
  )
}

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 ${className}`}>
      {children}
    </div>
  )
}

export function Stars({ avg, count }) {
  if (!count) return <span className="text-[11px] text-white/40">New</span>
  return (
    <span className="text-[11px] text-amber-300">
      ★ {avg.toFixed(1)}{' '}
      <span className="text-white/40">({count})</span>
    </span>
  )
}
