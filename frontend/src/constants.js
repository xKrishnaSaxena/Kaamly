// Skill/category catalogue shared by both worker and consumer flows.
export const SKILLS = [
  { key: 'plumber', label: 'Plumber', emoji: '🔧' },
  { key: 'electrician', label: 'Electrician', emoji: '💡' },
  { key: 'ac_repair', label: 'AC Repair', emoji: '❄️' },
  { key: 'carpenter', label: 'Carpenter', emoji: '🪚' },
  { key: 'painter', label: 'Painter', emoji: '🎨' },
  { key: 'cleaner', label: 'Cleaner', emoji: '🧹' },
  { key: 'cook', label: 'Cook', emoji: '🍳' },
  { key: 'driver', label: 'Driver', emoji: '🚗' },
  { key: 'mason', label: 'Mason', emoji: '🧱' },
  { key: 'mechanic', label: 'Mechanic', emoji: '🔩' },
  { key: 'gardener', label: 'Gardener', emoji: '🌿' },
  { key: 'mover', label: 'Packers & Movers', emoji: '📦' }
]

export const SKILL_BY_KEY = Object.fromEntries(SKILLS.map((s) => [s.key, s]))

export const labelFor = (key) => SKILL_BY_KEY[key]?.label || key
export const emojiFor = (key) => SKILL_BY_KEY[key]?.emoji || '🛠️'

// Default location for testing on desktop (no GPS): Koramangala, Bengaluru.
export const DEFAULT_LOCATION = {
  lat: 12.9352,
  lng: 77.6245,
  label: 'Koramangala, Bengaluru'
}

export const fmtDistance = (m) =>
  m < 1000 ? `${Math.round(m)} m away` : `${(m / 1000).toFixed(1)} km away`
