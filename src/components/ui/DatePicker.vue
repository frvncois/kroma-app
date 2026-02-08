<script setup lang="ts">
import { DateFormatter, getLocalTimeZone, today } from '@internationalized/date'
import { CalendarIcon } from 'lucide-vue-next'
import { ref, computed, watch } from 'vue'
import Button from './Button.vue'
import Calendar from './Calendar.vue'
import Popover from './Popover.vue'
import PopoverContent from './PopoverContent.vue'
import PopoverTrigger from './PopoverTrigger.vue'
import { cn } from '@/lib/utils'

interface Props {
  modelValue?: string | null
  placeholder?: string
  disabled?: boolean
  class?: string
}

interface Emits {
  (e: 'update:modelValue', value: string | null): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Pick a date',
})

const emit = defineEmits<Emits>()

const date = ref<Date>()
const defaultPlaceholder = today(getLocalTimeZone())

// Convert string to Date for internal use
watch(() => props.modelValue, (newValue) => {
  if (!newValue) {
    date.value = undefined
  } else {
    date.value = new Date(newValue)
  }
}, { immediate: true })

// Convert Date back to string when changed
const handleDateChange = (newDate: Date | undefined) => {
  date.value = newDate
  if (!newDate) {
    emit('update:modelValue', null)
  } else {
    // Format as YYYY-MM-DD
    const year = newDate.getFullYear()
    const month = String(newDate.getMonth() + 1).padStart(2, '0')
    const day = String(newDate.getDate()).padStart(2, '0')
    emit('update:modelValue', `${year}-${month}-${day}`)
  }
}

const displayValue = computed(() => {
  if (!date.value) return props.placeholder
  return date.value.toDateString()
})
</script>

<template>
  <Popover>
    <PopoverTrigger
      :disabled="disabled"
      :class="cn(
        'flex h-9 w-full items-center justify-start rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        !date && 'text-muted-foreground',
        props.class
      )"
    >
      <CalendarIcon class="mr-2 h-4 w-4" />
      {{ displayValue }}
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" align="start">
      <Calendar
        :model-value="date"
        @update:model-value="handleDateChange"
        :initial-focus="true"
        :default-placeholder="defaultPlaceholder"
        layout="month-and-year"
      />
    </PopoverContent>
  </Popover>
</template>
