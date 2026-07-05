import { lazy, Suspense } from 'react'

// MapLibre is ~900 KB — load it only when a map is actually rendered, so the
// initial app stays light for budget phones on slow networks.
const MapView = lazy(() => import('./MapView'))

export default function LazyMap(props) {
  return (
    <Suspense
      fallback={
        <div
          style={{ height: props.height || 200 }}
          className="w-full animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10"
        />
      }
    >
      <MapView {...props} />
    </Suspense>
  )
}
