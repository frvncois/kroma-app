<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { RouteStop } from '@/stores/drivers'

// ─── Props ───────────────────────────────────────────────────────────

interface Props {
  stops: RouteStop[]
  currentStopIndex: number
  startAddress: string
  startLat: number
  startLng: number
  returnToHqData?: {
    travelMinutes: number
    distanceKm: number
    estimatedArrival: string
  }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'stop-click', stopIndex: number): void
}>()

// ─── Refs ────────────────────────────────────────────────────────────

const mapContainer = ref<HTMLDivElement>()
let map: mapboxgl.Map | null = null
const markers: mapboxgl.Marker[] = []

// ─── Mapbox Token ────────────────────────────────────────────────────

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

// ─── Colors ──────────────────────────────────────────────────────────

const COLORS = {
  completed: '#22c55e',      // green-500
  current: '#3b82f6',        // blue-500
  upcoming: '#a855f7',       // purple-500
  cancelled: '#ef4444',      // red-500
  homeBase: '#1e293b',       // slate-800
  routeCompleted: '#22c55e', // green-500
  routeCurrent: '#3b82f6',   // blue-500
  routeUpcoming: '#a855f7',  // purple-500
}

// ─── Init Map ────────────────────────────────────────────────────────

onMounted(() => {
  if (!mapContainer.value || !MAPBOX_TOKEN) return

  mapboxgl.accessToken = MAPBOX_TOKEN

  map = new mapboxgl.Map({
    container: mapContainer.value,
    style: 'mapbox://styles/frvncois/cmb9jvcke00zx01rugudvagun',
    center: [props.startLng, props.startLat],
    zoom: 5,
    attributionControl: false,
  })

  // Add minimal attribution
  map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')

  // Add zoom controls
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

  map.on('load', () => {
    renderRoute()
  })
})

onUnmounted(() => {
  clearMarkers()
  if (map) {
    map.remove()
    map = null
  }
})

// ─── Watch for changes ───────────────────────────────────────────────

watch(
  () => [props.stops, props.currentStopIndex],
  () => {
    if (map && map.isStyleLoaded()) {
      renderRoute()
    }
  },
  { deep: true }
)

// ─── Clear markers ──────────────────────────────────────────────────

function clearMarkers() {
  markers.forEach(m => m.remove())
  markers.length = 0
}

// ─── Create custom marker element ───────────────────────────────────

function createMarkerEl(
  type: 'home' | 'completed' | 'current' | 'upcoming' | 'cancelled',
  label?: string
): HTMLDivElement {
  const el = document.createElement('div')
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.cursor = 'pointer'

  if (type === 'home') {
    el.style.width = '36px'
    el.style.height = '36px'
    el.style.borderRadius = '50%'
    el.style.backgroundColor = COLORS.homeBase
    el.style.border = '3px solid white'
    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
    el.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`
  } else if (type === 'completed') {
    el.style.width = '28px'
    el.style.height = '28px'
    el.style.borderRadius = '50%'
    el.style.backgroundColor = COLORS.completed
    el.style.border = '2px solid white'
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)'
    el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
  } else if (type === 'current') {
    // Pulsing current marker
    el.style.width = '40px'
    el.style.height = '40px'
    el.style.position = 'relative'
    el.innerHTML = `
      <div style="
        position: absolute; inset: 0;
        border-radius: 50%;
        background: ${COLORS.current}33;
        animation: pulse-ring 2s ease-out infinite;
      "></div>
      <div style="
        position: relative; z-index: 1;
        width: 32px; height: 32px;
        border-radius: 50%;
        background: ${COLORS.current};
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(59,130,246,0.5);
        display: flex; align-items: center; justify-content: center;
        color: white; font-weight: 700; font-size: 13px;
      ">${label || '📍'}</div>
    `
  } else if (type === 'cancelled') {
    el.style.width = '24px'
    el.style.height = '24px'
    el.style.borderRadius = '50%'
    el.style.backgroundColor = COLORS.cancelled
    el.style.border = '2px solid white'
    el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)'
    el.style.opacity = '0.7'
    el.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  } else {
    // Upcoming
    el.style.width = '26px'
    el.style.height = '26px'
    el.style.borderRadius = '50%'
    el.style.backgroundColor = 'white'
    el.style.border = `2px solid ${COLORS.upcoming}`
    el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.15)'
    el.style.color = COLORS.upcoming
    el.style.fontWeight = '700'
    el.style.fontSize = '11px'
    el.textContent = label || '?'
  }

  return el
}

// ─── Fetch Mapbox Directions route geometry ─────────────────────────

async function fetchRouteGeometry(
  coordinates: [number, number][]
): Promise<GeoJSON.LineString | null> {
  // Mapbox Directions API supports up to 25 waypoints
  // If more, we chunk and merge
  if (coordinates.length < 2) return null

  // Build coordinate string: lng,lat;lng,lat;...
  // Max 25 per request
  const chunks: [number, number][][] = []
  for (let i = 0; i < coordinates.length; i += 24) {
    const chunk = coordinates.slice(i, i + 25)
    // Overlap by 1 to connect segments
    if (i > 0 && chunks.length > 0) {
      const prevChunk = chunks[chunks.length - 1]!
      chunk.unshift(prevChunk[prevChunk.length - 1]!)
    }
    chunks.push(chunk)
  }

  const allCoords: [number, number][] = []

  for (const chunk of chunks) {
    const coordStr = chunk.map(c => `${c[0]},${c[1]}`).join(';')
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`

    try {
      const res = await fetch(url)
      const data = await res.json()
      if (data.routes && data.routes[0]) {
        const routeCoords = data.routes[0].geometry.coordinates as [number, number][]
        // Skip first coord if overlapping (avoid duplicate)
        if (allCoords.length > 0 && routeCoords.length > 0) {
          allCoords.push(...routeCoords.slice(1))
        } else {
          allCoords.push(...routeCoords)
        }
      }
    } catch (err) {
      console.warn('Mapbox Directions API not available — using straight lines. Add api.mapbox.com to allowed domains.', err)
      // Fallback: return straight line
      return {
        type: 'LineString' as const,
        coordinates: coordinates,
      }
    }
  }

  if (allCoords.length === 0) return null

  return {
    type: 'LineString',
    coordinates: allCoords,
  }
}

// ─── Main render ─────────────────────────────────────────────────────

async function renderRoute() {
  if (!map) return

  clearMarkers()

  // ── 1. Collect all coordinates in route order ──

  const allPoints: { lng: number; lat: number; stop?: RouteStop; index?: number }[] = []

  // Start with home base
  allPoints.push({ lng: props.startLng, lat: props.startLat })

  // Then each stop in order
  for (let i = 0; i < props.stops.length; i++) {
    const stop = props.stops[i]!
    if (stop.lat != null && stop.lng != null) {
      allPoints.push({ lng: stop.lng, lat: stop.lat, stop, index: i })
    }
  }

  // ── 2. Add markers ──

  // Home base marker
  const homeEl = createMarkerEl('home')
  const homeMarker = new mapboxgl.Marker({ element: homeEl })
    .setLngLat([props.startLng, props.startLat])
    .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(
      `<div style="font-size:13px;font-weight:600;padding:2px 4px;">🏠 Home Base</div>
       <div style="font-size:11px;color:#666;padding:0 4px 4px;">${props.startAddress}</div>`
    ))
    .addTo(map)
  markers.push(homeMarker)

  // Stop markers
  let visibleSequence = 0
  for (let i = 0; i < props.stops.length; i++) {
    const stop = props.stops[i]!
    if (stop.lat == null || stop.lng == null) continue

    visibleSequence++

    let type: 'completed' | 'current' | 'upcoming' | 'cancelled'
    if (stop.cancelled) type = 'cancelled'
    else if (stop.status === 'completed') type = 'completed'
    else if (i === props.currentStopIndex) type = 'current'
    else type = 'upcoming'

    const label = type === 'current'
      ? visibleSequence.toString()
      : type === 'upcoming'
      ? visibleSequence.toString()
      : undefined

    const el = createMarkerEl(type, label)

    // Click handler
    el.addEventListener('click', () => {
      emit('stop-click', i)
    })

    // Popup content
    const stopLabel = stop.type === 'pickup'
      ? `📦 Pickup: ${stop.printshopName || 'Shop'}`
      : `🚚 Deliver: ${stop.customerName || 'Customer'}`
    const statusLabel = stop.status === 'completed' ? '✅ Completed'
      : stop.cancelled ? '❌ Cancelled'
      : i === props.currentStopIndex ? '📍 Current Stop'
      : `⏳ Stop #${visibleSequence}`
    const etaLine = stop.estimatedArrival ? `<div style="font-size:11px;color:#666;">ETA: ${stop.estimatedArrival}</div>` : ''

    const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(
      `<div style="font-size:13px;font-weight:600;padding:2px 4px;">${stopLabel}</div>
       <div style="font-size:11px;color:#666;padding:0 4px;">${statusLabel}</div>
       ${etaLine}
       <div style="font-size:10px;color:#999;padding:2px 4px 4px;">${stop.address}</div>`
    )

    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([stop.lng, stop.lat])
      .setPopup(popup)
      .addTo(map)
    markers.push(marker)
  }

  // ── 3. Route lines (3 segments: completed, current, upcoming, return) ──

  // Remove old route layers/sources
  const layerIds = ['route-completed', 'route-current', 'route-current-dash', 'route-upcoming', 'route-return']
  const sourceIds = ['route-completed', 'route-current', 'route-upcoming', 'route-return']

  for (const id of layerIds) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  for (const id of sourceIds) {
    if (map.getSource(id)) map.removeSource(id)
  }

  // Split points into segments
  const completedCoords: [number, number][] = [[props.startLng, props.startLat]]
  const currentCoords: [number, number][] = []
  const upcomingCoords: [number, number][] = []

  let foundCurrent = false
  let pastCurrent = false

  for (let i = 0; i < props.stops.length; i++) {
    const stop = props.stops[i]!
    if (stop.lat == null || stop.lng == null) continue
    const coord: [number, number] = [stop.lng, stop.lat]

    if (stop.cancelled) continue

    if (stop.status === 'completed') {
      completedCoords.push(coord)
    } else if (i === props.currentStopIndex && !pastCurrent) {
      foundCurrent = true
      // Current segment: from last completed to current
      const lastCompleted = completedCoords[completedCoords.length - 1]
      if (lastCompleted) currentCoords.push(lastCompleted)
      currentCoords.push(coord)
    } else if (foundCurrent || pastCurrent) {
      pastCurrent = true
      if (upcomingCoords.length === 0) {
        // Start upcoming from current stop
        const currentCoord = currentCoords[currentCoords.length - 1]
        if (currentCoord) upcomingCoords.push(currentCoord)
      }
      upcomingCoords.push(coord)
    }
  }

  // Fetch actual road geometries for each segment
  const [completedGeo, currentGeo, upcomingGeo] = await Promise.all([
    completedCoords.length >= 2 ? fetchRouteGeometry(completedCoords) : null,
    currentCoords.length >= 2 ? fetchRouteGeometry(currentCoords) : null,
    upcomingCoords.length >= 2 ? fetchRouteGeometry(upcomingCoords) : null,
  ])

  // Add completed route (solid green)
  if (completedGeo) {
    map.addSource('route-completed', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: completedGeo },
    })
    map.addLayer({
      id: 'route-completed',
      type: 'line',
      source: 'route-completed',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': COLORS.routeCompleted,
        'line-width': 5,
        'line-opacity': 0.8,
      },
    })
  }

  // Add current segment (solid blue, slightly thicker)
  if (currentGeo) {
    map.addSource('route-current', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: currentGeo },
    })
    map.addLayer({
      id: 'route-current',
      type: 'line',
      source: 'route-current',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': COLORS.routeCurrent,
        'line-width': 6,
        'line-opacity': 0.9,
      },
    })
  }

  // Add upcoming route (dashed gray)
  if (upcomingGeo) {
    map.addSource('route-upcoming', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: upcomingGeo },
    })
    map.addLayer({
      id: 'route-upcoming',
      type: 'line',
      source: 'route-upcoming',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': COLORS.routeUpcoming,
        'line-width': 4,
        'line-opacity': 0.6,
        'line-dasharray': [2, 3],
      },
    })
  }

  // Add return leg to HQ (if returnToHqData provided)
  if (props.returnToHqData && props.stops.length > 0) {
    // Find last non-cancelled stop
    const lastStop = [...props.stops]
      .reverse()
      .find(s => !s.cancelled && s.lat != null && s.lng != null)

    if (lastStop?.lat != null && lastStop?.lng != null) {
      const returnCoords: [number, number][] = [
        [lastStop.lng, lastStop.lat],
        [props.startLng, props.startLat],
      ]

      const returnGeo = await fetchRouteGeometry(returnCoords)

      if (returnGeo) {
        // Check if all stops are completed
        const allCompleted = props.stops.every(s => s.status === 'completed' || s.cancelled)

        map.addSource('route-return', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: returnGeo },
        })

        if (allCompleted) {
          // Solid green when all stops completed
          map.addLayer({
            id: 'route-return',
            type: 'line',
            source: 'route-return',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': COLORS.routeCompleted,
              'line-width': 5,
              'line-opacity': 0.8,
            },
          })
        } else {
          // Dashed gray when stops still pending
          map.addLayer({
            id: 'route-return',
            type: 'line',
            source: 'route-return',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': COLORS.routeUpcoming,
              'line-width': 4,
              'line-opacity': 0.6,
              'line-dasharray': [2, 3],
            },
          })
        }
      }
    }
  }

  // ── 4. Fit bounds to show all markers ──

  const validCoords = allPoints
    .filter(p => p.lng && p.lat)
    .map(p => [p.lng, p.lat] as [number, number])

  if (validCoords.length >= 2) {
    const bounds = new mapboxgl.LngLatBounds()
    validCoords.forEach(c => bounds.extend(c))
    map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 500 })
  }
}

// ─── Expose a method to fly to a specific stop ──────────────────────

function flyToStop(index: number) {
  if (!map) return
  const stop = props.stops[index]
  if (stop?.lat != null && stop?.lng != null) {
    map.flyTo({ center: [stop.lng, stop.lat], zoom: 10, duration: 800 })
  }
}

defineExpose({ flyToStop })
</script>

<template>
  <div class="relative w-full h-full rounded-lg overflow-hidden border">
    <div ref="mapContainer" class="w-full h-full" />

    <!-- Legend (bottom-left overlay) -->
    <div class="absolute bottom-2 left-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-md px-3 py-2 text-[10px] space-y-1 shadow-sm border">
      <div class="flex items-center gap-2">
        <div class="w-3 h-0.5 rounded" :style="{ backgroundColor: COLORS.routeCompleted }"></div>
        <span>Completed</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-3 h-0.5 rounded" :style="{ backgroundColor: COLORS.routeCurrent }"></div>
        <span>Current</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-3 h-0.5 rounded border" style="border-style: dashed;" :style="{ borderColor: COLORS.routeUpcoming }"></div>
        <span>Upcoming</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-3 h-0.5 rounded border" style="border-style: dashed;" :style="{ borderColor: COLORS.routeUpcoming }"></div>
        <span>Return to HQ</span>
      </div>
    </div>

    <!-- AI Summary overlay (top-left) -->
    <slot name="overlay" />
  </div>
</template>

<style>
/* Pulse animation for current marker */
@keyframes pulse-ring {
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}
</style>
