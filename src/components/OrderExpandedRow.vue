<script setup lang="ts">
import type { OrderWithDetails } from '@/composables/useOrders'
import type { Printshop, ItemStatus } from '@/types'
import ItemControls from '@/components/ItemControls.vue'
import { FileText, MessageSquare, PanelRightOpen } from 'lucide-vue-next'

interface Props {
  order: OrderWithDetails
  printshops: Printshop[]
}

defineProps<Props>()

const emit = defineEmits<{
  'update-status': [itemId: string, status: ItemStatus]
  'update-printshop': [itemId: string, shopId: string | null]
  'update-dueDate': [itemId: string, date: string | null]
  'open-detail': [orderId: string]
}>()
</script>

<template>
  <div class="space-y-2">
    <!-- Items List -->
    <div class="space-y-2">
      <div
        v-for="item in order.items"
        :key="item.id"
        class="rounded-lg border bg-background px-4 py-3"
      >
        <div class="grid grid-cols-4 gap-10">
          <!-- Column 1: Item Details -->
          <div>
            <div class="font-semibold text-base mb-1">{{ item.product_name }}</div>
            <div class="text-sm text-muted-foreground mb-1">{{ item.description }}</div>
            <div class="text-xs text-muted-foreground">
              {{ item.quantity }}x
              <template v-if="item.specs && Object.keys(item.specs).length > 0">
                <span v-for="(value, key) in item.specs" :key="key">
                  • {{ key }}: {{ value }}
                </span>
              </template>
            </div>
          </div>

          <!-- Column 2: Controls -->
          <ItemControls
            :item="{ ...item, order, customer: order.customer }"
            :printshops="printshops"
            :show-printshop="true"
            :show-status="true"
            :show-due-date="false"
            :show-timeline="false"
            @update:status="(itemId, status) => emit('update-status', itemId, status)"
            @update:printshop="(itemId, shopId) => emit('update-printshop', itemId, shopId)"
          />

          <!-- Column 3: Timeline -->
          <ItemControls
            :item="{ ...item, order, customer: order.customer }"
            :show-printshop="false"
            :show-status="false"
            :show-due-date="false"
            :show-timeline="true"
            :readonly="true"
          />

          <!-- Column 4: Files & Comments -->
          <div class="space-y-3">
            <div>
              <label class="text-xs text-muted-foreground mb-1 block">Files</label>
              <div class="flex items-center gap-2 text-xs">
                <FileText class="h-4 w-4 text-muted-foreground" />
                <span class="text-muted-foreground">0 file(s)</span>
              </div>
            </div>
            <div>
              <label class="text-xs text-muted-foreground mb-1 block">Comments</label>
              <div class="flex items-center gap-2 text-xs">
                <MessageSquare class="h-4 w-4 text-muted-foreground" />
                <span class="text-muted-foreground">0 comment(s)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
