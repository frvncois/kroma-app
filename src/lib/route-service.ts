// src/lib/route-service.ts

import OpenAI from 'openai'
import type { RouteStop, DriverRoute } from '@/stores/drivers'

// ─── Types ───────────────────────────────────────────────────────────────

export interface RouteInput {
  driverId: string
  driverName: string
  startAddress: string
  startLat: number
  startLng: number
  endAddress: string                // Return destination (HQ)
  endLat: number
  endLng: number
  currentTime: string               // ISO
  shiftEndTime: string              // "17:00" or "HH:MM"
  stops: RouteStopInput[]
}

export interface RouteStopInput {
  id: string
  type: 'pickup' | 'dropoff' | 'task'
  address: string
  lat?: number
  lng?: number
  // Context
  printshopName?: string
  customerName?: string
  customerNotes?: string
  orderExternalId?: string
  // Items
  items: { id: string; name: string; quantity: number }[]
  // Priority
  dueDate?: string | null            // ISO date or null
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  // Dependencies
  requiresPickupStopIds?: string[]    // This delivery requires these pickups first
  relatedDeliveryStopIds?: string[]   // This pickup is needed by these deliveries
}

interface AIRouteResponse {
  route: {
    stop_id: string
    sequence: number
    estimated_arrival: string        // "09:15 AM"
    estimated_departure: string      // "09:30 AM"
    travel_minutes_from_previous: number
    distance_km_from_previous: number
    fits_in_shift: boolean
    reasoning: string
  }[]
  return_to_hq: {
    travel_minutes_from_last_stop: number
    distance_km_from_last_stop: number
    estimated_arrival_at_hq: string   // "4:45 PM"
  }
  summary: string
  total_estimated_minutes: number     // INCLUDING return
  total_distance_km: number           // INCLUDING return
  stops_over_capacity: number
  warnings: string[]
}

// ─── OpenAI Client ───────────────────────────────────────────────────────

function getOpenAIClient(): OpenAI {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      'VITE_OPENAI_API_KEY is not set. Add it to your .env file.'
    )
  }
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,  // Phase 1 only — moves to serverless in Phase 2
  })
}

// ─── Prompt Builder ──────────────────────────────────────────────────────

function buildRoutePrompt(input: RouteInput): string {
  const stopDescriptions = input.stops.map((stop, i) => {
    const itemList = stop.items.map(it => `${it.name} (${it.quantity}x)`).join(', ')
    const dueInfo = stop.dueDate
      ? `Due: ${new Date(stop.dueDate).toLocaleDateString('en-CA')}`
      : 'No due date'
    const priorityInfo = stop.priority ? `Priority: ${stop.priority}` : ''
    const deps = stop.requiresPickupStopIds?.length
      ? `REQUIRES PICKUP FIRST: ${stop.requiresPickupStopIds.join(', ')}`
      : ''
    const relDel = stop.relatedDeliveryStopIds?.length
      ? `NEEDED BY DELIVERIES: ${stop.relatedDeliveryStopIds.join(', ')}`
      : ''
    const custNotes = stop.customerNotes ? `Customer notes: ${stop.customerNotes}` : ''

    return `
STOP ${stop.id}:
  Type: ${stop.type}
  Address: ${stop.address}
  ${stop.printshopName ? `Printshop: ${stop.printshopName}` : ''}
  ${stop.customerName ? `Customer: ${stop.customerName}` : ''}
  ${stop.orderExternalId ? `Order: ${stop.orderExternalId}` : ''}
  Items: ${itemList}
  ${dueInfo}
  ${priorityInfo}
  ${deps}
  ${relDel}
  ${custNotes}
`.trim()
  }).join('\n\n')

  return `You are a delivery route optimizer for a print shop in Montréal, Quebec.

TASK: Generate an optimized ROUND-TRIP delivery route. The driver must return to HQ by end of shift.

START LOCATION: ${input.startAddress}
END LOCATION (MUST RETURN HERE): ${input.endAddress}
CURRENT TIME: ${new Date(input.currentTime).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
SHIFT ENDS AT: ${input.shiftEndTime}
STOP DURATION: Each pickup or delivery takes 15 minutes.
CITY: Montréal — estimate travel times based on typical urban driving (assume ~25-35 km/h average with traffic, parking).

CRITICAL CONSTRAINTS:
1. ROUND TRIP: The driver MUST return to "${input.endAddress}" after the last stop. Factor the return drive time into the time budget. The last stop should be chosen so the driver can still make it back to HQ by ${input.shiftEndTime}.
2. PICKUP-BEFORE-DELIVERY: Any pickup stop MUST come before its related delivery stops. Look at the "REQUIRES PICKUP FIRST" and "NEEDED BY DELIVERIES" fields.
3. PRIORITY: Stops with earlier due dates and higher priority (urgent > high > medium > low) should be scheduled earlier, but geographic efficiency matters too — don't cross the city twice if a nearby stop is only slightly lower priority.
4. TIME BUDGET: The driver must complete all stops AND return to HQ by ${input.shiftEndTime}. Mark stops that won't fit (including return time) as fits_in_shift: false.
5. GEOGRAPHIC EFFICIENCY: Minimize total travel distance. The route should make geographic sense as a loop — go out and come back, don't zigzag.
6. LAST STOP PROXIMITY: When possible, the last stop before returning to HQ should be geographically close to HQ to minimize the return trip.

STOPS TO SCHEDULE:

${stopDescriptions}

RESPOND ONLY WITH JSON (no markdown, no backticks, no preamble). Use this exact format:

{
  "route": [
    {
      "stop_id": "the stop id from above",
      "sequence": 1,
      "estimated_arrival": "9:15 AM",
      "estimated_departure": "9:30 AM",
      "travel_minutes_from_previous": 12,
      "distance_km_from_previous": 4.5,
      "fits_in_shift": true,
      "reasoning": "Short explanation for this position"
    }
  ],
  "return_to_hq": {
    "travel_minutes_from_last_stop": 10,
    "distance_km_from_last_stop": 3.5,
    "estimated_arrival_at_hq": "4:45 PM"
  },
  "summary": "High-level route description mentioning the loop back to HQ",
  "total_estimated_minutes": 240,
  "total_distance_km": 35,
  "stops_over_capacity": 0,
  "warnings": ["any timing concerns including return feasibility"]
}`
}

// ─── Route Generation ────────────────────────────────────────────────────

export async function generateRoute(input: RouteInput): Promise<{
  stops: RouteStop[]
  summary: string
  totalMinutes: number
  totalDistanceKm: number
  stopsOverCapacity: number
  warnings: string[]
  returnToHq: {
    travelMinutes: number
    distanceKm: number
    estimatedArrival: string
  }
}> {
  const client = getOpenAIClient()
  const prompt = buildRoutePrompt(input)

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,   // Low temp for consistent routing
    max_tokens: 4000,
  })

  const rawContent = response.choices[0]?.message?.content || ''

  // Parse JSON — strip any accidental markdown fences
  const cleaned = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  let parsed: AIRouteResponse

  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    console.error('Failed to parse OpenAI route response:', rawContent)
    throw new Error('Failed to parse AI route response. Please try again.')
  }

  // Map AI response back to RouteStop objects
  const inputStopMap = new Map(input.stops.map(s => [s.id, s]))

  const routeStops: RouteStop[] = parsed.route.map((aiStop) => {
    const original = inputStopMap.get(aiStop.stop_id)
    if (!original) {
      console.warn(`AI returned unknown stop_id: ${aiStop.stop_id}`)
      // Create a minimal stop
      return {
        id: aiStop.stop_id,
        type: 'dropoff' as const,
        status: 'pending' as const,
        address: 'Unknown',
        itemIds: [],
        itemSummary: '',
        confirmedItemIds: [],
        stopDurationMinutes: 15,
        fitsInShift: aiStop.fits_in_shift,
        estimatedArrival: aiStop.estimated_arrival,
        estimatedDeparture: aiStop.estimated_departure,
        travelMinutesFromPrevious: aiStop.travel_minutes_from_previous,
        distanceKmFromPrevious: aiStop.distance_km_from_previous,
        aiNotes: aiStop.reasoning,
        note: '',
        photos: [],
        hasIssue: false,
        cancelled: false,
      }
    }

    return {
      id: original.id,
      type: original.type,
      status: 'pending' as const,
      address: original.address,
      lat: original.lat,
      lng: original.lng,
      // Printshop
      printshopId: undefined,         // Set by caller who has this context
      printshopName: original.printshopName,
      // Customer/Order
      orderId: undefined,             // Set by caller
      orderExternalId: original.orderExternalId,
      customerId: undefined,          // Set by caller
      customerName: original.customerName,
      customerNotes: original.customerNotes,
      // Items
      itemIds: original.items.map(i => i.id),
      itemSummary: original.items.map(i => `${i.name} (${i.quantity}x)`).join(', '),
      confirmedItemIds: [],           // No items confirmed initially
      // Task
      taskTitle: undefined,
      taskPriority: original.priority,
      // AI metadata
      estimatedArrival: aiStop.estimated_arrival,
      estimatedDeparture: aiStop.estimated_departure,
      travelMinutesFromPrevious: aiStop.travel_minutes_from_previous,
      distanceKmFromPrevious: aiStop.distance_km_from_previous,
      stopDurationMinutes: 15,
      fitsInShift: aiStop.fits_in_shift,
      aiNotes: aiStop.reasoning,
      // Completion
      note: '',
      photos: [],
      hasIssue: false,
      cancelled: false,
    }
  })

  // Mark first stop as current
  if (routeStops.length > 0 && routeStops[0]) {
    routeStops[0].status = 'current'
  }

  return {
    stops: routeStops,
    summary: parsed.summary,
    totalMinutes: parsed.total_estimated_minutes,
    totalDistanceKm: parsed.total_distance_km,
    stopsOverCapacity: parsed.stops_over_capacity,
    warnings: parsed.warnings,
    returnToHq: {
      travelMinutes: parsed.return_to_hq?.travel_minutes_from_last_stop || 0,
      distanceKm: parsed.return_to_hq?.distance_km_from_last_stop || 0,
      estimatedArrival: parsed.return_to_hq?.estimated_arrival_at_hq || '',
    },
  }
}

// ─── Recalculation (mid-route) ───────────────────────────────────────────

/**
 * Recalculate route with new items added and completed stops preserved.
 * Called when:
 * - Driver presses "Add new items to route"
 * - An item is transferred to this driver
 *
 * The prompt includes the driver's CURRENT position (last completed stop or start)
 * and only the remaining + new stops.
 */
export async function recalculateRoute(
  existingRoute: DriverRoute,
  newStopInputs: RouteStopInput[],
  currentTime: string
): Promise<{
  stops: RouteStop[]
  summary: string
  totalMinutes: number
  totalDistanceKm: number
  stopsOverCapacity: number
  warnings: string[]
  returnToHq: {
    travelMinutes: number
    distanceKm: number
    estimatedArrival: string
  }
}> {
  // Build input from remaining stops + new stops
  const completedStops = existingRoute.stops.filter(s => s.status === 'completed')
  const remainingStops = existingRoute.stops.filter(
    s => s.status !== 'completed' && !s.cancelled
  )

  // Determine current position
  const lastCompleted = completedStops[completedStops.length - 1]
  const currentAddress = lastCompleted?.address || existingRoute.startAddress
  const currentLat = lastCompleted?.lat || existingRoute.startLat
  const currentLng = lastCompleted?.lng || existingRoute.startLng

  // Convert remaining RouteStops back to RouteStopInput for the prompt
  const remainingInputs: RouteStopInput[] = remainingStops.map(stop => ({
    id: stop.id,
    type: stop.type,
    address: stop.address,
    lat: stop.lat,
    lng: stop.lng,
    printshopName: stop.printshopName,
    customerName: stop.customerName,
    customerNotes: stop.customerNotes,
    orderExternalId: stop.orderExternalId,
    items: stop.itemIds.map(id => ({ id, name: 'Item', quantity: 1 })), // Simplified
    dueDate: null,
    priority: stop.taskPriority,
  }))

  const allStopInputs = [...remainingInputs, ...newStopInputs]

  const input: RouteInput = {
    driverId: existingRoute.driverId,
    driverName: existingRoute.driverName,
    startAddress: currentAddress,
    startLat: currentLat,
    startLng: currentLng,
    endAddress: existingRoute.startAddress,    // HQ — same as original start
    endLat: existingRoute.startLat,
    endLng: existingRoute.startLng,
    currentTime,
    shiftEndTime: existingRoute.shiftEndTime,
    stops: allStopInputs,
  }

  const result = await generateRoute(input)

  // Prepend completed stops (they stay frozen at the beginning)
  const finalStops: RouteStop[] = [
    ...completedStops,
    ...result.stops,
  ]

  return {
    ...result,
    stops: finalStops,
  }
}
