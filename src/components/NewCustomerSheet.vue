<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCustomers } from '@/composables/useCustomers'
import { useToast } from '@/composables/useToast'
import Sheet from '@/components/ui/Sheet.vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Label from '@/components/ui/Label.vue'
import Input from '@/components/ui/Input.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Button from '@/components/ui/Button.vue'
import { User } from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  side?: 'left' | 'right'
}

interface Emits {
  (e: 'update:isOpen', value: boolean): void
  (e: 'customer-created', customerId: string): void
}

const props = withDefaults(defineProps<Props>(), {
  side: 'right',
})

const emit = defineEmits<Emits>()

const { addCustomer } = useCustomers()
const { toast } = useToast()

// Form fields
const name = ref('')
const email = ref('')
const phone = ref('')
const company = ref('')
const address = ref('')
const notes = ref('')

// Validation
const validationErrors = ref<string[]>([])

const resetForm = () => {
  name.value = ''
  email.value = ''
  phone.value = ''
  company.value = ''
  address.value = ''
  notes.value = ''
  validationErrors.value = []
}

const validateForm = (): boolean => {
  const errors: string[] = []

  if (!name.value.trim()) {
    errors.push('Name is required')
  }

  if (!email.value.trim()) {
    errors.push('Email is required')
  } else if (!email.value.includes('@')) {
    errors.push('Email must be valid')
  }

  if (!phone.value.trim()) {
    errors.push('Phone is required')
  }

  if (!address.value.trim()) {
    errors.push('Address is required')
  }

  validationErrors.value = errors
  return errors.length === 0
}

const createCustomer = async () => {
  if (!validateForm()) {
    return
  }

  try {
    const newCustomer = await addCustomer({
      name: name.value.trim(),
      email: email.value.trim(),
      phone: phone.value.trim(),
      company: company.value.trim() || null,
      address: address.value.trim(),
      notes: notes.value.trim(),
    })

    if (!newCustomer) {
      throw new Error('Failed to create customer')
    }

    toast({
      title: 'Customer created',
      description: `${newCustomer.name} has been added`,
    })

    emit('customer-created', newCustomer.id)
    emit('update:isOpen', false)
    resetForm()
  } catch (error) {
    toast({
      title: 'Error',
      description: 'Failed to create customer',
      variant: 'destructive',
    })
  }
}

const cancel = () => {
  const hasChanges =
    name.value ||
    email.value ||
    phone.value ||
    company.value ||
    address.value ||
    notes.value

  if (hasChanges) {
    if (confirm('Are you sure you want to cancel? All entered information will be lost.')) {
      emit('update:isOpen', false)
      resetForm()
    }
  } else {
    emit('update:isOpen', false)
    resetForm()
  }
}

// Reset form when sheet closes
watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) {
      // Small delay to allow animation
      setTimeout(resetForm, 300)
    }
  }
)
</script>

<template>
  <Sheet
    :open="isOpen"
    @update:open="emit('update:isOpen', $event)"
    title="Create New Customer"
    :side="side"
    :z-index="60"
  >
    <div class="space-y-6 p-6">
      <!-- Validation Errors -->
      <div v-if="validationErrors.length > 0" class="rounded-lg border border-destructive bg-destructive/10 p-4">
        <div class="mb-2 font-semibold text-destructive">Please fix the following errors:</div>
        <ul class="list-inside list-disc space-y-1 text-sm text-destructive">
          <li v-for="(error, index) in validationErrors" :key="index">{{ error }}</li>
        </ul>
      </div>

      <!-- Customer Information -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <div class="p-2 bg-accent rounded-lg">
              <User class="h-4 w-4" />
            </div>
            Customer Information
          </h3>
        </div>

        <Card>
          <CardContent class="p-4">
            <div class="space-y-4">
              <!-- Name -->
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Name *</Label>
                <Input v-model="name" placeholder="Full name" />
              </div>

              <!-- Email -->
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Email *</Label>
                <Input v-model="email" type="email" placeholder="email@example.com" />
              </div>

              <!-- Phone -->
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Phone *</Label>
                <Input v-model="phone" type="tel" placeholder="(555) 123-4567" />
              </div>

              <!-- Company -->
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Company (Optional)</Label>
                <Input v-model="company" placeholder="Company name" />
              </div>

              <!-- Address -->
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Delivery Address *</Label>
                <Textarea
                  v-model="address"
                  placeholder="123 Main St, Toronto, ON M5V 2T6"
                  :rows="2"
                />
              </div>

              <!-- Notes -->
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Notes (Optional)</Label>
                <Textarea
                  v-model="notes"
                  placeholder="Internal notes about this customer"
                  :rows="3"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Footer Actions -->
      <div class="flex gap-3 sticky bottom-0 bg-background pt-4 border-t">
        <Button size="lg" class="flex-1" @click="createCustomer">Create Customer</Button>
        <Button variant="outline" size="lg" @click="cancel">Cancel</Button>
      </div>
    </div>
  </Sheet>
</template>
