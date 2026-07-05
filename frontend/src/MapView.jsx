import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// Free OpenStreetMap raster tiles — no API key.
const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
}

/**
 * @param center  {lat, lng}
 * @param points  [{ id, lat, lng, color, label, sublabel }]
 * @param onSelect optional (point) => void  — marker tap
 */
export default function MapView({ center, points = [], onSelect, height = 200 }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [center.lng, center.lat],
      zoom: 13,
      attributionControl: { compact: true }
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keep the "you" position current
  useEffect(() => {
    mapRef.current?.setCenter([center.lng, center.lat])
  }, [center.lat, center.lng])

  // (re)draw markers whenever the points change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const you = document.createElement('div')
    you.className = 'kx-you'
    markersRef.current.push(
      new maplibregl.Marker({ element: you }).setLngLat([center.lng, center.lat]).addTo(map)
    )

    points.forEach((p) => {
      const el = document.createElement('div')
      el.className = 'kx-pin'
      el.style.background = p.color || '#6366f1'
      if (onSelect) el.addEventListener('click', () => onSelect(p))
      const marker = new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat])
      if (p.label) {
        marker.setPopup(
          new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(
            `<b>${p.label}</b>${p.sublabel ? `<br/>${p.sublabel}` : ''}`
          )
        )
      }
      marker.addTo(map)
      markersRef.current.push(marker)
    })

    if (points.length) {
      const b = new maplibregl.LngLatBounds(
        [center.lng, center.lat],
        [center.lng, center.lat]
      )
      points.forEach((p) => b.extend([p.lng, p.lat]))
      map.fitBounds(b, { padding: 48, maxZoom: 15, duration: 400 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, center.lat, center.lng])

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full overflow-hidden rounded-2xl ring-1 ring-white/10"
    />
  )
}
