<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'
import DialogContent from '@/components/ui/DialogContent.vue'
import DialogHeader from '@/components/ui/DialogHeader.vue'
import DialogTitle from '@/components/ui/DialogTitle.vue'
import DialogDescription from '@/components/ui/DialogDescription.vue'
import DialogFooter from '@/components/ui/DialogFooter.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import {
  ArrowRightLeft,
  User,
  AlertCircle
} from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  itemIds: string[]
  itemSummary: string
  activeDrivers: { id: string; name: string; isOnRoute: boolean }[]
}

interface Emits {
  (e: 'update:isOpen', value: boolean): void
  (e: 'confirm', targetDriverId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// State
const selectedDriverId = ref<string>('')

// Reset selection when dialog opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    selectedDriverId.value = ''
  }
})

// Actions
const handleConfirm = () => {
  if (selectedDriverId.value) {
    emit('confirm', selectedDriverId.value)
  }
}
</script>

<template>
  <Dialog :open="isOpen" @update:open="emit('update:isOpen', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <ArrowRightLeft class="h-5 w-5" />
          Transfer Items
        </DialogTitle>
        <DialogDescription>
          Transfer these items to another active driver.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4 px-6">
        <!-- Items Being Transferred -->
        <div class="rounded-lg border bg-muted/30 p-3">
          <div class="text-xs text-muted-foreground mb-1">Transferring</div>
          <div class="text-sm font-medium">{{ itemSummary }}</div>
          <div class="text-xs text-muted-foreground mt-1">
            {{ itemIds.length }} item{{ itemIds.length !== 1 ? 's' : '' }}
          </div>
        </div>

        <!-- Driver Selection -->
        <div v-if="activeDrivers.length > 0">
          <div class="text-sm font-medium mb-3">Transfer to:</div>
          <div class="space-y-2">
            <button
              v-for="driver in activeDrivers"
              :key="driver.id"
              @click="selectedDriverId = driver.id"
              :class="[
                'w-full flex items-center justify-between p-3 rounded-lg border transition-colors',
                selectedDriverId === driver.id
                  ? 'border-primary bg-accent'
                  : 'border-input hover:bg-accent/50'
              ]"
            >
              <div class="flex items-center gap-3">
                <div
                  :class="[
                    'h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors',
                    selectedDriverId === driver.id
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  ]"
                >
                  <div
                    v-if="selectedDriverId === driver.id"
                    class="h-2 w-2 rounded-full bg-white"
                  ></div>
                </div>
                <div class="flex items-center gap-2">
                  <User class="h-4 w-4 text-muted-foreground" />
                  <span class="text-sm font-medium">{{ driver.name }}</span>
                </div>
              </div>
              <Badge
                :variant="driver.isOnRoute ? 'success' : 'secondary'"
                class="text-xs"
              >
                {{ driver.isOnRoute ? 'On Route' : 'Available' }}
              </Badge>
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle class="h-12 w-12 text-muted-foreground/50 mb-3" />
          <p class="text-sm text-muted-foreground max-w-xs">
            No other drivers are currently active. Items can only be transferred to active drivers.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:isOpen', false)">
          Cancel
        </Button>
        <Button
          @click="handleConfirm"
          :disabled="!selectedDriverId || activeDrivers.length === 0"
        >
          Transfer Items
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
