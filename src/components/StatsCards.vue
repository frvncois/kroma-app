<script setup lang="ts">
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardContent from '@/components/ui/CardContent.vue'
import type { Component } from 'vue'

interface StatItem {
  label: string
  icon: Component
  count: number
  statKey: string
}

interface CardConfig {
  title: string
  icon: string
  iconColor: string
  items: StatItem[]
}

interface Props {
  cards: CardConfig[]
}

defineProps<Props>()

const emit = defineEmits<{
  'stat-click': [statKey: string]
}>()
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0 pb-10">
    <Card v-for="(card, index) in cards" :key="index">
      <CardHeader class="pb-0">
        <div class="flex items-center gap-4">
          <div class="rounded-lg p-2" :class="card.iconColor">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path v-if="card.icon === 'manager'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              <path v-else-if="card.icon === 'production'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <template v-else-if="card.icon === 'delivery'">
                <rect x="1" y="3" width="15" height="13" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M16 8h5l3 3v5h-2m-4 0H2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="5.5" cy="18.5" r="2.5" stroke-width="2" />
                <circle cx="18.5" cy="18.5" r="2.5" stroke-width="2" />
              </template>
            </svg>
          </div>
          <CardTitle class="text-sm">{{ card.title }}</CardTitle>
        </div>
      </CardHeader>
      <CardContent class="space-y-2">
        <div
          v-for="item in card.items"
          :key="item.statKey"
          @click="emit('stat-click', item.statKey)"
          class="cursor-pointer flex items-center justify-between py-2 px-4 rounded-lg bg-accent/30 hover:bg-accent transition-all border"
        >
          <div class="flex items-center gap-4">
            <component :is="item.icon" class="h-3.5 w-3.5" />
            <span class="text-xs">{{ item.label }}</span>
          </div>
          <span class="text-xs font-medium">{{ item.count }}</span>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
