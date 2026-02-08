<script setup lang="ts" generic="TData, TValue">
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  ExpandedState,
} from '@tanstack/vue-table'
import {
  FlexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import { ref } from 'vue'
import { valueUpdater } from '@/lib/utils'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'

const props = defineProps<{
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  gridTemplateColumns?: string
}>()

const sorting = ref<SortingState>([])
const columnFilters = ref<ColumnFiltersState>([])
const columnVisibility = ref<VisibilityState>({})
const rowSelection = ref({})
const expanded = ref<ExpandedState>({})

const table = useVueTable({
  get data() {
    return props.data
  },
  get columns() {
    return props.columns
  },
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  onSortingChange: (updaterOrValue) => valueUpdater(updaterOrValue, sorting),
  onColumnFiltersChange: (updaterOrValue) => valueUpdater(updaterOrValue, columnFilters),
  onColumnVisibilityChange: (updaterOrValue) => valueUpdater(updaterOrValue, columnVisibility),
  onRowSelectionChange: (updaterOrValue) => valueUpdater(updaterOrValue, rowSelection),
  onExpandedChange: (updaterOrValue) => valueUpdater(updaterOrValue, expanded),
  state: {
    get sorting() {
      return sorting.value
    },
    get columnFilters() {
      return columnFilters.value
    },
    get columnVisibility() {
      return columnVisibility.value
    },
    get rowSelection() {
      return rowSelection.value
    },
    get expanded() {
      return expanded.value
    },
  },
})
</script>

<template>
  <div class="space-y-4">

    <!-- Table Container -->
    <div class="space-y-2 bg-muted/30 rounded-2xl border pb-2">
      <!-- Header Row -->
      <div
        v-for="headerGroup in table.getHeaderGroups()"
        :key="headerGroup.id"
        class="grid gap-2 bg-foreground rounded-t-xl"
        :style="{ gridTemplateColumns: gridTemplateColumns || `repeat(${columns.length}, minmax(0, 1fr))` }"
      >
        <div
          v-for="header in headerGroup.headers"
          :key="header.id"
          class="flex items-center px-2 py-3 text-xs font-medium text-background"
        >
          <FlexRender
            v-if="!header.isPlaceholder"
            :render="header.column.columnDef.header"
            :props="header.getContext()"
          />
        </div>
      </div>

      <!-- Data Rows -->
      <template v-if="table.getRowModel().rows?.length">
        <div
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          class="space-y-0 px-2"
        >
          <!-- Main Row -->
          <div
            class="grid gap-2 rounded-xl border bg-card transition-colors hover:bg-accent/10"
            :class="{ 'rounded-b-none': row.getIsExpanded() }"
            :style="{ gridTemplateColumns: gridTemplateColumns || `repeat(${columns.length}, minmax(0, 1fr))` }"
          >
            <div
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              class="flex items-center px-2 py-3 text-sm"
            >
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </div>
          </div>

          <!-- Expanded Row -->
          <div
            v-if="row.getIsExpanded()"
            class="border border-t-0 rounded-b-xl bg-card p-4"
          >
            <slot name="expanded-row" :row="row" />
          </div>
        </div>
      </template>

      <!-- Empty State -->
      <div v-else class="flex h-24 items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground">
        No results.
      </div>
    </div>

    <!-- Pagination -->
    <div class="flex items-center justify-between">
      <div class="flex-1 text-sm text-muted-foreground">
        Showing {{ table.getRowModel().rows.length }} of {{ table.getFilteredRowModel().rows.length }} row(s)
      </div>
      <div class="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="!table.getCanPreviousPage()"
          @click="table.previousPage()"
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="!table.getCanNextPage()"
          @click="table.nextPage()"
        >
          Next
        </Button>
      </div>
    </div>
  </div>
</template>
