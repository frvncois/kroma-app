<script setup lang="ts">
import Dialog from '@/components/ui/Dialog.vue'
import Button from '@/components/ui/Button.vue'

interface Props {
  isOpen: boolean
  itemName: string
  printshopName: string
}

defineProps<Props>()

const emit = defineEmits<{
  'update:isOpen': [value: boolean]
  'confirm': []
  'cancel': []
}>()
</script>

<template>
  <Dialog :open="isOpen" @update:open="emit('update:isOpen', $event)">
    <div class="p-6">
      <h2 class="text-xl font-semibold mb-4">Confirm Assignment</h2>
      <p class="text-muted-foreground mb-6">
        Assign <span class="font-medium text-foreground">{{ itemName }}</span> to <span class="font-medium text-foreground">{{ printshopName }}</span>?
      </p>
      <div class="flex justify-end gap-3">
        <Button variant="outline" @click="emit('cancel')">Cancel</Button>
        <Button @click="emit('confirm')">Confirm</Button>
      </div>
    </div>
  </Dialog>
</template>
