<script setup lang="ts">
import { ref, computed } from 'vue'
import type { DateValue } from '@internationalized/date'
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { CalendarIcon } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import Button from './Button.vue'
import Calendar from './Calendar.vue'
import Popover from './Popover.vue'
import PopoverContent from './PopoverContent.vue'
import PopoverTrigger from './PopoverTrigger.vue'

interface Props {
  modelValue?: string | null
  placeholder?: string
  disabled?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Pick a date',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void
}>()

const df = new DateFormatter('en-US', {
  dateStyle: 'medium',
})

const isOpen = ref(false)

// Convert string "YYYY-MM-DD" to CalendarDate for the Calendar component
const calendarValue = computed<DateValue | undefined>(() => {
  if (!props.modelValue) return undefined
  try {
    // Split "YYYY-MM-DD" and construct CalendarDate
    const parts = props.modelValue.split('-')
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return undefined

    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    const day = parseInt(parts[2], 10)

    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return undefined
    }

    return new CalendarDate(year, month, day)
  } catch {
    return undefined
  }
})

// Display formatted date or placeholder
const displayValue = computed(() => {
  if (!calendarValue.value) return null
  // Convert DateValue to native Date for the formatter
  return df.format(calendarValue.value.toDate(getLocalTimeZone()))
})

// Handle calendar selection
const handleSelect = (value: DateValue | undefined) => {
  if (!value) {
    emit('update:modelValue', null)
  } else {
    // Format as YYYY-MM-DD string
    const year = String(value.year)
    const month = String(value.month).padStart(2, '0')
    const day = String(value.day).padStart(2, '0')
    emit('update:modelValue', `${year}-${month}-${day}`)
  }
  isOpen.value = false
}
</script>

<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        :disabled="disabled"
        :class="cn(
          'w-full justify-start text-left font-normal h-9',
          !calendarValue && 'text-muted-foreground',
          props.class
        )"
      >
        <CalendarIcon class="mr-2 h-4 w-4" />
        {{ displayValue || placeholder }}
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" align="start">
      <Calendar
        :model-value="calendarValue"
        @update:model-value="handleSelect"
        :initial-focus="true"
      />
    </PopoverContent>
  </Popover>
</template>
