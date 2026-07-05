import { useCallback, useEffect, useState } from 'react'
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
