<script setup lang="ts">
import { ref, computed } from 'vue'
import { formatDistanceToNow } from 'date-fns'
import { getStatusVariant, statusColorMap } from '@/lib/variants'
import { statusOptions } from '@/lib/constants'
import type { ItemStatus, Activity } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useActivityStore } from '@/stores/activities'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import {
  Package,
  MessageSquare,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  FileText,
  User,
  Settings,
  Search,
  Eye,
  EyeOff,
  Star,
  AlertTriangle
} from 'lucide-vue-next'

interface Props {
  activities: Activity[]
}

interface Emits {
  (e: 'activity-click', orderId: string): void
  (e: 'toggle-seen', activityId: string): void
  (e: 'toggle-important', activityId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const authStore = useAuthStore()
const activityStore = useActivityStore()

const getActivityIcon = (type: Activity['type']) => {
  switch (type) {
    case 'status_change':
      return Settings
    case 'note_added':
      return MessageSquare
    case 'delivery':
      return Truck
    case 'pickup':
      return CheckCircle2
    case 'assignment':
      return MapPin
    case 'order_created':
      return FileText
    case 'alert':
      return AlertTriangle
    default:
      return Package
  }
}

const getActivityColor = (activity: Activity) => {
  // For status-related activities, use status color
  let status = getCurrentStatus(activity)
  if (status) {
    const statusEnum = status.toLowerCase().replace(/\s+/g, '_') as ItemStatus
    const colorMap: Record<ItemStatus, string> = {
      new: 'text-slate-600 bg-slate-50 dark:bg-slate-950',
      assigned: 'text-blue-600 bg-blue-50 dark:bg-blue-950',
      in_production: 'text-amber-600 bg-amber-50 dark:bg-amber-950',
      on_hold: 'text-orange-600 bg-orange-50 dark:bg-orange-950',
      ready: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950',
      out_for_delivery: 'text-violet-600 bg-violet-50 dark:bg-violet-950',
      delivered: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950',
      picked_up: 'text-teal-600 bg-teal-50 dark:bg-teal-950',
      canceled: 'text-red-600 bg-red-50 dark:bg-red-950',
    }
    if (colorMap[statusEnum]) return colorMap[statusEnum]
  }

  // Fallback to activity type colors for non-status activities
  switch (activity.type) {
    case 'note_added':
      return 'text-purple-600 bg-purple-50 dark:bg-purple-950'
    case 'order_created':
      return 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950'
    case 'alert':
      return activity.details.alertLevel === 'critical'
        ? 'text-red-600 bg-red-50 dark:bg-red-950'
        : 'text-amber-600 bg-amber-50 dark:bg-amber-950'
    default:
      return 'text-gray-600 bg-gray-50 dark:bg-gray-950'
  }
}

// Helper to get status badge classes based on activity status
const getStatusBadgeClasses = (status: string): string => {
  const statusEnum = status.toLowerCase().replace(/\s+/g, '_') as ItemStatus
  const colorMap: Record<ItemStatus, string> = {
    new: 'border-slate-600 bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-500',
    assigned: 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-500',
    in_production: 'border-amber-600 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-500',
    on_hold: 'border-orange-600 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-500',
    ready: 'border-cyan-600 bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400 dark:border-cyan-500',
    out_for_delivery: 'border-violet-600 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-500',
    delivered: 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-500',
    picked_up: 'border-teal-600 bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-500',
    canceled: 'border-red-600 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400 dark:border-red-500',
  }
  return colorMap[statusEnum] || 'border-border text-foreground'
}

const formatTimeAgo = (timestamp: string) => {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
}

const formatStatusText = (status: string): string => {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const getCurrentStatus = (activity: Activity): string | null => {
  // For status changes, use the 'to' status
  if (activity.type === 'status_change' && activity.details.to) {
    return activity.details.to
  }

  // For other activity types, infer status from activity type
  switch (activity.type) {
    case 'pickup':
      return 'picked_up'
    case 'delivery':
      return 'out_for_delivery'
    case 'assignment':
      return 'assigned'
    case 'order_created':
      return 'new'
    default:
      return null
  }
}

// Search and filter functionality
const searchQuery = ref('')
const statusFilter = ref<string>('all')
const displayFilter = ref<'all' | 'new' | 'seen'>('all')
const showImportantOnly = ref(false)

// Filter options
const displayOptions = [
  { value: 'all', label: 'Display All' },
  { value: 'new', label: 'New' },
  { value: 'seen', label: 'Seen' }
]

// Combobox state
const statusComboboxOpen = ref(false)
const displayComboboxOpen = ref(false)
const statusComboboxRef = ref<HTMLElement>()
const displayComboboxRef = ref<HTMLElement>()

// Toggle handlers
const handleToggleSeen = (activityId: string, event: Event) => {
  event.stopPropagation()
  emit('toggle-seen', activityId)
}

const handleToggleImportant = (activityId: string, event: Event) => {
  event.stopPropagation()
  emit('toggle-important', activityId)
}

// Combobox handlers
const toggleStatusCombobox = (e: Event) => {
  e.stopPropagation()
  statusComboboxOpen.value = !statusComboboxOpen.value
  displayComboboxOpen.value = false
}

const toggleDisplayCombobox = (e: Event) => {
  e.stopPropagation()
  displayComboboxOpen.value = !displayComboboxOpen.value
  statusComboboxOpen.value = false
}

const handleStatusChange = (status: string, e: Event) => {
  e.stopPropagation()
  statusFilter.value = status
  statusComboboxOpen.value = false
}

const handleDisplayChange = (display: 'all' | 'new' | 'seen', e: Event) => {
  e.stopPropagation()
  displayFilter.value = display
  displayComboboxOpen.value = false
}

const handleClickOutside = (e: MouseEvent) => {
  if (statusComboboxRef.value && !statusComboboxRef.value.contains(e.target as Node)) {
    statusComboboxOpen.value = false
  }
  if (displayComboboxRef.value && !displayComboboxRef.value.contains(e.target as Node)) {
    displayComboboxOpen.value = false
  }
}

const mounted = () => {
  document.addEventListener('click', handleClickOutside)
}

const beforeUnmount = () => {
  document.removeEventListener('click', handleClickOutside)
}

// Helper to safely get status color
const getStatusColor = (status: string): string => {
  if (status === 'all') return ''
  return statusColorMap[status as ItemStatus] || ''
}

// Helper to get border/outline classes based on activity status
const getActivityBorderClasses = (activity: Activity): string => {
  // Important (starred) activities always get orange border
  if (activityStore.isImportant(activity.id)) {
    return 'border-orange-600 dark:border-orange-900 shadow-orange-100 shadow-sm outline outline-4 outline-orange-600/10'
  }

  // Seen items get default border (no color)
  if (activityStore.isSeen(activity.id)) {
    return 'border-border'
  }

  // Get the status for this activity
  let status = getCurrentStatus(activity)
  if (!status) return 'border-border' // Default border if no status

  // Convert formatted status ("Ready", "In Production") to enum value ("ready", "in_production")
  const statusEnum = status.toLowerCase().replace(/\s+/g, '_') as ItemStatus

  // Map status to border/outline colors (only for unseen items)
  const colorMap: Record<ItemStatus, string> = {
    new: 'border-slate-600 outline outline-3 outline-slate-600/10',
    assigned: 'border-blue-600 outline outline-3 outline-blue-600/10',
    in_production: 'border-amber-600 outline outline-3 outline-amber-600/10',
    on_hold: 'border-orange-600 outline outline-3 outline-orange-600/10',
    ready: 'border-cyan-600 outline outline-3 outline-cyan-600/10',
    out_for_delivery: 'border-violet-600 outline outline-3 outline-violet-600/10',
    delivered: 'border-emerald-600 outline outline-3 outline-emerald-600/10',
    picked_up: 'border-teal-600 outline outline-3 outline-teal-600/10',
    canceled: 'border-red-600 outline outline-3 outline-red-600/10',
  }

  return colorMap[statusEnum] || 'border-border'
}

const filteredActivities = computed(() => {
  let filtered = props.activities

  // Apply search filter if needed
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter((activity) => {
      // Search in message
      if (activity.details.message?.toLowerCase().includes(query)) return true

      // Search in user name
      if (activity.user.toLowerCase().includes(query)) return true

      // Search in item name
      if (activity.details.itemName?.toLowerCase().includes(query)) return true

      // Search in customer name
      if (activity.details.customerName?.toLowerCase().includes(query)) return true

      // Search in order ID
      if (activity.details.orderExternalId?.toLowerCase().includes(query)) return true
      if (activity.order_id?.toLowerCase().includes(query)) return true

      // Search in note content
      if (activity.details.note?.toLowerCase().includes(query)) return true

      return false
    })
  }

  // Apply status filter (filter by item status for status_change activities)
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(activity => {
      // For status_change activities, check the 'to' status
      if (activity.type === 'status_change' && activity.details.to) {
        return activity.details.to === statusFilter.value
      }
      // For other activity types, check inferred status
      const currentStatus = getCurrentStatus(activity)
      return currentStatus === statusFilter.value
    })
  }

  // Apply display filter
  if (displayFilter.value === 'new') {
    filtered = filtered.filter(activity => !activityStore.isSeen(activity.id))
  } else if (displayFilter.value === 'seen') {
    filtered = filtered.filter(activity => activityStore.isSeen(activity.id))
  }

  // Apply important filter
  if (showImportantOnly.value) {
    filtered = filtered.filter(activity => activityStore.isImportant(activity.id))
  }

  // Sort: important first, then unseen, then seen, then by timestamp
  return [...filtered].sort((a, b) => {
    // Important items always at the top
    const aImportant = activityStore.isImportant(a.id)
    const bImportant = activityStore.isImportant(b.id)
    if (aImportant && !bImportant) return -1
    if (!aImportant && bImportant) return 1

    // Then unseen before seen
    const aSeen = activityStore.isSeen(a.id)
    const bSeen = activityStore.isSeen(b.id)
    if (!aSeen && bSeen) return -1
    if (aSeen && !bSeen) return 1

    // Finally by timestamp (newest first)
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })
})
</script>

<template>
  <div class="flex h-full flex-col" @vue:mounted="mounted" @vue:before-unmount="beforeUnmount">
    <!-- Header -->
    <div class="border-b bg-background p-4 space-y-3">
      <!-- Search Input -->
      <div class="relative">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          type="text"
          placeholder="Search activities..."
          class="pl-9 h-9 text-sm"
        />
      </div>

      <!-- Filter Comboboxes -->
      <div class="flex gap-2">
        <!-- Status Filter Combobox -->
        <div ref="statusComboboxRef" class="relative flex-1">
          <button
            @click="toggleStatusCombobox"
            class="flex h-8 w-full items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-xs shadow-sm ring-offset-background transition-colors hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <div class="flex items-center gap-1.5 flex-1 min-w-0">
              <div v-if="statusFilter !== 'all'" :class="`h-2.5 w-2.5 rounded-full flex-shrink-0 ${getStatusColor(statusFilter)}`"></div>
              <span class="text-xs truncate">{{ statusOptions.find(opt => opt.value === statusFilter)?.label || 'All Statuses' }}</span>
            </div>
            <svg
              class="h-3 w-3 shrink-0 transition-transform"
              :class="{ 'rotate-180': statusComboboxOpen }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Status Dropdown -->
          <div
            v-if="statusComboboxOpen"
            class="absolute z-50 mt-1 left-0 w-full min-w-max rounded-lg border bg-popover shadow-lg"
            @click.stop
          >
            <div class="p-1 max-h-60 overflow-auto">
              <button
                v-for="option in statusOptions"
                :key="option.value"
                @click="(e) => handleStatusChange(option.value, e)"
                :class="[
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors hover:bg-accent hover:text-accent-foreground',
                  statusFilter === option.value ? 'bg-accent/50' : ''
                ]"
              >
                <div v-if="option.value !== 'all'" :class="`h-2.5 w-2.5 rounded-full ${getStatusColor(option.value)}`"></div>
                <span class="flex-1 text-left">{{ option.label }}</span>
                <svg
                  v-if="statusFilter === option.value"
                  class="h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Display Filter Combobox -->
        <div ref="displayComboboxRef" class="relative flex-1">
          <button
            @click="toggleDisplayCombobox"
            class="flex h-8 w-full items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-xs shadow-sm ring-offset-background transition-colors hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <span class="text-xs truncate flex-1 text-left">{{ displayOptions.find(opt => opt.value === displayFilter)?.label || 'Display All' }}</span>
            <svg
              class="h-3 w-3 shrink-0 transition-transform"
              :class="{ 'rotate-180': displayComboboxOpen }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Display Dropdown -->
          <div
            v-if="displayComboboxOpen"
            class="absolute z-50 mt-1 left-0 w-full min-w-max rounded-lg border bg-popover shadow-lg"
            @click.stop
          >
            <div class="p-1">
              <button
                v-for="option in displayOptions"
                :key="option.value"
                @click="(e) => handleDisplayChange(option.value as 'all' | 'new' | 'seen', e)"
                :class="[
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors hover:bg-accent hover:text-accent-foreground',
                  displayFilter === option.value ? 'bg-accent/50' : ''
                ]"
              >
                <span class="flex-1 text-left">{{ option.label }}</span>
                <svg
                  v-if="displayFilter === option.value"
                  class="h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Star Button -->
        <Button
          variant="ghost"
          size="sm"
          @click="showImportantOnly = !showImportantOnly"
          :class="showImportantOnly ? 'bg-accent text-orange-600' : ''"
          class="h-8 text-xs px-2 hover:border-transparent"
        >
          <Star :class="showImportantOnly ? 'h-4 w-4 fill-orange-600' : 'h-4 w-4'" />
        </Button>
      </div>
    </div>

    <!-- Activity List -->
    <div class="flex-1 overflow-auto p-4 space-y-3">
      <div
        v-for="activity in filteredActivities"
        :key="activity.id"
        @click="activity.order_id && emit('activity-click', activity.order_id)"
        :class="[
          'relative rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer',
          activityStore.isSeen(activity.id) ? 'p-2' : 'p-3',
          getActivityBorderClasses(activity)
        ]"
      >
        <!-- Row 1: Icon, Title -->
        <div class="flex gap-3 items-center mb-2">
          <div :class="['rounded-full p-2 flex-shrink-0', getActivityColor(activity)]">
            <component :is="getActivityIcon(activity.type)" class="h-4 w-4" />
          </div>

          <div class="text-sm font-medium flex-1 min-w-0">
            {{ activity.details.message }}
          </div>
        </div>

        <!-- Row 2: Content (collapsed if seen) -->
        <div v-if="!activityStore.isSeen(activity.id)" class="space-y-1 p-2">
            <!-- Item/Order Info -->
            <div v-if="activity.details.itemName" class="text-xs text-muted-foreground">
              <span class="font-medium">{{ activity.details.itemName }}</span>
            </div>
            <div v-if="activity.order_id" class="text-xs text-muted-foreground pb-4">
              Order #{{ activity.details.orderExternalId || activity.order_id.slice(0, 8) }} • {{ activity.details.customerName }}
            </div>

            <!-- Status Display -->
            <div class="flex items-center gap-2">
              <template v-if="activity.type === 'status_change' && activity.details.from && activity.details.to">
                <div :class="['inline-flex items-center rounded-xl border px-2.5 py-0.5 text-xs', getStatusBadgeClasses(activity.details.from)]">
                  {{ formatStatusText(activity.details.from) }}
                </div>
                <span class="text-xs text-muted-foreground">→</span>
                <div :class="['inline-flex items-center rounded-xl border px-2.5 py-0.5 text-xs', getStatusBadgeClasses(activity.details.to)]">
                  {{ formatStatusText(activity.details.to) }}
                </div>
              </template>
              <template v-else-if="getCurrentStatus(activity)">
                <div :class="['inline-flex items-center rounded-xl border px-2.5 py-0.5 text-xs', getStatusBadgeClasses(getCurrentStatus(activity)!)]">
                  {{ formatStatusText(getCurrentStatus(activity)!) }}
                </div>
              </template>
              <!-- Alert Level Display -->
              <template v-else-if="activity.type === 'alert' && activity.details.alertLevel">
                <Badge :variant="activity.details.alertLevel === 'critical' ? 'destructive' : 'warning'" class="text-xs">
                  {{ activity.details.alertLevel === 'critical' ? 'Critical' : 'Warning' }}
                </Badge>
              </template>
            </div>

            <!-- Note Preview -->
            <div v-if="activity.type === 'note_added' && activity.details.note" class="text-xs bg-muted/50 rounded p-2 italic">
              "{{ activity.details.note }}"
            </div>

            <!-- Footer -->
            <div class="space-y-1 pt-4">
              <div class="flex items-center gap-2">
                <User class="h-3 w-3 text-muted-foreground" />
                <span class="text-xs text-muted-foreground">{{ activity.user }}</span>
              </div>
              <div class="flex items-center gap-2">
                <Clock class="h-3 w-3 text-muted-foreground" />
                <span class="text-xs text-muted-foreground">{{ formatTimeAgo(activity.timestamp) }}</span>
              </div>
            </div>
        </div>

        <!-- Collapsed view for seen activities -->
        <div v-else class="px-2 py-1 space-y-1">
          <!-- Item/Order Info -->
          <div v-if="activity.details.itemName" class="text-xs text-muted-foreground">
            <span class="font-medium">{{ activity.details.itemName }}</span>
          </div>
          <div v-if="activity.order_id" class="text-xs text-muted-foreground">
            Order #{{ activity.details.orderExternalId || activity.order_id.slice(0, 8) }} • {{ activity.details.customerName }}
          </div>

          <div class="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <Clock class="h-3 w-3" />
            <span>{{ formatTimeAgo(activity.timestamp) }}</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-2 mt-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            @click="activity.order_id && emit('activity-click', activity.order_id)"
            class="flex-1 h-7 text-xs"
          >
            Open
          </Button>
          <Button
            variant="outline"
            size="sm"
            @click="handleToggleSeen(activity.id, $event)"
            class="h-7 text-xs px-2 flex items-center gap-1.5"
          >
            <component :is="activityStore.isSeen(activity.id) ? EyeOff : Eye" class="h-3 w-3" />
            <span>{{ activityStore.isSeen(activity.id) ? 'Mark as new' : 'Mark as seen' }}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            @click="handleToggleImportant(activity.id, $event)"
            :class="activityStore.isImportant(activity.id) ? 'h-7 w-7 p-0 text-orange-600 hover:text-orange-700 border-orange-600' : 'h-7 w-7 p-0'"
          >
            <Star :class="activityStore.isImportant(activity.id) ? 'h-3 w-3 fill-orange-600' : 'h-3 w-3'" />
          </Button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredActivities.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
        <Package class="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p class="text-sm text-muted-foreground">
          {{ searchQuery ? 'No activities match your search' : 'No recent activity' }}
        </p>
      </div>
    </div>
  </div>
</template>
