<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'
import DialogContent from '@/components/ui/DialogContent.vue'
import DialogHeader from '@/components/ui/DialogHeader.vue'
import DialogTitle from '@/components/ui/DialogTitle.vue'
import DialogDescription from '@/components/ui/DialogDescription.vue'
import DialogFooter from '@/components/ui/DialogFooter.vue'
import Button from '@/components/ui/Button.vue'
import Label from '@/components/ui/Label.vue'
import Badge from '@/components/ui/Badge.vue'
import {
  Navigation,
  MapPin,
  Clock,
  Truck,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-vue-next'
import type { OrderWithDetails } from '@/stores/orders'

interface Props {
  isOpen: boolean
  isLoading: boolean
  deliverableOrders: OrderWithDetails[]
}

interface Emits {
  (e: 'update:isOpen', value: boolean): void
  (e: 'confirm', shiftEndTime: string, selectedOrderIds: string[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Time range: 6am to 10pm (6:00 to 22:00)
const MIN_HOUR = 6
const MAX_HOUR = 22
const TOTAL_SLOTS = (MAX_HOUR - MIN_HOUR) * 2 // 32 half-hour slots

// State
const endSlotIndex = ref(24) // Default to 6pm (18:00) = slot 24 from 6am
const isDragging = ref(false)
const isStopsExpanded = ref(false)
const selectedOrderIds = ref<Set<string>>(new Set())

// Initialize selection when dialog opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    // Select all orders by default
    selectedOrderIds.value = new Set(props.deliverableOrders.map(o => o.id))
  }
})

// Computed
const selectedCount = computed(() => selectedOrderIds.value.size)

const allSelected = computed(() =>
  selectedOrderIds.value.size === props.deliverableOrders.length
)

const someSelected = computed(() =>
  selectedOrderIds.value.size > 0 && selectedOrderIds.value.size < props.deliverableOrders.length
)

// Get current time rounded to nearest 30 minutes
const currentTimeSlot = computed(() => {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()

  // Round to nearest 30 min
  const roundedMinutes = minutes < 15 ? 0 : minutes < 45 ? 30 : 60
  let roundedHours = hours
  if (roundedMinutes === 60) {
    roundedHours += 1
    // roundedMinutes becomes 0 of next hour
  }

  // Calculate slot index from 6am
  const slot = (roundedHours - MIN_HOUR) * 2 + (roundedMinutes === 30 ? 1 : 0)
  return Math.max(0, Math.min(TOTAL_SLOTS, slot))
})

// Initialize end time on mount
onMounted(() => {
  // Set default end time to current time + 4 hours, capped at 10pm
  const defaultEndSlot = Math.min(currentTimeSlot.value + 8, TOTAL_SLOTS)
  endSlotIndex.value = defaultEndSlot
})

// Convert slot index to time string (HH:MM)
function slotToTime(slot: number): string {
  const totalMinutes = slot * 30
  const hours = MIN_HOUR + Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

// Format time for display (e.g., "6:00 AM", "2:30 PM")
function formatDisplayTime(slot: number): string {
  const totalMinutes = slot * 30
  let hours = MIN_HOUR + Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const period = hours >= 12 ? 'PM' : 'AM'
  if (hours > 12) hours -= 12
  if (hours === 0) hours = 12
  return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`
}

const currentTimeFormatted = computed(() => formatDisplayTime(currentTimeSlot.value))
const endTimeFormatted = computed(() => formatDisplayTime(endSlotIndex.value))

// Position percentages for the timeline
const startPosition = computed(() => {
  return (currentTimeSlot.value / TOTAL_SLOTS) * 100
})

const endPosition = computed(() => {
  return (endSlotIndex.value / TOTAL_SLOTS) * 100
})

// Available time calculation
const availableTime = computed(() => {
  const slotDiff = endSlotIndex.value - currentTimeSlot.value
  const minutes = slotDiff * 30
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours === 0) {
    return `${mins} min`
  } else if (mins === 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  } else {
    return `${hours}h ${mins}min`
  }
})

// Effective time for confirmation
const effectiveTime = computed(() => slotToTime(endSlotIndex.value))

// Handle drag
function handleDrag(e: MouseEvent) {
  if (!isDragging.value) return

  const timeline = (e.currentTarget as HTMLElement)
  const rect = timeline.getBoundingClientRect()
  const x = e.clientX - rect.left
  const percentage = Math.max(0, Math.min(1, x / rect.width))
  const slot = Math.round(percentage * TOTAL_SLOTS)

  // Ensure end is after start
  if (slot > currentTimeSlot.value) {
    endSlotIndex.value = slot
  }
}

function startDrag() {
  isDragging.value = true
}

function stopDrag() {
  isDragging.value = false
}

// Selection actions
function toggleOrder(orderId: string) {
  if (selectedOrderIds.value.has(orderId)) {
    selectedOrderIds.value.delete(orderId)
  } else {
    selectedOrderIds.value.add(orderId)
  }
}

function toggleAll() {
  if (allSelected.value) {
    selectedOrderIds.value.clear()
  } else {
    selectedOrderIds.value = new Set(props.deliverableOrders.map(o => o.id))
  }
}

// Actions
const handleConfirm = () => {
  emit('confirm', effectiveTime.value, Array.from(selectedOrderIds.value))
}
</script>

<template>
  <Dialog :open="isOpen" @update:open="emit('update:isOpen', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Navigation class="h-5 w-5" />
          Start Your Route
        </DialogTitle>
        <DialogDescription>
          Set your shift end time. The AI will optimize a round-trip route — you'll return to HQ by the time you specify.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-6 py-4 px-6">
        <!-- Start Location (read-only) -->
        <div>
          <Label class="text-xs text-muted-foreground mb-1 block">Starting From</Label>
          <div class="flex items-center gap-2 text-sm p-3 rounded-md border bg-muted/30">
            <MapPin class="h-4 w-4 text-muted-foreground flex-shrink-0" />
            4641 Av. Papineau, Montréal
          </div>
        </div>

        <!-- Return Location (read-only) -->
        <div>
          <Label class="text-xs text-muted-foreground mb-1 block">Returning To</Label>
          <div class="flex items-center gap-2 text-sm p-3 rounded-md border bg-green-50 dark:bg-green-950/30 border-green-200">
            <MapPin class="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
            <span class="text-green-700 dark:text-green-300">4641 Av. Papineau, Montréal</span>
          </div>
          <p class="text-xs text-muted-foreground mt-1.5">
            You'll complete all stops and return to HQ by your shift end time
          </p>
        </div>

        <!-- Shift Time Range Slider -->
        <div>
          <Label class="text-sm font-medium mb-3 block">Your Shift Time</Label>

          <!-- Current and End Time Display -->
          <div class="flex items-center justify-between mb-3 text-sm">
            <div>
              <div class="text-xs text-muted-foreground">Start (now)</div>
              <div class="font-semibold text-green-600">{{ currentTimeFormatted }}</div>
            </div>
            <div class="text-right">
              <div class="text-xs text-muted-foreground">End (drag to adjust)</div>
              <div class="font-semibold text-primary">{{ endTimeFormatted }}</div>
            </div>
          </div>

          <!-- Timeline Slider -->
          <div class="relative h-16 mb-4">
            <!-- Timeline bar -->
            <div
              class="absolute top-8 left-0 right-0 h-2 bg-muted rounded-full cursor-pointer"
              @mousedown="startDrag"
              @mousemove="handleDrag"
              @mouseup="stopDrag"
              @mouseleave="stopDrag"
            >
              <!-- Selected range -->
              <div
                class="absolute h-full bg-primary rounded-full transition-all"
                :style="{
                  left: `${startPosition}%`,
                  width: `${endPosition - startPosition}%`
                }"
              />

              <!-- Start marker (current time - locked) -->
              <div
                class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-green-600 rounded-full border-2 border-white shadow-md"
                :style="{ left: `${startPosition}%` }"
              >
              </div>

              <!-- End marker (draggable) -->
              <div
                class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-primary rounded-full border-2 border-white shadow-lg cursor-grab active:cursor-grabbing transition-transform hover:scale-110"
                :style="{ left: `${endPosition}%` }"
                :class="{ 'scale-110': isDragging }"
              >
                <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap text-primary">
                  Finish
                </div>
              </div>
            </div>

            <!-- Time labels -->
            <div class="absolute top-0 left-0 right-0 flex justify-between text-[10px] text-muted-foreground">
              <span>6 AM</span>
              <span>10 AM</span>
              <span>2 PM</span>
              <span>6 PM</span>
              <span>10 PM</span>
            </div>
          </div>

          <p class="text-xs text-muted-foreground italic">
            Drag the blue marker to set when your shift ends. The route will ensure you return to HQ by this time.
          </p>
        </div>

        <!-- Stops Selection -->
        <div class="border-t pt-4">
          <!-- Expandable Header -->
          <button
            @click="isStopsExpanded = !isStopsExpanded"
            class="w-full flex items-center justify-between text-sm font-medium hover:bg-accent/50 -mx-2 px-2 py-2 rounded-md transition-colors"
          >
            <div class="flex items-center gap-2">
              <Truck class="h-4 w-4" />
              <span>Stops to Include</span>
              <Badge variant="default" class="ml-1">{{ selectedCount }} / {{ deliverableOrders.length }}</Badge>
            </div>
            <component :is="isStopsExpanded ? ChevronUp : ChevronDown" class="h-4 w-4" />
          </button>

          <!-- Expandable List -->
          <div v-if="isStopsExpanded" class="mt-3 space-y-2 max-h-64 overflow-y-auto">
            <!-- Select All -->
            <label class="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 cursor-pointer border-b pb-3 mb-2">
              <input
                type="checkbox"
                :checked="allSelected"
                :indeterminate="someSelected"
                @change="toggleAll"
                class="w-4 h-4 rounded accent-primary"
              />
              <span class="text-sm font-medium">
                {{ allSelected ? 'Deselect All' : 'Select All' }}
              </span>
            </label>

            <!-- Individual Orders -->
            <label
              v-for="order in deliverableOrders"
              :key="order.id"
              class="flex items-start gap-3 p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                :checked="selectedOrderIds.has(order.id)"
                @change="toggleOrder(order.id)"
                class="w-4 h-4 mt-0.5 rounded accent-primary"
              />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">{{ order.customer.name }}</div>
                <div class="text-xs text-muted-foreground truncate">{{ order.customer.address }}</div>
                <div class="text-xs text-muted-foreground mt-0.5">
                  {{ order.items.filter((i: any) => i.status === 'ready' || i.status === 'out_for_delivery').length }} item(s)
                  <span v-if="order.external_id" class="ml-2">Order #{{ order.external_id }}</span>
                </div>
              </div>
            </label>

            <div v-if="deliverableOrders.length === 0" class="text-sm text-muted-foreground text-center py-4">
              No deliveries available
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:isOpen', false)" :disabled="isLoading">
          Cancel
        </Button>
        <Button @click="handleConfirm" :disabled="selectedCount === 0 || isLoading">
          <Loader2 v-if="isLoading" class="h-4 w-4 mr-2 animate-spin" />
          {{ isLoading ? 'Generating Route...' : `Generate Route (${selectedCount})` }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
