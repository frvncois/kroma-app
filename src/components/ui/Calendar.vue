<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import {
  CalendarRoot,
  CalendarHeader,
  CalendarHeading,
  CalendarNext,
  CalendarPrev,
  CalendarGrid,
  CalendarCell,
  CalendarHeadCell,
  CalendarGridHead,
  CalendarGridBody,
  CalendarGridRow,
  CalendarCellTrigger,
} from 'radix-vue'
import { cn } from '@/lib/utils'

interface Props {
  modelValue?: DateValue
  defaultPlaceholder?: DateValue
  initialFocus?: boolean
  class?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: DateValue | undefined): void
}>()
</script>

<template>
  <CalendarRoot
    :model-value="modelValue"
    @update:model-value="(val) => emit('update:modelValue', val)"
    :default-placeholder="defaultPlaceholder"
    :initial-focus="initialFocus"
    :class="cn('p-3', props.class)"
  >
    <CalendarHeader class="flex items-center justify-between">
      <CalendarPrev
        class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
      >
        <ChevronLeft class="h-4 w-4" />
      </CalendarPrev>

      <CalendarHeading
        v-slot="{ headingValue }"
        class="text-sm font-medium"
      >
        {{ headingValue }}
      </CalendarHeading>

      <CalendarNext
        class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
      >
        <ChevronRight class="h-4 w-4" />
      </CalendarNext>
    </CalendarHeader>

    <div class="flex flex-col gap-y-4 mt-4">
      <CalendarGrid v-slot="{ grid, weekDays }: any" class="w-full border-collapse space-y-1">
        <CalendarGridHead>
          <CalendarGridRow class="flex">
            <CalendarHeadCell
              v-for="day in weekDays"
              :key="day"
              class="text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]"
            >
              {{ day }}
            </CalendarHeadCell>
          </CalendarGridRow>
        </CalendarGridHead>
        <CalendarGridBody>
          <CalendarGridRow
            v-for="(weekDates, index) in grid"
            :key="`weekDate-${index}`"
            class="flex w-full mt-2"
          >
            <CalendarCell
              v-for="weekDate in weekDates"
              :key="weekDate.toString()"
              :date="weekDate"
            >
              <CalendarCellTrigger
                :day="weekDate"
                :month="weekDate"
                :class="
                  cn(
                    'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 inline-flex items-center justify-center whitespace-nowrap rounded-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9 font-normal aria-selected:opacity-100',
                    'data-[today]:bg-accent data-[today]:text-accent-foreground',
                    'data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:hover:bg-primary data-[selected]:hover:text-primary-foreground data-[selected]:focus:bg-primary data-[selected]:focus:text-primary-foreground',
                    'data-[outside-view]:text-muted-foreground data-[outside-view]:opacity-50 [&[data-outside-view][data-selected]]:bg-accent/50 [&[data-outside-view][data-selected]]:text-muted-foreground [&[data-outside-view][data-selected]]:opacity-30',
                    'data-[disabled]:text-muted-foreground data-[disabled]:opacity-50'
                  )
                "
              />
            </CalendarCell>
          </CalendarGridRow>
        </CalendarGridBody>
      </CalendarGrid>
    </div>
  </CalendarRoot>
</template>
